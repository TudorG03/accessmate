import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import mongoose from "mongoose";
import { RecommendationOrchestrationService } from "../../services/recommendation-orchestration.service.ts";
import RecommendationCache from "../../models/recommendation/recommendation-cache.mongo.ts";
import RecommendationFeedback from "../../models/recommendation/recommendation-feedback.mongo.ts";

// Get personalized recommendations for a user
export const getRecommendations = async (
  ctx: RouterContext<"/user/:userId">
) => {
  try {
    const userId = ctx.params.userId;

    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = { message: "User ID is required" };
      return;
    }

    // Extract query parameters
    const url = ctx.request.url;
    const latitude = parseFloat(url.searchParams.get("latitude") || "0");
    const longitude = parseFloat(url.searchParams.get("longitude") || "0");
    const radius = parseInt(url.searchParams.get("radius") || "5000");
    const maxResults = parseInt(url.searchParams.get("maxResults") || "20");
    const searchQuery = url.searchParams.get("searchQuery") || undefined;
    const categories = url.searchParams.get("categories")?.split(",") || undefined;
    const forceRefresh = url.searchParams.get("forceRefresh") === "true";
    const deviceType = url.searchParams.get("deviceType") as "mobile" | "tablet" | "desktop" | undefined;
    const sessionId = url.searchParams.get("sessionId") || undefined;

    // Validate required parameters
    if (!latitude || !longitude) {
      ctx.response.status = 400;
      ctx.response.body = { 
        message: "Location parameters (latitude, longitude) are required" 
      };
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      ctx.response.status = 400;
      ctx.response.body = { 
        message: "Invalid latitude or longitude values" 
      };
      return;
    }

    // Validate radius
    if (radius < 100 || radius > 50000) {
      ctx.response.status = 400;
      ctx.response.body = { 
        message: "Radius must be between 100 and 50,000 meters" 
      };
      return;
    }

    // Validate maxResults
    if (maxResults < 1 || maxResults > 50) {
      ctx.response.status = 400;
      ctx.response.body = { 
        message: "maxResults must be between 1 and 50" 
      };
      return;
    }

    // Parse optional preference parameters
    const diversityBoost = parseFloat(url.searchParams.get("diversityBoost") || "0.1");
    const qualityWeight = parseFloat(url.searchParams.get("qualityWeight") || "0.3");
    const temporalWeight = parseFloat(url.searchParams.get("temporalWeight") || "0.2");
    const locationWeight = parseFloat(url.searchParams.get("locationWeight") || "0.3");
    const includeExplanations = url.searchParams.get("includeExplanations") === "true";

    // Build orchestration request
    const orchestrationRequest = {
      userId,
      location: { latitude, longitude },
      searchRadius: radius,
      searchQuery,
      categories,
      maxResults,
      forceRefresh,
      deviceType,
      sessionId,
      preferences: {
        diversityBoost,
        qualityWeight,
        temporalWeight,
        locationWeight,
        includeExplanations,
      },
    };

    console.log(`Generating recommendations for user ${userId} at (${latitude}, ${longitude})`);

    // Generate recommendations using orchestration service
    const result = await RecommendationOrchestrationService.generateRecommendations(
      orchestrationRequest
    );

    // Transform ScoredRecommendation[] to match frontend Recommendation interface
    const transformedRecommendations = result.recommendations.map(rec => ({
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
        openingHours: undefined, // Not available in basic place data
      },
      scoreBreakdown: rec.scoreBreakdown,
      metadata: rec.metadata,
      accessibility: rec.accessibility, // Include accessibility data from enhancement service
    }));

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: {
        ...result,
        recommendations: transformedRecommendations,
      },
      requestParams: {
        userId,
        location: { latitude, longitude },
        radius,
        maxResults,
        forceRefresh,
      },
    };

  } catch (error) {
    console.error("Error generating recommendations:", error);
    ctx.response.status = 500;
    ctx.response.body = { 
      success: false,
      message: "Failed to generate recommendations",
      error: (error as Error).message 
    };
  }
};

// Get recommendation analytics for a user
export const getRecommendationAnalytics = async (
  ctx: RouterContext<"/user/:userId/analytics">
) => {
  try {
    const userId = ctx.params.userId;

    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = { message: "User ID is required" };
      return;
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Invalid user ID format" };
      return;
    }

    console.log(`Getting analytics for user ${userId}`);

    const analytics = await RecommendationOrchestrationService.getRecommendationAnalytics(userId);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: analytics,
      userId,
    };

  } catch (error) {
    console.error("Error getting recommendation analytics:", error);
    ctx.response.status = 500;
    ctx.response.body = { 
      success: false,
      message: "Failed to get recommendation analytics",
      error: (error as Error).message 
    };
  }
};

