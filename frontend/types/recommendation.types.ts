/**
 * Location coordinates for recommendations
 */
export interface RecommendationLocation {
  latitude: number;
  longitude: number;
}

/**
 * Google Place data structure for recommendations
 */
export interface GooglePlaceData {
  rating?: number;
  priceLevel?: number;
  vicinity?: string;
  openingHours?: {
    openNow: boolean;
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
  };
}

/**
 * Score breakdown for a recommendation
 */
export interface RecommendationScoreBreakdown {
  categoryScore: number;
  locationScore: number;
  temporalScore: number;
  qualityScore: number;
  contextBonus: number;
  diversityBonus?: number;
}

/**
 * Metadata for a recommendation
 */
export interface RecommendationMetadata {
  distance: number;
  matchedCategories: string[];
  temporalCompatibility: number;
}

/**
 * Accessibility feature status
 */
export type AccessibilityFeatureStatus = 'available' | 'not_available' | 'unknown';

/**
 * Accessibility confidence levels
 */
export type AccessibilityConfidence = 'high' | 'medium' | 'low' | 'none';

/**
 * Accessibility features data
 */
export interface AccessibilityFeatures {
  ramp: AccessibilityFeatureStatus;
  wideDoors: AccessibilityFeatureStatus;
  elevator: AccessibilityFeatureStatus;
  adaptedToilets: AccessibilityFeatureStatus;
}

/**
 * Accessibility data for a recommendation
 */
export interface AccessibilityData {
  hasData: boolean;
  reviewCount: number;
  features: AccessibilityFeatures;
  matchesUserNeeds: string[]; // Features user needs that are available
  confidence: AccessibilityConfidence;
  averageRating: number;
  lastReviewDate?: string; // ISO string
}

/**
 * Individual recommendation item
 */
export interface Recommendation {
  placeId: string;
  placeName: string;
  placeTypes: string[];
  location: {
    type: string;
    coordinates: number[]; // [longitude, latitude]
  };
  score: number;
  reasoning: string[];
  googlePlaceData?: GooglePlaceData;
  scoreBreakdown?: RecommendationScoreBreakdown;
  metadata?: RecommendationMetadata;
  accessibility?: AccessibilityData; // NEW: Accessibility enhancement data
}

/**
 * User statistics for recommendations
 */
export interface RecommendationUserStats {
  totalVisits: number;
  profileCompleteness: number;
  topCategories: string[];
  recommendationHistory: number;
}

/**
 * Metadata for recommendation response
 */
export interface RecommendationResponseMetadata {
  fromCache: boolean;
  cacheKey: string;
  executionTime: number;
  userProfileAge: number;
  totalCandidates: number;
  userStats: RecommendationUserStats;
}

/**
 * Debug information for recommendations
 */
export interface RecommendationDebugInfo {
  profileUpdateNeeded: boolean;
  searchParams: any;
  cacheHit: boolean;
  candidatesSources: any;
}

/**
 * Complete recommendation response from API
 */
export interface RecommendationResponse {
  recommendations: Recommendation[];
  metadata: RecommendationResponseMetadata;
  debug?: RecommendationDebugInfo;
}

/**
 * User preferences for recommendations
 */
export interface RecommendationPreferences {
  diversityBoost?: number; // 0-1, default 0.1
  qualityWeight?: number; // 0-1, default 0.3
  temporalWeight?: number; // 0-1, default 0.2
  locationWeight?: number; // 0-1, default 0.3
  includeExplanations?: boolean; // default false
}

/**
 * Device types for context
 */
export type DeviceType = "mobile" | "tablet" | "desktop";

/**
 * Request parameters for getting recommendations
 */
export interface RecommendationRequest {
  userId: string;
  location: RecommendationLocation;
  searchRadius?: number; // meters, default 5000
  searchQuery?: string; // optional text search
  categories?: string[]; // optional category filters
  maxResults?: number; // default 20
  forceRefresh?: boolean; // bypass cache, default false
  deviceType?: DeviceType;
  sessionId?: string;
  preferences?: RecommendationPreferences;
}



/**
 * Analytics response structure
 */
export interface RecommendationAnalytics {
  totalRecommendations: number;
  cachingEfficiency: number;
  averageExecutionTime: number;
  profileStats: {
    completeness: number;
    lastUpdated: string; // ISO string
    totalVisits: number;
    categoryDiversity: number;
  };
}

/**
 * Recommendation history entry
 */
export interface RecommendationHistoryEntry {
  _id: string;
  cacheKey: string;
  generatedAt: string; // ISO string
  expiresAt: string; // ISO string
  hitCount: number;
  lastAccessed: string; // ISO string
  requestContext: {
    userLocation: {
      type: string;
      coordinates: number[]; // [longitude, latitude]
    };
    radius: number;
    timestamp: string; // ISO string
    timeOfDay: number;
    dayOfWeek: number;
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMetadata {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Recommendation history response
 */
export interface RecommendationHistoryResponse {
  history: RecommendationHistoryEntry[];
  pagination: PaginationMetadata;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Loading states for UI components
 */
export interface RecommendationLoadingState {
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
}

/**
 * Component props types
 */
export interface RecommendationCardProps {
  recommendation: Recommendation;
  onPress: (placeId: string) => void;
  loading?: boolean;
}

export interface RecommendationFiltersProps {
  categories?: string[];
  radius: number;
  onCategoriesChange: (categories: string[]) => void;
  onRadiusChange: (radius: number) => void;
} 