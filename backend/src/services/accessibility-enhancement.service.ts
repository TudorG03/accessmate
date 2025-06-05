import Review from "../models/review/review.mongo.ts";
import User from "../models/auth/auth.mongo.ts";
import { ScoredRecommendation } from "./recommendation-engine.service.ts";
import { AccessibilityCache } from "./accessibility-cache.service.ts";

export type FeatureStatus = 'available' | 'not_available' | 'unknown';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export interface AccessibilityFeatures {
  ramp: FeatureStatus;
  wideDoors: FeatureStatus;
  elevator: FeatureStatus;
  adaptedToilets: FeatureStatus;
}

export interface AccessibilityData {
  hasData: boolean;
  reviewCount: number;
  features: AccessibilityFeatures;
  matchesUserNeeds: string[]; // Features user needs that are available
  confidence: ConfidenceLevel;
  averageRating: number;
  lastReviewDate?: Date;
}

export interface EnhancedRecommendation extends ScoredRecommendation {
  accessibility?: AccessibilityData;
}

export interface UserAccessibilityPreferences {
  wheelchairAccessible?: boolean;
  hasElevator?: boolean;
  hasRamp?: boolean;
  hasAccessibleBathroom?: boolean;
  hasWideDoors?: boolean;
}

export class AccessibilityEnhancement {
  private static readonly MAX_REVIEW_AGE_DAYS = 365; // Only consider reviews from last year
  private static readonly HIGH_CONFIDENCE_MIN_REVIEWS = 3;
  private static readonly MEDIUM_CONFIDENCE_MIN_REVIEWS = 2;
  private static readonly FEATURE_CONSENSUS_THRESHOLD = 0.6; // 60% agreement needed

  /**
   * Enhance recommendations with accessibility data from user reviews
   */
  static async enhanceRecommendations(
    recommendations: ScoredRecommendation[],
    userId: string
  ): Promise<EnhancedRecommendation[]> {
    try {
      // Get user's accessibility preferences
      const userPreferences = await this.getUserAccessibilityPreferences(userId);
      
      console.log(`👤 User accessibility preferences for ${userId}:`, JSON.stringify(userPreferences, null, 2));
      
      // If user has no accessibility preferences, return recommendations as-is
      if (!userPreferences || !this.hasAccessibilityNeeds(userPreferences)) {
        console.log(`⚠️ User has no accessibility needs, skipping accessibility enhancement`);
        return recommendations.map(rec => ({ ...rec }));
      }

      console.log(`🔍 Enhancing ${recommendations.length} recommendations with accessibility data`);

      // Enhance each recommendation with accessibility data
      const enhancedRecommendations: EnhancedRecommendation[] = [];
      
      for (const recommendation of recommendations) {
                 try {
           const accessibilityData = await this.getAccessibilityData(
             recommendation.place,
             userPreferences,
             userId
           );
          
          enhancedRecommendations.push({
            ...recommendation,
            accessibility: accessibilityData
          });
        } catch (error) {
          console.error(`Error enhancing recommendation for ${recommendation.place.name}:`, error);
          // Return recommendation without accessibility data on error
          enhancedRecommendations.push({ ...recommendation });
        }
      }

      console.log(`✅ Successfully enhanced recommendations with accessibility data`);
      return enhancedRecommendations;

    } catch (error) {
      console.error("Error in accessibility enhancement:", error);
      // Return original recommendations on error to prevent breaking the flow
      return recommendations.map(rec => ({ ...rec }));
    }
  }

  /**
   * Get accessibility data for a specific place
   */
  private static async getAccessibilityData(
    place: any,
    userPreferences: UserAccessibilityPreferences,
    userId: string
  ): Promise<AccessibilityData> {
    // Check cache first
    const cached = AccessibilityCache.get(place.placeId, userId);
    if (cached) {
      return cached;
    }

    // Get reviews for this location
    const reviews = await this.getPlaceReviews(place);

    if (reviews.length === 0) {
      const result = this.createNoDataResult();
      // Cache the no-data result for a shorter time
      AccessibilityCache.set(place.placeId, userId, result);
      return result;
    }

    // Extract accessibility features from reviews
    const features = this.extractAccessibilityFeatures(reviews);
    
    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(reviews);
    
    // Find matches with user needs
    const matchesUserNeeds = this.findMatches(features, userPreferences);
    
    // Calculate average accessibility rating
    const averageRating = this.calculateAverageRating(reviews);
    
    // Get most recent review date
    const lastReviewDate = reviews.length > 0 ? 
      new Date(Math.max(...reviews.map((r: any) => new Date(r.createdAt).getTime()))) : 
      undefined;

    const result: AccessibilityData = {
      hasData: true,
      reviewCount: reviews.length,
      features,
      matchesUserNeeds,
      confidence,
      averageRating,
      lastReviewDate
    };

    // Cache the result
    AccessibilityCache.set(place.placeId, userId, result);

    return result;
  }

