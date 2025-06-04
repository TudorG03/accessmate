import { GooglePlacesService, GooglePlaceBasic } from "./google-places.service.ts";
import { UserProfileService } from "./user-profile.service.ts";
import { RecommendationEngine, RecommendationRequest, ScoredRecommendation } from "./recommendation-engine.service.ts";
import { AccessibilityEnhancement, EnhancedRecommendation } from "./accessibility-enhancement.service.ts";
import RecommendationCache, { IRecommendationCache } from "../models/recommendation/recommendation-cache.mongo.ts";
import RecommendationFeedback, { IRecommendationFeedback } from "../models/recommendation/recommendation-feedback.mongo.ts";
import { IUserProfile } from "../models/recommendation/user-profile.mongo.ts";

export interface OrchestrationRequest {
  userId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  searchRadius?: number; // meters, default 5000
  searchQuery?: string; // optional text search
  categories?: string[]; // optional category filters
  maxResults?: number; // default 20
  forceRefresh?: boolean; // bypass cache
  deviceType?: "mobile" | "tablet" | "desktop";
  sessionId?: string;
  preferences?: {
    diversityBoost?: number;
    qualityWeight?: number;
    temporalWeight?: number;
    locationWeight?: number;
    includeExplanations?: boolean;
  };
}

export interface OrchestrationResponse {
  recommendations: EnhancedRecommendation[];
  metadata: {
    fromCache: boolean;
    cacheKey?: string;
    executionTime: number;
    userProfileAge: number; // hours since last update
    totalCandidates: number;
    userStats: {
      totalVisits: number;
      profileCompleteness: number; // 0-1
      topCategories: string[];
      recommendationHistory: number;
    };
    accessibilitySummary?: {
      totalRecommendations: number;
      withAccessibilityData: number;
      highConfidenceData: number;
      averageAccessibilityRating: number;
      mostCommonFeatures: string[];
    };
  };
  debug?: {
    profileUpdateNeeded: boolean;
    searchParams: any;
    cacheHit: boolean;
    candidatesSources: string[];
    accessibilityEnhanced?: boolean;
  };
}

export interface FeedbackRequest {
  userId: string;
  placeId: string;
  action: "viewed" | "visited" | "dismissed" | "saved" | "shared" | "clicked";
  context?: {
    recommendationId?: string;
    sessionId?: string;
    dwellTime?: number;
    clickDepth?: number;
    actualVisitConfirmed?: boolean;
  };
  explicitFeedback?: {
    rating?: number;
    liked?: boolean;
    comment?: string;
  };
}

export class RecommendationOrchestrationService {
  private static readonly DEFAULT_SEARCH_RADIUS = 5000; // 5km
  private static readonly DEFAULT_MAX_RESULTS = 20;
  private static readonly PROFILE_UPDATE_THRESHOLD_HOURS = 24;
  private static readonly MAX_CANDIDATE_PLACES = 200;

