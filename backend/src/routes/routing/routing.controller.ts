import { Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import graphService from "../../services/graph.service.ts";
import Marker from "../../models/marker/marker.mongo.ts";

/**
 * Find an accessible route between two points
 * @param ctx Oak context
 */
export async function findAccessibleRoute(ctx: Context) {
  try {
    if (!ctx.request.hasBody) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Request body is required",
        success: false,
      };
      return;
    }

    // Use the correct body parsing approach for Oak v17.1.4
    const body = await ctx.request.body.json();
    const {
      origin,
      destination,
      avoidObstacles,
      userPreferences,
      useOsmRouting,
    } = body;

    // Validate input
    if (!origin || !destination) {
      ctx.response.status = 400;
      ctx.response.body = {
        error:
          "Missing required parameters: origin and destination must be provided",
        success: false,
      };
      return;
    }

    if (
      !origin.latitude || !origin.longitude || !destination.latitude ||
      !destination.longitude
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        error:
          "Invalid coordinates: latitude and longitude must be provided for both origin and destination",
        success: false,
      };
      return;
    }

    // Always use OSM routing by default or when explicitly requested
    let routeResult;
    try {
      console.log("Attempting OSM grid-based routing...");
      routeResult = await graphService.findOsmBasedAccessibleRoute({
        origin,
        destination,
        avoidObstacles: avoidObstacles !== false, // Default to true
        userPreferences,
      });
      console.log("OSM grid-based routing succeeded");
    } catch (osmError) {
      console.error(
        "OSM grid-based routing failed:",
        osmError,
      );

      // Only fall back to Google Directions API if useOsmRouting is not true
      if (useOsmRouting === true) {
        console.error(
          "Not falling back to Google Directions API as useOsmRouting is true",
        );
        throw new Error(
          "OSM grid-based routing failed and fallback is disabled",
        );
      }

      console.log("Falling back to Google Directions API");
      routeResult = await graphService.findAccessibleRoute({
        origin,
        destination,
        avoidObstacles: avoidObstacles !== false, // Default to true
        userPreferences,
      });
      console.log("Google Directions API fallback succeeded");
    }

    // Ensure the result has the expected structure
    if (!routeResult.points) {
      routeResult.points = [];
    }

    // Validate route points
    if (Array.isArray(routeResult.points)) {
      routeResult.points = routeResult.points.filter((point) =>
        point &&
        typeof point.latitude === "number" &&
        typeof point.longitude === "number" &&
        !isNaN(point.latitude) &&
        !isNaN(point.longitude)
      );
      console.log(
        `Filtered route points, now have ${routeResult.points.length} valid points`,
      );
    }

    // Send successful response
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: routeResult,
    };
  } catch (error: unknown) {
    console.error("Error finding accessible route:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: error instanceof Error
        ? error.message
        : "Error finding accessible route",
      success: false,
    };
  }
}

/**
 * Get obstacles within a bounding box
 * @param ctx Oak context
 */
export async function getObstaclesInBoundingBox(ctx: Context) {
  try {
    const params = ctx.request.url.searchParams;
    const north = params.get("north");
    const south = params.get("south");
    const east = params.get("east");
    const west = params.get("west");

    // Validate input
    if (!north || !south || !east || !west) {
      ctx.response.status = 400;
      ctx.response.body = {
        error:
          "Missing required parameters: north, south, east, and west must be provided",
        success: false,
      };
      return;
    }

    // Convert to numbers
    const bbox = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west),
    };

    // Validate coordinates
    if (
      isNaN(bbox.north) || isNaN(bbox.south) || isNaN(bbox.east) ||
      isNaN(bbox.west)
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        error:
          "Invalid coordinates: north, south, east, and west must be valid numbers",
        success: false,
      };
      return;
    }

    // Get obstacles
    const obstacles = await Marker.find({
      "location.latitude": { $gte: bbox.south, $lte: bbox.north },
      "location.longitude": { $gte: bbox.west, $lte: bbox.east },
    }).lean();

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: obstacles,
    };
  } catch (error: unknown) {
    console.error("Error getting obstacles:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: error instanceof Error ? error.message : "Error getting obstacles",
      success: false,
    };
  }
}

export default {
  findAccessibleRoute,
  getObstaclesInBoundingBox,
};
