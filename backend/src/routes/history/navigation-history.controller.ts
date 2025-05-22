import NavigationHistory from "../../models/history/navigation-history.mongo.ts";
import mongoose from "mongoose";
import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";

// Add new navigation history entry
export const addNavigationHistory = async (ctx: Context) => {
  try {
    if (!ctx.request.hasBody) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Request body is required" };
      return;
    }

    const body = await ctx.request.body.json();
    console.log(body);

    const { userId, placeId, placeName, placeTypes, location } = body;

    if (!userId || !placeId || !placeName || !placeTypes || !location) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Missing required fields" };
      return;
    }

    // Remove redundant place types
    const filteredPlaceTypes: string[] = placeTypes.filter((type: string) =>
      type != "point_of_interest" && type != "establishment"
    );

    // Convert string userId to MongoDB ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Transform location to GeoJSON format
    const geoJsonLocation = {
      type: "Point",
      coordinates: [location.longitude, location.latitude],
    };

    const newHistory = new NavigationHistory({
      userId: userObjectId,
      placeId,
      placeName,
      placeTypes: filteredPlaceTypes,
      location: geoJsonLocation,
      timestamp: new Date(),
    });

    await newHistory.save();
    ctx.response.status = 201;
    ctx.response.body = {
      message: "Navigation history added",
      history: newHistory,
    };
  } catch (error) {
    console.error("Error adding navigation history:", error);
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to add navigation history" };
  }
};

// Retrieve user's navigation history
export const getUserNavigationHistory = async (
  ctx: RouterContext<"/user/:userId">,
) => {
  try {
    // Extract userId from URL params
    const userId = ctx.params.userId;

    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = { message: "User ID is required" };
      return;
    }

    const limit = ctx.request.url.searchParams.get("limit") || "20";
    const offset = ctx.request.url.searchParams.get("offset") || "0";

    // Convert string userId to MongoDB ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const history = await NavigationHistory.find({ userId: userObjectId })
      .sort({ timestamp: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await NavigationHistory.countDocuments({
      userId: userObjectId,
    });

    ctx.response.body = {
      history,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    };
  } catch (error) {
    console.error("Error fetching navigation history:", error);
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to fetch navigation history" };
  }
};

// Get place type frequency for a user
export const getPlaceTypeFrequency = async (
  ctx: RouterContext<"/user/:userId/place-types">,
) => {
  try {
    // Extract userId from URL params
    const userId = ctx.params.userId;

    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = { message: "User ID is required" };
      return;
    }

    // Convert string userId to MongoDB ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const aggregation = await NavigationHistory.aggregate([
      { $match: { userId: userObjectId } },
      { $unwind: "$placeTypes" },
      { $group: { _id: "$placeTypes", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    ctx.response.body = { placeTypeFrequency: aggregation };
  } catch (error) {
    console.error("Error fetching place type frequency:", error);
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to fetch place type frequency" };
  }
};

// Clear user's navigation history
export const clearUserNavigationHistory = async (
  ctx: RouterContext<"/user/:userId">,
) => {
  try {
    // Extract userId from URL params
    const userId = ctx.params.userId;

    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = { message: "User ID is required" };
      return;
    }

    // Convert string userId to MongoDB ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await NavigationHistory.deleteMany({ userId: userObjectId });

    ctx.response.body = { message: "Navigation history cleared" };
  } catch (error) {
    console.error("Error clearing navigation history:", error);
    ctx.response.status = 500;
    ctx.response.body = { message: "Failed to clear navigation history" };
  }
};