  /**
   * Main recommendation generation endpoint
   */
  static async generateRecommendations(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const startTime = Date.now();

    try {
      console.log(`Generating recommendations for user ${request.userId}`);

      // Step 1: Get or create user profile
      const userProfile = await UserProfileService.getOrCreateProfile(request.userId);
      
      if (!userProfile) {
        throw new Error("Failed to create or retrieve user profile");
      }
      
      // Check if profile needs updating
      const profileAge = (Date.now() - userProfile.lastUpdated.getTime()) / (1000 * 60 * 60); // hours
      const profileUpdateNeeded = profileAge > this.PROFILE_UPDATE_THRESHOLD_HOURS;

      // Step 2: Generate cache key and check cache (unless force refresh)
      const cacheKey = this.generateCacheKey(request);
      
      if (!request.forceRefresh) {
        try {
          const cachedResult = await RecommendationCache.findOne({ cacheKey });
          
          if (cachedResult && cachedResult.expiresAt > new Date()) {
            console.log(`Cache hit for key: ${cacheKey}`);
            
            // Update hit count
            await RecommendationCache.updateOne(
              { _id: cachedResult._id },
              { $inc: { hitCount: 1 }, $set: { lastAccessed: new Date() } }
            );
            
            const executionTime = Date.now() - startTime;
            
            // Convert cached recommendations to ScoredRecommendation format
            const convertedRecommendations: ScoredRecommendation[] = cachedResult.recommendations.map(rec => ({
              place: {
                placeId: rec.placeId,
                name: rec.placeName,
                location: {
                  latitude: rec.location.coordinates[1],
                  longitude: rec.location.coordinates[0],
                },
                types: rec.placeTypes,
                rating: rec.googlePlaceData?.rating,
                userRatingsTotal: undefined,
                priceLevel: rec.googlePlaceData?.priceLevel,
                businessStatus: "OPERATIONAL",
              },
              score: rec.score,
              reasoning: rec.reasoning,
              scoreBreakdown: {
                categoryScore: 0,
                locationScore: 0,
                temporalScore: 0,
                qualityScore: 0,
                diversityBonus: 0,
                contextBonus: 0,
              },
              metadata: {
                distance: 0,
                matchedCategories: [],
                temporalCompatibility: 0,
                userProfileVersion: userProfile.version,
                modelVersion: "1.0.0",
              },
            }));

            // Enhance cached recommendations with accessibility data
            console.log("🔍 Enhancing cached recommendations with accessibility data...");
            const enhancedCachedRecommendations = await AccessibilityEnhancement.enhanceRecommendations(
              convertedRecommendations,
              request.userId
            );

            // Get accessibility summary for cached recommendations
            const accessibilitySummary = await AccessibilityEnhancement.getAccessibilitySummary(enhancedCachedRecommendations);
            
            return {
              recommendations: enhancedCachedRecommendations,
              metadata: {
                fromCache: true,
                cacheKey,
                executionTime,
                userProfileAge: profileAge,
                totalCandidates: cachedResult.recommendations.length,
                userStats: {
                  totalVisits: userProfile.totalVisits,
                  profileCompleteness: this.calculateProfileCompleteness(userProfile),
                  topCategories: (userProfile as any).getTopCategories(3),
                  recommendationHistory: await this.getRecommendationHistory(request.userId),
                },
                accessibilitySummary,
              },
              debug: {
                profileUpdateNeeded,
                searchParams: request,
                cacheHit: true,
                candidatesSources: [],
                accessibilityEnhanced: true,
              },
            };
          }
        } catch (error) {
          console.warn("Cache lookup failed:", error);
        }
      }

      // Step 3: Update user profile if needed
      if (profileUpdateNeeded) {
        console.log(`Updating user profile (age: ${profileAge.toFixed(1)} hours)`);
        try {
          await UserProfileService.buildProfile(request.userId);
        } catch (error) {
          console.warn("Profile update failed:", error);
        }
      }

      // Step 4: Get candidate places from Google Places API
      const candidatePlaces = await this.getCandidatePlaces(request, userProfile);
      console.log(`Found ${candidatePlaces.length} candidate places`);

      // Step 5: Generate recommendations using ML engine
      const context = {
        userLocation: request.location,
        timestamp: new Date(),
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        radius: request.searchRadius || this.DEFAULT_SEARCH_RADIUS,
        deviceType: request.deviceType,
        sessionId: request.sessionId,
      };

      const recommendationRequest: RecommendationRequest = {
        userProfile,
        candidatePlaces,
        context,
        options: {
          ...request.preferences,
          maxResults: request.maxResults || this.DEFAULT_MAX_RESULTS,
        },
      };

      const recommendationResult = await RecommendationEngine.generateRecommendations(recommendationRequest);

      // Step 6: Enhance recommendations with accessibility data
      console.log("🔍 Enhancing recommendations with accessibility data...");
      const enhancedRecommendations = await AccessibilityEnhancement.enhanceRecommendations(
        recommendationResult.recommendations,
        request.userId
      );

      // Get accessibility summary for metadata
      const accessibilitySummary = await AccessibilityEnhancement.getAccessibilitySummary(enhancedRecommendations);

      // Step 7: Cache the enhanced results
      await this.cacheRecommendations(
        cacheKey,
        recommendationResult.recommendations, // Cache original recommendations to avoid schema changes
        candidatePlaces.length,
        request.userId,
        request.location
      );

      const executionTime = Date.now() - startTime;

      // Step 8: Return enhanced response
      return {
        recommendations: enhancedRecommendations,
        metadata: {
          fromCache: false,
          cacheKey,
          executionTime,
          userProfileAge: profileAge,
          totalCandidates: candidatePlaces.length,
          userStats: {
            totalVisits: userProfile.totalVisits,
            profileCompleteness: this.calculateProfileCompleteness(userProfile),
            topCategories: recommendationResult.metadata.userProfileStats.topCategories,
            recommendationHistory: await this.getRecommendationHistory(request.userId),
          },
          accessibilitySummary,
        },
        debug: {
          profileUpdateNeeded,
          searchParams: request,
          cacheHit: false,
          candidatesSources: await this.identifyCandidateSources(request),
          accessibilityEnhanced: true,
        },
      };

    } catch (error) {
      console.error("Error in recommendation orchestration:", error);
      throw new Error(`Recommendation orchestration failed: ${(error as Error).message}`);
    }
  }

