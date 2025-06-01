import { API_URL } from "@/constants/api";
import apiService from "./api.service";
import {
  RecommendationRequest,
  RecommendationResponse,
  RecommendationFeedback,
  RecommendationAnalytics,
  RecommendationHistoryResponse,
  ApiResponse,
  RecommendationLocation,
  FeedbackAction,
  DeviceType,
  RecommendationPreferences,
} from "@/types/recommendation.types";

/**
 * Get personalized recommendations for a user
 *
 * @param params Recommendation request parameters
 * @returns Promise that resolves to recommendation response or null if failed
 */
export const getRecommendations = async (
  params: {
    userId: string;
    location: RecommendationLocation;
    searchRadius?: number;
    searchQuery?: string;
    categories?: string[];
    maxResults?: number;
    forceRefresh?: boolean;
    deviceType?: DeviceType;
    sessionId?: string;
    preferences?: RecommendationPreferences;
  }
): Promise<RecommendationResponse | null> => {
  try {
    console.log(
      "🎯 Recommendation Service: getRecommendations called with params:",
      params
    );

    if (!params.userId) {
      console.warn("Cannot get recommendations: User ID not provided");
      return null;
    }

    // Build query parameters
    const queryParams = new URLSearchParams({
      latitude: params.location.latitude.toString(),
      longitude: params.location.longitude.toString(),
    });

    // Add optional parameters
    if (params.searchRadius) {
      queryParams.append("radius", params.searchRadius.toString());
    }
    if (params.searchQuery) {
      queryParams.append("searchQuery", params.searchQuery);
    }
    if (params.categories && params.categories.length > 0) {
      queryParams.append("categories", params.categories.join(","));
    }
    if (params.maxResults) {
      queryParams.append("maxResults", params.maxResults.toString());
    }
    if (params.forceRefresh) {
      queryParams.append("forceRefresh", "true");
    }
    if (params.deviceType) {
      queryParams.append("deviceType", params.deviceType);
    }
    if (params.sessionId) {
      queryParams.append("sessionId", params.sessionId);
    }

    // Add preference parameters
    if (params.preferences) {
      if (params.preferences.diversityBoost !== undefined) {
        queryParams.append("diversityBoost", params.preferences.diversityBoost.toString());
      }
      if (params.preferences.qualityWeight !== undefined) {
        queryParams.append("qualityWeight", params.preferences.qualityWeight.toString());
      }
      if (params.preferences.temporalWeight !== undefined) {
        queryParams.append("temporalWeight", params.preferences.temporalWeight.toString());
      }
      if (params.preferences.locationWeight !== undefined) {
        queryParams.append("locationWeight", params.preferences.locationWeight.toString());
      }
      if (params.preferences.includeExplanations !== undefined) {
        queryParams.append("includeExplanations", params.preferences.includeExplanations.toString());
      }
    }

    const url = `${API_URL}/api/recommendations/user/${params.userId}?${queryParams.toString()}`;
    console.log("🎯 Recommendation Service: Making API call to:", url);

    const response = await apiService.get(url);

    console.log(
      "🎯 Recommendation Service: API call successful, response:",
      response.data
    );

    // The backend returns { success: true, data: RecommendationResponse }
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      console.warn("🎯 Recommendation Service: Unexpected response format:", response.data);
      return null;
    }
  } catch (error) {
    console.error("🎯 Recommendation Service: API call failed:", error);
    // Log more details about the error
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as any;
      console.error("🎯 Response status:", axiosError.response?.status);
      console.error("🎯 Response data:", axiosError.response?.data);
    }
    return null;
  }
};

/**
 * Record feedback for a recommendation
 *
 * @param feedbackData Complete feedback data structure
 * @returns Promise that resolves to feedback ID or null if failed
 */
export const recordRecommendationFeedback = async (
  feedbackData: RecommendationFeedback
): Promise<string | null> => {
  try {
    console.log(
      "🎯 Recommendation Service: recordRecommendationFeedback called with data:",
      feedbackData
    );

    if (!feedbackData.userId) {
      console.warn("Cannot record feedback: User ID not provided");
      return null;
    }

    const url = `${API_URL}/api/recommendations/feedback`;
    console.log("🎯 Recommendation Service: Making API call to:", url);

    const response = await apiService.post(url, feedbackData);

    console.log(
      "🎯 Recommendation Service: Feedback API call successful, response:",
      response.data
    );

    return response.data?.feedbackId || null;
  } catch (error) {
    console.error("🎯 Recommendation Service: Feedback API call failed:", error);
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as any;
      console.error("🎯 Response status:", axiosError.response?.status);
      console.error("🎯 Response data:", axiosError.response?.data);
    }
    return null;
  }
};

/**
 * Simple feedback recording for basic interactions (like/dislike)
 *
 * @param userId User ID
 * @param placeId Place ID
 * @param placeName Place name
 * @param placeTypes Place types array
 * @param action Feedback action
 * @param userLocation Current user location
 * @param sessionId Optional session ID
 * @returns Promise that resolves to feedback ID or null if failed
 */
