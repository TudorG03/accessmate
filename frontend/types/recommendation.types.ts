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
 * Feedback action types
 */
export type FeedbackAction = "viewed" | "visited" | "dismissed" | "saved" | "shared" | "clicked";

/**
 * Explicit feedback data
 */
export interface ExplicitFeedback {
  rating?: number; // 1-5 star rating
  liked?: boolean; // thumbs up/down
  comment?: string; // user comment
}

/**
 * Implicit feedback data
 */
export interface ImplicitFeedback {
  dwellTime?: number; // time spent viewing recommendation (seconds)
  clickDepth?: number; // how many details they explored
  sessionPosition?: number; // position in recommendation list
}

/**
 * Feedback context information
 */
export interface FeedbackContext {
  userLocation: RecommendationLocation;
  timestamp: string; // ISO string
  timeOfDay: number; // hour of day (0-23)
  dayOfWeek: number; // day of week (0-6)
  deviceType?: DeviceType;
  sessionId?: string;
}

/**
 * Actual visit outcome data
 */
export interface ActualVisit {
  confirmed: boolean; // did they actually visit the place
  visitDuration?: number; // minutes spent at location
  followUpActions?: string[]; // what they did after (review, photo, etc.)
}

/**
 * Satisfaction outcome data
 */
export interface Satisfaction {
  score: number; // 1-5 satisfaction with recommendation
  wouldRecommend?: boolean; // would recommend to others
}

/**
 * Feedback outcome data
 */
export interface FeedbackOutcome {
  actualVisit?: ActualVisit;
  satisfaction?: Satisfaction;
}

/**
 * Feedback metadata
 */
export interface FeedbackMetadata {
  recommendationScore?: number; // original ML score
  recommendationReasoning?: string[]; // why it was recommended
  userProfileVersion?: number; // version of user profile when recommended
  modelVersion?: string; // ML model version used
}

/**
 * Complete feedback data structure
 */
export interface RecommendationFeedback {
  userId: string;
  placeId: string;
  placeName: string;
  placeTypes: string[];
  action: FeedbackAction;
  feedback?: {
    explicit?: ExplicitFeedback;
    implicit?: ImplicitFeedback;
  };
  context: FeedbackContext;
  outcome?: FeedbackOutcome;
  metadata?: FeedbackMetadata;
  recommendationId?: string; // reference to cached recommendation
}

/**
 * Analytics response structure
 */
export interface RecommendationAnalytics {
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
  onLike: (placeId: string) => void;
  onDislike: (placeId: string) => void;
  onPress: (placeId: string) => void;
  loading?: boolean;
}

export interface RecommendationFiltersProps {
  categories?: string[];
  radius: number;
  onCategoriesChange: (categories: string[]) => void;
  onRadiusChange: (radius: number) => void;
} 