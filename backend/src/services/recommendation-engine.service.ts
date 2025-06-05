import { GooglePlaceBasic } from "./google-places.service.ts";
import { IUserProfile } from "../models/recommendation/user-profile.mongo.ts";

export interface RecommendationRequest {
  userProfile: IUserProfile;
  candidatePlaces: GooglePlaceBasic[];
  context: {
    userLocation: { latitude: number; longitude: number };
    timestamp: Date;
    timeOfDay: number; // 0-23
    dayOfWeek: number; // 0-6
    radius: number; // search radius in meters
    deviceType?: "mobile" | "tablet" | "desktop";
    sessionId?: string;
  };
  options?: {
    diversityBoost?: number; // 0-1, how much to boost diverse recommendations
    qualityWeight?: number; // 0-1, how much to weight place quality
    temporalWeight?: number; // 0-1, how much to weight temporal preferences
    locationWeight?: number; // 0-1, how much to weight location preferences
    minScore?: number; // minimum score threshold
    maxResults?: number;
  };
}

export interface ScoredRecommendation {
  place: GooglePlaceBasic;
  score: number; // 0-1 final recommendation score
  reasoning: string[]; // explanations for why this was recommended
  scoreBreakdown: {
    categoryScore: number;
    locationScore: number;
    temporalScore: number;
    qualityScore: number;
    diversityBonus: number;
    contextBonus: number;
  };
  metadata: {
    distance: number; // meters from user location
    matchedCategories: string[];
    temporalCompatibility: number;
    userProfileVersion: number;
    modelVersion: string;
  };
}

export interface RecommendationResult {
  recommendations: ScoredRecommendation[];
  metadata: {
    totalCandidates: number;
    scoredCandidates: number;
    averageScore: number;
    executionTime: number;
    cacheKey?: string;
    userProfileStats: {
      totalVisits: number;
      topCategories: string[];
      activeHours: number[];
    };
  };
}

export class RecommendationEngine {
  private static readonly MODEL_VERSION = "1.0.0";
  private static readonly DEFAULT_OPTIONS = {
    diversityBoost: 0.1,
    qualityWeight: 0.3,
    temporalWeight: 0.2,
    locationWeight: 0.3,
    minScore: 0.1,
    maxResults: 20,
  };

  // Category similarity thresholds and weights
  private static readonly CATEGORY_EXACT_MATCH_BONUS = 0.3;

  // Geographic scoring parameters
  private static readonly MAX_LOCATION_DISTANCE = 50000; // 50km max distance consideration

  // Temporal scoring parameters
  private static readonly TEMPORAL_SMOOTHING_WINDOW = 2; // Hours around current time to consider
  private static readonly MIN_TEMPORAL_ACTIVITY = 0.05; // Minimum activity level to consider

  // Quality scoring parameters
  private static readonly MIN_RATING_THRESHOLD = 3.0;
  private static readonly MIN_REVIEWS_THRESHOLD = 5;