export const recordSimpleFeedback = async (
  userId: string,
  placeId: string,
  placeName: string,
  placeTypes: string[],
  action: FeedbackAction,
  userLocation: RecommendationLocation,
  sessionId?: string
): Promise<string | null> => {
  try {
    const now = new Date();
    const feedbackData: RecommendationFeedback = {
      userId,
      placeId,
      placeName,
      placeTypes,
      action,
      feedback: {
        explicit: action === "dismissed" ? { liked: false } : action === "saved" ? { liked: true } : undefined,
        implicit: {
          sessionPosition: 1, // Will be set by calling component
        },
      },
      context: {
        userLocation,
        timestamp: now.toISOString(),
        timeOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
        deviceType: "mobile", // Default to mobile for React Native
        sessionId,
      },
    };

    return await recordRecommendationFeedback(feedbackData);
  } catch (error) {
    console.error("🎯 Recommendation Service: Simple feedback failed:", error);
    return null;
  }
};

/**
 * Get recommendation analytics for a user
 *
 * @param userId User ID
 * @returns Promise that resolves to analytics data or null if failed
 */
export const getRecommendationAnalytics = async (
  userId: string
): Promise<RecommendationAnalytics | null> => {
  try {
    console.log(`🎯 Recommendation Service: Getting analytics for user ${userId}`);

    if (!userId) {
      console.warn("Cannot get analytics: User ID not provided");
      return null;
    }

    const url = `${API_URL}/api/recommendations/user/${userId}/analytics`;
    console.log("🎯 Recommendation Service: Making API call to:", url);

    const response = await apiService.get(url);

    console.log(
      "🎯 Recommendation Service: Analytics API call successful, response:",
      response.data
    );

    // The backend returns { success: true, data: RecommendationAnalytics }
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      console.warn("🎯 Recommendation Service: Unexpected analytics response format:", response.data);
      return null;
    }
  } catch (error) {
    console.error("🎯 Recommendation Service: Analytics API call failed:", error);
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as any;
      console.error("🎯 Response status:", axiosError.response?.status);
      console.error("🎯 Response data:", axiosError.response?.data);
    }
    return null;
  }
};

/**
 * Get recommendation history for a user
 *
 * @param userId User ID
 * @param limit Maximum number of history entries to return (default: 20)
 * @param offset Number of entries to skip (default: 0)
 * @param includeExpired Include expired cache entries (default: false)
 * @returns Promise that resolves to history response or null if failed
 */
export const getRecommendationHistory = async (
  userId: string,
  limit = 20,
  offset = 0,
  includeExpired = false
): Promise<RecommendationHistoryResponse | null> => {
  try {
    console.log(`🎯 Recommendation Service: Getting history for user ${userId}`);

    if (!userId) {
      console.warn("Cannot get history: User ID not provided");
      return null;
    }

    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      includeExpired: includeExpired.toString(),
    });

    const url = `${API_URL}/api/recommendations/user/${userId}/history?${queryParams.toString()}`;
    console.log("🎯 Recommendation Service: Making API call to:", url);

    const response = await apiService.get(url);

    console.log(
      "🎯 Recommendation Service: History API call successful, response:",
      response.data
    );

    // The backend returns { success: true, data: RecommendationHistoryResponse }
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      console.warn("🎯 Recommendation Service: Unexpected history response format:", response.data);
      return null;
    }
  } catch (error) {
    console.error("🎯 Recommendation Service: History API call failed:", error);
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as any;
      console.error("🎯 Response status:", axiosError.response?.status);
      console.error("🎯 Response data:", axiosError.response?.data);
    }
    return null;
  }
};

/**
 * Clear recommendation cache for a user
 *
 * @param userId User ID
 * @returns Promise that resolves to number of deleted entries or null if failed
 */
export const clearRecommendationCache = async (
  userId: string
): Promise<number | null> => {
  try {
    console.log(`🎯 Recommendation Service: Clearing cache for user ${userId}`);

    if (!userId) {
      console.warn("Cannot clear cache: User ID not provided");
      return null;
    }

    const url = `${API_URL}/api/recommendations/user/${userId}/cache`;
    console.log("🎯 Recommendation Service: Making API call to:", url);

    const response = await apiService.delete(url);

    console.log(
      "🎯 Recommendation Service: Cache clear API call successful, response:",
      response.data
    );

    return response.data?.deletedCount || 0;
  } catch (error) {
    console.error("🎯 Recommendation Service: Cache clear API call failed:", error);
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as any;
      console.error("🎯 Response status:", axiosError.response?.status);
      console.error("🎯 Response data:", axiosError.response?.data);
    }
    return null;
  }
};

// Default export with all methods
export default {
  getRecommendations,
  recordRecommendationFeedback,
  recordSimpleFeedback,
  getRecommendationAnalytics,
  getRecommendationHistory,
  clearRecommendationCache,
}; 