// Get user's recommendation history
export const getUserRecommendationHistory = async (
  ctx: RouterContext<"/user/:userId/history">
) => {
  try {
    const userId = ctx.params.userId;

    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = { message: "User ID is required" };
      return;
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Invalid user ID format" };
      return;
    }

    const url = ctx.request.url;
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const includeExpired = url.searchParams.get("includeExpired") === "true";

    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      ctx.response.status = 400;
      ctx.response.body = { 
        message: "Limit must be between 1 and 100" 
      };
      return;
    }

    if (offset < 0) {
      ctx.response.status = 400;
      ctx.response.body = { 
        message: "Offset must be non-negative" 
      };
      return;
    }

    // Convert string userId to MongoDB ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Build query
    const query: any = { userId: userObjectId };
    if (!includeExpired) {
      query.expiresAt = { $gt: new Date() };
    }

    console.log(`Getting recommendation history for user ${userId}`);

    // Get recommendation history
    const history = await RecommendationCache.find(query)
      .sort({ generatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .select('-recommendations.googlePlaceData'); // Exclude detailed place data for performance

    const total = await RecommendationCache.countDocuments(query);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: {
        history,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      userId,
    };

  } catch (error) {
    console.error("Error getting recommendation history:", error);
    ctx.response.status = 500;
    ctx.response.body = { 
      success: false,
      message: "Failed to get recommendation history",
      error: (error as Error).message 
    };
  }
};

// Record recommendation feedback
export const recordRecommendationFeedback = async (ctx: Context) => {
  try {
    if (!ctx.request.hasBody) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Request body is required" };
      return;
    }

    const body = await ctx.request.body.json();
    console.log("Recording recommendation feedback:", body);

    const {
      userId,
      placeId,
      placeName,
      placeTypes,
      action,
      feedback,
      context,
      outcome,
      metadata,
      recommendationId,
    } = body;

    // Validate required fields
    if (!userId || !placeId || !placeName || !placeTypes || !action || !context) {
      ctx.response.status = 400;
      ctx.response.body = { 
        message: "Missing required fields: userId, placeId, placeName, placeTypes, action, context" 
      };
      return;
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Invalid user ID format" };
      return;
    }

    // Validate action type
    const validActions = ["viewed", "visited", "dismissed", "saved", "shared", "clicked"];
    if (!validActions.includes(action)) {
      ctx.response.status = 400;
      ctx.response.body = { 
        message: `Invalid action. Must be one of: ${validActions.join(", ")}` 
      };
      return;
    }

    // Validate context structure
    if (!context.userLocation || !context.timestamp || 
        typeof context.timeOfDay !== 'number' || typeof context.dayOfWeek !== 'number') {
      ctx.response.status = 400;
      ctx.response.body = { 
        message: "Invalid context structure. Required: userLocation, timestamp, timeOfDay, dayOfWeek" 
      };
      return;
    }

    // Convert userId to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // Convert recommendationId if provided
    let recommendationObjectId;
    if (recommendationId) {
      if (!mongoose.Types.ObjectId.isValid(recommendationId)) {
        ctx.response.status = 400;
        ctx.response.body = { message: "Invalid recommendation ID format" };
        return;
      }
      recommendationObjectId = new mongoose.Types.ObjectId(recommendationId);
    }

    // Create feedback document
    const feedbackDoc = new RecommendationFeedback({
      userId: userObjectId,
      recommendationId: recommendationObjectId,
      placeId,
      placeName,
      placeTypes,
      action,
      feedback: {
        explicit: feedback?.explicit || {},
        implicit: feedback?.implicit || {},
      },
      context: {
        userLocation: {
          type: "Point",
          coordinates: [context.userLocation.longitude, context.userLocation.latitude],
        },
        timestamp: new Date(context.timestamp),
        timeOfDay: context.timeOfDay,
        dayOfWeek: context.dayOfWeek,
        deviceType: context.deviceType,
        sessionId: context.sessionId,
      },
      outcome: outcome || {},
      metadata: {
        ...metadata,
        modelVersion: "1.0.0",
      },
    });

    await feedbackDoc.save();

    ctx.response.status = 201;
    ctx.response.body = {
      success: true,
      message: "Recommendation feedback recorded successfully",
      feedbackId: feedbackDoc._id,
    };

  } catch (error) {
    console.error("Error recording recommendation feedback:", error);
    ctx.response.status = 500;
    ctx.response.body = { 
      success: false,
      message: "Failed to record recommendation feedback",
      error: (error as Error).message 
    };
  }
};

// Clear recommendation cache for a user
export const clearRecommendationCache = async (
  ctx: RouterContext<"/user/:userId/cache">
) => {
  try {
    const userId = ctx.params.userId;

    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = { message: "User ID is required" };
      return;
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Invalid user ID format" };
      return;
    }

    // Convert string userId to MongoDB ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    console.log(`Clearing recommendation cache for user ${userId}`);

    // Delete all cached recommendations for the user
    const result = await RecommendationCache.deleteMany({ userId: userObjectId });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Recommendation cache cleared successfully",
      deletedCount: result.deletedCount,
      userId,
    };

  } catch (error) {
    console.error("Error clearing recommendation cache:", error);
    ctx.response.status = 500;
    ctx.response.body = { 
      success: false,
      message: "Failed to clear recommendation cache",
      error: (error as Error).message 
    };
  }
}; 