  /**
   * Generate recommendations using content-based filtering
   */
  static async generateRecommendations(request: RecommendationRequest): Promise<RecommendationResult> {
    const startTime = Date.now();

    try {
      const {
        userProfile,
        candidatePlaces,
        context,
        options = this.DEFAULT_OPTIONS
      } = request;

      // Merge options with defaults
      const finalOptions = { ...this.DEFAULT_OPTIONS, ...options };

      console.log(`Generating recommendations for ${candidatePlaces.length} candidates`);

      // Score each candidate place
      const scoredRecommendations: ScoredRecommendation[] = [];

      for (const place of candidatePlaces) {
        const scored = await this.scorePlaceForUser(place, userProfile, context, finalOptions);
        
        if (scored.score >= finalOptions.minScore) {
          scoredRecommendations.push(scored);
        }
      }

      // Apply diversity boost
      const diversifiedRecommendations = this.applyDiversityBoost(
        scoredRecommendations,
        finalOptions.diversityBoost
      );

      // Sort by final score and limit results
      const finalRecommendations = diversifiedRecommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, finalOptions.maxResults);

      const executionTime = Date.now() - startTime;

      // Generate result metadata
      const averageScore = finalRecommendations.length > 0
        ? finalRecommendations.reduce((sum, rec) => sum + rec.score, 0) / finalRecommendations.length
        : 0;

      const userProfileStats = {
        totalVisits: userProfile.totalVisits,
        topCategories: (userProfile as any).getTopCategories(5),
        activeHours: (userProfile as any).getActiveHours(),
      };

      return {
        recommendations: finalRecommendations,
        metadata: {
          totalCandidates: candidatePlaces.length,
          scoredCandidates: scoredRecommendations.length,
          averageScore,
          executionTime,
          userProfileStats,
        },
      };

    } catch (error) {
      console.error("Error generating recommendations:", error);
      throw new Error(`Recommendation generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Score a single place for a user
   */
     private static async scorePlaceForUser(
     place: GooglePlaceBasic,
     userProfile: IUserProfile,
     context: RecommendationRequest["context"],
     options: Required<NonNullable<RecommendationRequest["options"]>>
   ): Promise<ScoredRecommendation> {
    // Calculate individual score components
    const categoryScore = this.calculateCategoryScore(place, userProfile);
    const locationScore = this.calculateLocationScore(place, userProfile, context);
    const temporalScore = this.calculateTemporalScore(place, userProfile, context);
    const qualityScore = this.calculateQualityScore(place);
    const contextBonus = this.calculateContextBonus(place, context);

    // Calculate weighted final score
    const weightedScore = 
      (categoryScore * 0.4) +
      (locationScore * options.locationWeight) +
      (temporalScore * options.temporalWeight) +
      (qualityScore * options.qualityWeight) +
      (contextBonus * 0.1);

    // Calculate distance from user
    const distance = this.calculateDistance(
      [context.userLocation.longitude, context.userLocation.latitude],
      [place.location.longitude, place.location.latitude]
    );

    // Find matched categories
    const matchedCategories = this.findMatchedCategories(place, userProfile);

    // Calculate temporal compatibility
    const temporalCompatibility = this.calculateTemporalCompatibility(userProfile, context);

    // Generate reasoning
    const reasoning = this.generateReasoning(
      place,
      userProfile,
      { categoryScore, locationScore, temporalScore, qualityScore, contextBonus },
      matchedCategories,
      distance
    );

    return {
      place,
      score: Math.max(0, Math.min(1, weightedScore)),
      reasoning,
      scoreBreakdown: {
        categoryScore,
        locationScore,
        temporalScore,
        qualityScore,
        diversityBonus: 0, // Will be set during diversity boost
        contextBonus,
      },
      metadata: {
        distance,
        matchedCategories,
        temporalCompatibility,
        userProfileVersion: userProfile.version,
        modelVersion: this.MODEL_VERSION,
      },
    };
  }

  /**
   * Calculate category preference score using cosine similarity
   */
  private static calculateCategoryScore(place: GooglePlaceBasic, userProfile: IUserProfile): number {
    if (place.types.length === 0) return 0;

    let totalScore = 0;
    let matchCount = 0;

    for (const placeType of place.types) {
      const userPreference = userProfile.categoryPreferences.get(placeType) || 0;
      
      if (userPreference > 0) {
        totalScore += userPreference;
        matchCount++;
      }
    }

    if (matchCount === 0) return 0;

    // Normalize by number of place types and add exact match bonus
    let score = totalScore / place.types.length;
    
    // Boost score if user has strong preference (visited category multiple times)
    const strongPreferences = place.types.filter(type => 
      (userProfile.categoryPreferences.get(type) || 0) > 0.5
    );
    
    if (strongPreferences.length > 0) {
      score += this.CATEGORY_EXACT_MATCH_BONUS * (strongPreferences.length / place.types.length);
    }

    return Math.min(1, score);
  }

  /**
   * Calculate location preference score based on frequent areas
   */
  private static calculateLocationScore(
    place: GooglePlaceBasic,
    userProfile: IUserProfile,
    context: RecommendationRequest["context"]
  ): number {
    const placeCoords = [place.location.longitude, place.location.latitude];
    let maxScore = 0;

    // Score based on frequent areas
    for (const area of userProfile.locationPreferences.frequentAreas) {
      const areaCoords = area.center.coordinates;
      const distance = this.calculateDistance(placeCoords, areaCoords);
      
      if (distance <= area.radius) {
        // Calculate score based on visit frequency and distance within area
        const proximityScore = 1 - (distance / area.radius);
        const frequencyWeight = Math.min(1, area.visitCount / 10); // Cap at 10 visits
        const areaScore = proximityScore * frequencyWeight;
        
        maxScore = Math.max(maxScore, areaScore);
      }
    }

    // Also consider distance from current user location
    const currentDistance = this.calculateDistance(
      placeCoords,
      [context.userLocation.longitude, context.userLocation.latitude]
    );

    // Prefer places within user's preferred radius
    const radiusScore = currentDistance <= userProfile.locationPreferences.preferredRadius
      ? 1 - (currentDistance / userProfile.locationPreferences.preferredRadius)
      : Math.exp(-currentDistance / this.MAX_LOCATION_DISTANCE);

    return Math.max(maxScore, radiusScore * 0.7); // Weight current location slightly lower
  }

  /**
   * Calculate temporal compatibility score
   */
  private static calculateTemporalScore(
    place: GooglePlaceBasic,
    userProfile: IUserProfile,
    context: RecommendationRequest["context"]
  ): number {
    const { timeOfDay, dayOfWeek } = context;

    // Get user's activity level at current time
    const hourActivity = userProfile.temporalPreferences.hourOfDay[timeOfDay] || 0;
    const dayActivity = userProfile.temporalPreferences.dayOfWeek[dayOfWeek] || 0;

    // Consider smoothing window around current hour
    let smoothedHourActivity = hourActivity;
    for (let offset = 1; offset <= this.TEMPORAL_SMOOTHING_WINDOW; offset++) {
      const prevHour = (timeOfDay - offset + 24) % 24;
      const nextHour = (timeOfDay + offset) % 24;
      
      smoothedHourActivity += 
        (userProfile.temporalPreferences.hourOfDay[prevHour] || 0) * (1 / (offset + 1));
      smoothedHourActivity += 
        (userProfile.temporalPreferences.hourOfDay[nextHour] || 0) * (1 / (offset + 1));
    }

    smoothedHourActivity /= (1 + 2 * this.TEMPORAL_SMOOTHING_WINDOW);

    // Combine hour and day preferences
    const temporalScore = (smoothedHourActivity * 0.7) + (dayActivity * 0.3);

    return Math.max(this.MIN_TEMPORAL_ACTIVITY, temporalScore);
  }

  /**
   * Calculate place quality score
   */
  private static calculateQualityScore(place: GooglePlaceBasic): number {
    let score = 0;

    // Rating component (0-1)
    if (place.rating && place.rating >= this.MIN_RATING_THRESHOLD) {
      score += (place.rating - this.MIN_RATING_THRESHOLD) / (5 - this.MIN_RATING_THRESHOLD) * 0.6;
    }

    // Review count component (0-1)
    if (place.userRatingsTotal && place.userRatingsTotal >= this.MIN_REVIEWS_THRESHOLD) {
      const reviewScore = Math.min(1, Math.log10(place.userRatingsTotal) / 3); // Log scale, cap at 1000 reviews
      score += reviewScore * 0.3;
    }
    return Math.min(1, score);
  }

  /**
   * Calculate context-specific bonus
   */
  private static calculateContextBonus(
    place: GooglePlaceBasic,
    context: RecommendationRequest["context"]
  ): number {
    let bonus = 0;

    // Time-based bonuses for specific place types
    const timeOfDay = context.timeOfDay;
    
    if (place.types.includes("restaurant") || place.types.includes("cafe")) {
      // Meal time bonuses
      if ((timeOfDay >= 7 && timeOfDay <= 10) || // Breakfast
          (timeOfDay >= 12 && timeOfDay <= 14) || // Lunch
          (timeOfDay >= 18 && timeOfDay <= 21)) { // Dinner
        bonus += 0.2;
      }
    }

    if (place.types.includes("bar") || place.types.includes("night_club")) {
      // Evening/night bonus
      if (timeOfDay >= 18 || timeOfDay <= 2) {
        bonus += 0.2;
      }
    }

    if (place.types.includes("gym") || place.types.includes("park")) {
      // Morning/evening exercise bonus
      if ((timeOfDay >= 6 && timeOfDay <= 9) || (timeOfDay >= 17 && timeOfDay <= 20)) {
        bonus += 0.15;
      }
    }

    // Weekend bonuses for leisure activities
    if (context.dayOfWeek === 0 || context.dayOfWeek === 6) { // Sunday or Saturday
      if (place.types.some(type => 
        ["tourist_attraction", "museum", "amusement_park", "zoo", "park"].includes(type)
      )) {
        bonus += 0.1;
      }
    }

    return Math.min(0.3, bonus);
  }

  /**
   * Apply diversity boost to prevent too many similar recommendations
   */
  private static applyDiversityBoost(
    recommendations: ScoredRecommendation[],
    diversityBoost: number
  ): ScoredRecommendation[] {
    if (diversityBoost <= 0 || recommendations.length <= 1) {
      return recommendations;
    }

    const typeCount: Record<string, number> = {};
    
    return recommendations.map(rec => {
      // Count occurrences of each place type
      for (const type of rec.place.types) {
        typeCount[type] = (typeCount[type] || 0) + 1;
      }

      // Calculate diversity bonus (higher for less common types)
      let diversityScore = 0;
      for (const type of rec.place.types) {
        const typeFrequency = typeCount[type] / recommendations.length;
        diversityScore += (1 - typeFrequency) * diversityBoost;
      }

      diversityScore = diversityScore / rec.place.types.length;

      return {
        ...rec,
        score: Math.min(1, rec.score + diversityScore),
        scoreBreakdown: {
          ...rec.scoreBreakdown,
          diversityBonus: diversityScore,
        },
      };
    });
  }

  // Helper methods

  private static calculateDistance(coord1: number[], coord2: number[]): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = coord1[1] * Math.PI / 180;
    const lat2Rad = coord2[1] * Math.PI / 180;
    const deltaLatRad = (coord2[1] - coord1[1]) * Math.PI / 180;
    const deltaLngRad = (coord2[0] - coord1[0]) * Math.PI / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private static findMatchedCategories(place: GooglePlaceBasic, userProfile: IUserProfile): string[] {
    return place.types.filter(type => 
      (userProfile.categoryPreferences.get(type) || 0) > 0.1
    );
  }

  private static calculateTemporalCompatibility(
    userProfile: IUserProfile,
    context: RecommendationRequest["context"]
  ): number {
    const hourActivity = userProfile.temporalPreferences.hourOfDay[context.timeOfDay] || 0;
    const dayActivity = userProfile.temporalPreferences.dayOfWeek[context.dayOfWeek] || 0;
    return (hourActivity + dayActivity) / 2;
  }

  private static generateReasoning(
    place: GooglePlaceBasic,
    userProfile: IUserProfile,
    scores: Record<string, number>,
    matchedCategories: string[],
    distance: number
  ): string[] {
    const reasoning: string[] = [];

    // Category-based reasoning
    if (scores.categoryScore > 0.3 && matchedCategories.length > 0) {
      reasoning.push(`Matches your interest in ${matchedCategories.slice(0, 2).join(" and ")}`);
    }

    // Location-based reasoning
    if (scores.locationScore > 0.5) {
      reasoning.push(`Located in an area you frequently visit`);
    } else if (distance < 1000) {
      reasoning.push(`Very close to your current location (${Math.round(distance)}m away)`);
    }

    // Quality-based reasoning
    if (place.rating && place.rating >= 4.0) {
      reasoning.push(`Highly rated (${place.rating}/5 stars)`);
    }
    if (place.userRatingsTotal && place.userRatingsTotal >= 100) {
      reasoning.push(`Popular with ${place.userRatingsTotal} reviews`);
    }

    // Temporal reasoning
    if (scores.temporalScore > 0.4) {
      reasoning.push(`Good time for this type of activity based on your patterns`);
    }

    // Context reasoning
    if (scores.contextBonus > 0.1) {
      reasoning.push(`Perfect timing for this type of place`);
    }

    // Default reasoning if none found
    if (reasoning.length === 0) {
      reasoning.push(`Discovered based on your location and preferences`);
    }

    return reasoning;
  }

  /**
   * Explain recommendation score breakdown
   */
  static explainRecommendation(recommendation: ScoredRecommendation): string {
    const { scoreBreakdown, reasoning, metadata } = recommendation;
    
    let explanation = `Score: ${(recommendation.score * 100).toFixed(1)}%\n\n`;
    
    explanation += "Score Breakdown:\n";
    explanation += `• Category Match: ${(scoreBreakdown.categoryScore * 100).toFixed(1)}%\n`;
    explanation += `• Location Preference: ${(scoreBreakdown.locationScore * 100).toFixed(1)}%\n`;
    explanation += `• Time Compatibility: ${(scoreBreakdown.temporalScore * 100).toFixed(1)}%\n`;
    explanation += `• Place Quality: ${(scoreBreakdown.qualityScore * 100).toFixed(1)}%\n`;
    
    if (scoreBreakdown.diversityBonus > 0) {
      explanation += `• Diversity Bonus: ${(scoreBreakdown.diversityBonus * 100).toFixed(1)}%\n`;
    }
    
    explanation += `\nReasons:\n${reasoning.map(r => `• ${r}`).join('\n')}`;
    
    explanation += `\n\nDistance: ${Math.round(metadata.distance)}m`;
    
    if (metadata.matchedCategories.length > 0) {
      explanation += `\nMatched Categories: ${metadata.matchedCategories.join(', ')}`;
    }

    return explanation;
  }
} 