  /**
   * Get reviews for a specific place using Google Places API ID
   */
  private static async getPlaceReviews(place: any): Promise<any[]> {
    try {
      const oneYearAgo = new Date(Date.now() - this.MAX_REVIEW_AGE_DAYS * 24 * 60 * 60 * 1000);

      // Simple direct lookup by placeId - much faster and more accurate!
      const reviews = await Review.find({
        placeId: place.placeId,
        createdAt: { $gte: oneYearAgo }
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

      console.log(`🔍 Found ${reviews.length} reviews for place ${place.placeId} (${place.name || 'Unknown'})`);
      if (reviews.length > 0) {
        console.log(`   Sample review questions:`, JSON.stringify(reviews[0].questions, null, 2));
      }

      return reviews;
    } catch (error) {
      console.error("Error getting place reviews:", error);
      return [];
    }
  }

  /**
   * Extract accessibility features from reviews using consensus logic
   */
  private static extractAccessibilityFeatures(reviews: any[]): AccessibilityFeatures {
    const features: AccessibilityFeatures = {
      ramp: 'unknown',
      wideDoors: 'unknown',
      elevator: 'unknown',
      adaptedToilets: 'unknown'
    };

    // Count responses for each feature
    const featureCounts = {
      ramp: { positive: 0, negative: 0, total: 0 },
      wideDoors: { positive: 0, negative: 0, total: 0 },
      elevator: { positive: 0, negative: 0, total: 0 },
      adaptedToilets: { positive: 0, negative: 0, total: 0 }
    };

    reviews.forEach(review => {
      if (review.questions) {
        Object.keys(featureCounts).forEach(feature => {
          const value = review.questions[feature];
          if (value !== null && value !== undefined) {
            featureCounts[feature as keyof typeof featureCounts].total++;
            if (value === true) {
              featureCounts[feature as keyof typeof featureCounts].positive++;
            } else {
              featureCounts[feature as keyof typeof featureCounts].negative++;
            }
          }
        });
      }
    });

    // Determine feature status based on consensus
    Object.keys(features).forEach(feature => {
      const count = featureCounts[feature as keyof typeof featureCounts];
      if (count.total > 0) {
        const positiveRatio = count.positive / count.total;
        
        if (positiveRatio >= this.FEATURE_CONSENSUS_THRESHOLD) {
          features[feature as keyof AccessibilityFeatures] = 'available';
        } else if (positiveRatio <= (1 - this.FEATURE_CONSENSUS_THRESHOLD)) {
          features[feature as keyof AccessibilityFeatures] = 'not_available';
        } else {
          // Mixed reviews - keep as unknown
          features[feature as keyof AccessibilityFeatures] = 'unknown';
        }
      }
    });

    return features;
  }

  /**
   * Calculate confidence level based on data quality
   */
  private static calculateConfidence(reviews: any[]): ConfidenceLevel {
    if (reviews.length === 0) return 'none';
    
    if (reviews.length >= this.HIGH_CONFIDENCE_MIN_REVIEWS) {
      // Check if reviews are recent (within 6 months)
      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
      const recentReviews = reviews.filter(r => new Date(r.createdAt) > sixMonthsAgo);
      
      if (recentReviews.length >= 2) {
        return 'high';
      }
    }
    
    if (reviews.length >= this.MEDIUM_CONFIDENCE_MIN_REVIEWS) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Find features that match user's accessibility needs
   */
  private static findMatches(
    features: AccessibilityFeatures,
    userPreferences: UserAccessibilityPreferences
  ): string[] {
    const matches: string[] = [];

    console.log(`🎯 Matching features with user preferences:`);
    console.log(`   User preferences:`, JSON.stringify(userPreferences, null, 2));
    console.log(`   Available features:`, JSON.stringify(features, null, 2));

    // Check wheelchair accessibility (requires both ramp and wide doors)
    if (userPreferences.wheelchairAccessible && 
        features.ramp === 'available' && 
        features.wideDoors === 'available') {
      matches.push('wheelchair_accessible');
      console.log(`   ✅ Wheelchair accessible match found`);
    } else if (userPreferences.wheelchairAccessible) {
      console.log(`   ❌ Wheelchair accessible: ramp=${features.ramp}, wideDoors=${features.wideDoors}`);
    }

    // Check individual features
    if (userPreferences.hasElevator && features.elevator === 'available') {
      matches.push('elevator');
      console.log(`   ✅ Elevator match found`);
    } else if (userPreferences.hasElevator) {
      console.log(`   ❌ Elevator needed but status: ${features.elevator}`);
    }

    if (userPreferences.hasRamp && features.ramp === 'available') {
      matches.push('ramp');
      console.log(`   ✅ Ramp match found`);
    } else if (userPreferences.hasRamp) {
      console.log(`   ❌ Ramp needed but status: ${features.ramp}`);
    }

    if (userPreferences.hasAccessibleBathroom && features.adaptedToilets === 'available') {
      matches.push('accessible_bathroom');
      console.log(`   ✅ Accessible bathroom match found`);
    } else if (userPreferences.hasAccessibleBathroom) {
      console.log(`   ❌ Accessible bathroom needed but status: ${features.adaptedToilets}`);
    }

    if (userPreferences.hasWideDoors && features.wideDoors === 'available') {
      matches.push('wide_doors');
      console.log(`   ✅ Wide doors match found`);
    } else if (userPreferences.hasWideDoors) {
      console.log(`   ❌ Wide doors needed but status: ${features.wideDoors}`);
    }

    console.log(`   🏆 Total matches found: ${matches.length} - ${matches.join(', ')}`);
    return matches;
  }

  /**
   * Calculate average accessibility rating from reviews
   */
  private static calculateAverageRating(reviews: any[]): number {
    if (reviews.length === 0) return 0;
    
    const totalRating = reviews.reduce((sum, review) => {
      return sum + (review.accessibilityRating || 3); // Default to 3 if no rating
    }, 0);
    
    return totalRating / reviews.length;
  }

  /**
   * Get user's accessibility preferences from auth data
   */
  private static async getUserAccessibilityPreferences(userId: string): Promise<UserAccessibilityPreferences | null> {
    try {
      const user = await User.findById(userId).lean();
      return user?.preferences?.accessibilityRequirements || null;
    } catch (error) {
      console.error("Error getting user accessibility preferences:", error);
      return null;
    }
  }

  /**
   * Check if user has any accessibility needs
   */
  private static hasAccessibilityNeeds(preferences: UserAccessibilityPreferences): boolean {
    return !!(
      preferences.wheelchairAccessible ||
      preferences.hasElevator ||
      preferences.hasRamp ||
      preferences.hasAccessibleBathroom ||
      preferences.hasWideDoors
    );
  }

  /**
   * Create result for places with no accessibility data
   */
  private static createNoDataResult(): AccessibilityData {
    return {
      hasData: false,
      reviewCount: 0,
      features: {
        ramp: 'unknown',
        wideDoors: 'unknown',
        elevator: 'unknown',
        adaptedToilets: 'unknown'
      },
      matchesUserNeeds: [],
      confidence: 'none',
      averageRating: 0
    };
  }

  /**
   * Get accessibility summary for analytics
   */
  static async getAccessibilitySummary(recommendations: EnhancedRecommendation[]): Promise<{
    totalRecommendations: number;
    withAccessibilityData: number;
    highConfidenceData: number;
    averageAccessibilityRating: number;
    mostCommonFeatures: string[];
  }> {
    const withData = recommendations.filter(r => r.accessibility?.hasData);
    const highConfidence = withData.filter(r => r.accessibility?.confidence === 'high');
    
    const allRatings = withData
      .map(r => r.accessibility?.averageRating || 0)
      .filter(rating => rating > 0);
    
    const avgRating = allRatings.length > 0 ? 
      allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0;

    // Count feature availability
    const featureCounts: Record<string, number> = {};
    withData.forEach(r => {
      if (r.accessibility?.features) {
        Object.entries(r.accessibility.features).forEach(([feature, status]) => {
          if (status === 'available') {
            featureCounts[feature] = (featureCounts[feature] || 0) + 1;
          }
        });
      }
    });

    const mostCommonFeatures = Object.entries(featureCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([feature]) => feature);

    return {
      totalRecommendations: recommendations.length,
      withAccessibilityData: withData.length,
      highConfidenceData: highConfidence.length,
      averageAccessibilityRating: avgRating,
      mostCommonFeatures
    };
  }
} 