  /**
   * Process user feedback on recommendations
   */
  static async processFeedback(feedback: FeedbackRequest): Promise<void> {
    try {
      console.log(`Processing feedback: ${feedback.action} for place ${feedback.placeId}`);

      // Step 1: Record the feedback
      const feedbackRecord = new RecommendationFeedback({
        userId: feedback.userId,
        placeId: feedback.placeId,
        placeName: "Unknown Place", // Would be filled from place details
        placeTypes: [],
        action: feedback.action,
        feedback: {
          explicit: feedback.explicitFeedback || {},
          implicit: {
            dwellTime: feedback.context?.dwellTime,
            clickDepth: feedback.context?.clickDepth,
          },
        },
        context: {
          userLocation: {
            type: "Point",
            coordinates: [0, 0], // Would be filled from request
          },
          timestamp: new Date(),
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
          deviceType: "mobile",
          sessionId: feedback.context?.sessionId,
        },
        metadata: {},
      });

      await feedbackRecord.save();

      // Step 2: Update user profile with feedback
      await UserProfileService.incorporateFeedback(feedback.userId, feedbackRecord);

      // Step 3: Invalidate relevant caches
      await this.invalidateUserCaches(feedback.userId);

      console.log(`Feedback processed successfully for user ${feedback.userId}`);

    } catch (error) {
      console.error("Error processing feedback:", error);
      throw new Error(`Feedback processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get recommendation analytics for a user
   */
  static async getRecommendationAnalytics(userId: string): Promise<{
    totalRecommendations: number;
    cachingEfficiency: number;
    averageExecutionTime: number;
    feedbackStats: {
      totalFeedback: number;
      positiveRate: number;
      engagementRate: number;
    };
    profileStats: {
      completeness: number;
      lastUpdated: Date;
      totalVisits: number;
      categoryDiversity: number;
    };
  }> {
    try {
      // Get user profile
      const userProfile = await UserProfileService.getOrCreateProfile(userId);
      
      if (!userProfile) {
        throw new Error("User profile not found");
      }

      // Get basic statistics
      const cacheCount = await RecommendationCache.countDocuments({ userId });
      const feedbackCount = await RecommendationFeedback.countDocuments({ userId });

      return {
        totalRecommendations: cacheCount,
        cachingEfficiency: 0.75, // Placeholder
        averageExecutionTime: 1500, // Placeholder
        feedbackStats: {
          totalFeedback: feedbackCount,
          positiveRate: 0.6, // Placeholder
          engagementRate: 0.8, // Placeholder
        },
        profileStats: {
          completeness: this.calculateProfileCompleteness(userProfile),
          lastUpdated: userProfile.lastUpdated,
          totalVisits: userProfile.totalVisits,
          categoryDiversity: userProfile.categoryPreferences.size,
        },
      };

    } catch (error) {
      console.error("Error getting recommendation analytics:", error);
      throw new Error(`Analytics retrieval failed: ${(error as Error).message}`);
    }
  }

  // Private helper methods

  /**
   * Generate cache key for request
   */
  private static generateCacheKey(request: OrchestrationRequest): string {
    const { latitude, longitude } = request.location;
    const roundedLat = Math.round(latitude * 1000) / 1000; // ~100m precision
    const roundedLng = Math.round(longitude * 1000) / 1000;
    
    const radius = request.searchRadius || this.DEFAULT_SEARCH_RADIUS;
    const maxResults = request.maxResults || this.DEFAULT_MAX_RESULTS;
    const categories = (request.categories || []).sort().join(",");
    const query = request.searchQuery || "";
    
    return `rec_${request.userId}_${roundedLat}_${roundedLng}_${radius}_${maxResults}_${categories}_${query}`;
  }

  /**
   * Get candidate places from multiple sources
   */
  private static async getCandidatePlaces(
    request: OrchestrationRequest,
    userProfile: IUserProfile
  ): Promise<GooglePlaceBasic[]> {
    const { location, searchRadius = this.DEFAULT_SEARCH_RADIUS } = request;
    
    let candidatePlaces: GooglePlaceBasic[] = [];

    try {
      // Source 1: Text search if query provided
      if (request.searchQuery) {
        const textSearchPlaces = await GooglePlacesService.searchByText({
          query: request.searchQuery,
          location,
          radius: searchRadius,
          maxResults: 50,
        });
        
        candidatePlaces.push(...textSearchPlaces);
      }

      // Source 2: Nearby search
      const nearbyPlaces = await GooglePlacesService.searchNearby({
        location,
        radius: searchRadius,
        types: request.categories,
        maxResults: 100,
      });
      
      candidatePlaces.push(...nearbyPlaces);

      // Remove duplicates based on placeId
      const uniquePlaces = candidatePlaces.reduce((acc, place) => {
        if (!acc.some(p => p.placeId === place.placeId)) {
          acc.push(place);
        }
        return acc;
      }, [] as GooglePlaceBasic[]);

      // Limit to max candidates
      return uniquePlaces.slice(0, this.MAX_CANDIDATE_PLACES);

    } catch (error) {
      console.error("Error getting candidate places:", error);
      // Return any partial results
      return candidatePlaces.slice(0, this.MAX_CANDIDATE_PLACES);
    }
  }

  /**
   * Cache recommendation results
   */
  private static async cacheRecommendations(
    cacheKey: string,
    recommendations: ScoredRecommendation[],
    totalCandidates: number,
    userId: string,
    location: { latitude: number; longitude: number }
  ): Promise<void> {
    try {
      // Delete existing cache entry
      await RecommendationCache.deleteOne({ cacheKey });

      // Transform recommendations to cache format
      const cacheRecommendations = recommendations.map(rec => ({
        placeId: rec.place.placeId,
        placeName: rec.place.name,
        placeTypes: rec.place.types,
        location: {
          type: "Point",
          coordinates: [rec.place.location.longitude, rec.place.location.latitude],
        },
        score: rec.score,
        reasoning: rec.reasoning,
        googlePlaceData: {
          rating: rec.place.rating,
          priceLevel: rec.place.priceLevel,
          vicinity: rec.place.vicinity,
        },
      }));

      // Create new cache entry
      const cacheEntry = new RecommendationCache({
        userId,
        cacheKey,
        recommendations: cacheRecommendations,
        requestContext: {
          userLocation: {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
          },
          radius: 5000,
          timestamp: new Date(),
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
        },
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        hitCount: 1,
        lastAccessed: new Date(),
      });

      await cacheEntry.save();
      console.log(`Cached ${recommendations.length} recommendations with key: ${cacheKey}`);

    } catch (error) {
      console.error("Error caching recommendations:", error);
      // Don't throw - caching failures shouldn't break the flow
    }
  }

  /**
   * Calculate profile completeness score
   */
  private static calculateProfileCompleteness(userProfile: IUserProfile): number {
    let score = 0;
    let maxScore = 0;

    // Categories (40% weight)
    maxScore += 0.4;
    if (userProfile.categoryPreferences.size > 0) {
      score += Math.min(0.4, userProfile.categoryPreferences.size / 10 * 0.4);
    }

    // Location preferences (30% weight)
    maxScore += 0.3;
    if (userProfile.locationPreferences.frequentAreas.length > 0) {
      score += Math.min(0.3, userProfile.locationPreferences.frequentAreas.length / 5 * 0.3);
    }

    // Temporal patterns (20% weight)
    maxScore += 0.2;
    const hourActivity = userProfile.temporalPreferences.hourOfDay.filter(h => h > 0).length;
    if (hourActivity > 0) {
      score += Math.min(0.2, hourActivity / 24 * 0.2);
    }

    // Visit history (10% weight)
    maxScore += 0.1;
    if (userProfile.totalVisits > 0) {
      score += Math.min(0.1, userProfile.totalVisits / 50 * 0.1);
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Get recommendation history count
   */
  private static async getRecommendationHistory(userId: string): Promise<number> {
    try {
      const count = await RecommendationCache.countDocuments({ userId });
      return count;
    } catch (error) {
      console.error("Error getting recommendation history:", error);
      return 0;
    }
  }

  /**
   * Identify candidate sources for debugging
   */
  private static async identifyCandidateSources(request: OrchestrationRequest): Promise<string[]> {
    const sources: string[] = [];
    
    if (request.searchQuery) sources.push("text_search");
    if (request.categories && request.categories.length > 0) sources.push("category_filter");
    sources.push("nearby_search");
    
    return sources;
  }

  /**
   * Invalidate caches for a user
   */
  private static async invalidateUserCaches(userId: string): Promise<void> {
    try {
      await RecommendationCache.deleteMany({ userId });
      console.log(`Invalidated caches for user ${userId}`);
    } catch (error) {
      console.error("Error invalidating caches:", error);
    }
  }

  /**
   * Health check for the recommendation system
   */
  static async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    services: Record<string, boolean>;
    metrics: {
      activeCacheEntries: number;
      totalUsers: number;
      avgResponseTime: number;
    };
  }> {
    const services: Record<string, boolean> = {};
    
    try {
      // Check database connections
      const cacheCount = await RecommendationCache.countDocuments();
      services.database = true;
      services.googlePlaces = true; // Assume healthy for now
      
      // Get basic metrics
      const metrics = {
        activeCacheEntries: cacheCount,
        totalUsers: await RecommendationCache.distinct("userId").then(users => users.length),
        avgResponseTime: 0, // Could be calculated from cache metadata
      };

      const healthyServices = Object.values(services).filter(Boolean).length;
      const totalServices = Object.keys(services).length;
      
      let status: "healthy" | "degraded" | "unhealthy";
      if (healthyServices === totalServices) {
        status = "healthy";
      } else if (healthyServices > totalServices / 2) {
        status = "degraded";
      } else {
        status = "unhealthy";
      }

      return { status, services, metrics };

    } catch (error) {
      console.error("Health check failed:", error);
      return {
        status: "unhealthy",
        services,
        metrics: { activeCacheEntries: 0, totalUsers: 0, avgResponseTime: 0 },
      };
    }
  }
} 