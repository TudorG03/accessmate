import { Context, RouterContext } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import mongoose from "npm:mongoose@^6.7";
import Marker, { IMarker } from "../../models/marker/marker.mongo.ts";
import { UserRole } from "../../models/auth/auth.mongo.ts";

// Request interfaces for type safety
interface Location {
  latitude: number;
  longitude: number;
}

interface CreateMarkerRequest {
  location: Location;
  obstacleType: string;
  obstacleScore?: number;
  description?: string;
  images?: string[];
}

interface UpdateMarkerRequest {
  location?: Location;
  obstacleType?: string;
  obstacleScore?: number;
  description?: string;
  images?: string[];
}

// Define route paths for type safety
type MarkerRoutes = "/" | "/nearby" | "/:id";

// Helper function to check if user has admin/moderator role
const isAdminOrModerator = (role: string) => {
  return role === UserRole.ADMIN || role === UserRole.MODERATOR;
};

// Get all markers
export const getMarkers = async (ctx: Context) => {
  try {
    const markers = await Marker.find().exec();

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Markers retrieved successfully",
      markers: markers.map((marker) => ({
        ...marker.toObject(),
        id: marker._id,
      })),
    };
  } catch (error) {
    console.error("Get markers error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Get nearby markers
export const getNearbyMarkers = async (ctx: Context) => {
  try {
    // Get query parameters
    const url = new URL(ctx.request.url);
    const params = url.searchParams;

    console.log("Nearby markers request received:", ctx.request.url.toString());

    const latitude = parseFloat(params.get("latitude") || "");
    const longitude = parseFloat(params.get("longitude") || "");
    const radius = parseInt(params.get("radius") || "500"); // Default 500 meters

    console.log("Parameters:", { latitude, longitude, radius });

    // Validate parameters
    if (isNaN(latitude) || isNaN(longitude)) {
      console.log("Invalid parameters received");
      ctx.response.status = 400;
      ctx.response.body = {
        message:
          "Invalid parameters. latitude and longitude must be valid numbers",
      };
      return;
    }

    // Validate coordinate values
    if (
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        message:
          "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180",
        received: { latitude, longitude },
      };
      return;
    }

    console.log("Executing query with coordinates:", [longitude, latitude]);

    try {
      // Convert radius from meters to approximate decimal degrees
      // This is an approximation: 1 degree of latitude is ~111 km
      // 1 degree of longitude varies with latitude (smaller at higher latitudes)
      const latDelta = radius / 111000; // Convert meters to decimal degrees for latitude

      // Longitude degrees get smaller as you move away from equator
      // cos(latitude) gives a scaling factor
      const longDelta = radius / (111000 * Math.cos(latitude * Math.PI / 180));

      console.log("Search box:", {
        latMin: latitude - latDelta,
        latMax: latitude + latDelta,
        longMin: longitude - longDelta,
        longMax: longitude + longDelta,
      });

      // Use a bounding box query
      const nearbyMarkers = await Marker.find({
        "location.latitude": {
          $gte: latitude - latDelta,
          $lte: latitude + latDelta,
        },
        "location.longitude": {
          $gte: longitude - longDelta,
          $lte: longitude + longDelta,
        },
      }).exec();

      console.log(
        `Found ${nearbyMarkers.length} nearby markers using bounding box`,
      );

      // Calculate actual distance for each marker
      const markersWithDistance = nearbyMarkers.map((marker) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          marker.location.latitude,
          marker.location.longitude,
        );

        return {
          ...marker.toObject(),
          id: marker._id,
          distance: Math.round(distance), // Round to nearest meter
        };
      });

      // Filter by actual distance (since bounding box is approximate)
      const filteredMarkers = markersWithDistance.filter(
        (marker) => marker.distance <= radius,
      );

      console.log(
        `Filtered to ${filteredMarkers.length} markers within ${radius} meters`,
      );

      // Format the response
      ctx.response.status = 200;
      ctx.response.body = {
        message:
          `Found ${filteredMarkers.length} markers within ${radius} meters`,
        markers: filteredMarkers,
      };
    } catch (dbError) {
      console.error("Database query error:", dbError);
      ctx.response.status = 500;
      ctx.response.body = {
        message: "Database query error",
        error: dbError instanceof Error ? dbError.message : String(dbError),
      };
    }
  } catch (error) {
    console.error("Get nearby markers error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Helper function to calculate distance between two points using the Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in meters

  return distance;
}

// Create new marker
export const createMarker = async (ctx: Context) => {
  try {
    const data = await ctx.request.body.json() as CreateMarkerRequest;
    console.log("Creating marker with data:", data);

    // Validate required fields
    if (
      !data.location?.latitude || !data.location?.longitude ||
      !data.obstacleType
    ) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Missing required fields" };
      return;
    }

    // Validate coordinate values are within valid ranges
    const { latitude, longitude } = data.location;
    if (
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        message:
          "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180",
        received: { latitude, longitude },
      };
      return;
    }

    // Get user ID from authenticated user
    const userId = ctx.state.user.userId;

    // Create the marker document
    const marker = new Marker({
      userId: new mongoose.Types.ObjectId(userId),
      location: {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      },
      obstacleType: data.obstacleType,
      obstacleScore: data.obstacleScore || 1,
      description: data.description,
      images: data.images || [],
    });

    // Save to database
    console.log("Saving marker:", JSON.stringify(marker.toObject()));
    const savedMarker = await marker.save();
    console.log("Marker saved successfully with ID:", savedMarker._id);

    ctx.response.status = 201;
    ctx.response.body = {
      message: "Marker created successfully",
      marker: savedMarker.toObject(),
    };
  } catch (error) {
    console.error("Create marker error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Update marker
export const updateMarker = async (ctx: RouterContext<"/:id">) => {
  try {
    const markerId = ctx.params.id;
    const data = await ctx.request.body.json() as UpdateMarkerRequest;
    const userId = ctx.state.user.userId;
    const userRole = ctx.state.user.role;

    // Find marker
    const marker = await Marker.findById(markerId).exec();

    if (!marker) {
      ctx.response.status = 404;
      ctx.response.body = { message: "Marker not found" };
      return;
    }

    // Check permissions
    if (!isAdminOrModerator(userRole) && marker.userId.toString() !== userId) {
      ctx.response.status = 403;
      ctx.response.body = {
        message: "Unauthorized to update this marker",
        requiredRole: "admin/moderator or marker owner",
      };
      return;
    }

    // If location is provided, it must have both latitude and longitude
    if (
      data.location && (!data.location.latitude || !data.location.longitude)
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        message: "Location must include both latitude and longitude",
      };
      return;
    }

    // Prepare update object with all optional fields set to null by default
    const update = {
      obstacleScore: null,
      description: null,
      images: null,
      ...data, // Override nulls with any provided values
      userId: marker.userId, // Prevent userId from being changed
    };

    // If obstacleType is provided, it's required and can't be null
    if ("obstacleType" in data && !data.obstacleType) {
      ctx.response.status = 400;
      ctx.response.body = { message: "obstacleType cannot be null" };
      return;
    }

    const updatedMarker = await Marker.findByIdAndUpdate(
      markerId,
      { $set: update },
      { new: true }, // Return the updated document
    ).exec();

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Marker updated successfully",
      marker: updatedMarker?.toObject(),
    };
  } catch (error) {
    console.error("Update marker error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// Delete marker
export const deleteMarker = async (ctx: RouterContext<"/:id">) => {
  try {
    const markerId = ctx.params.id;
    const userId = ctx.state.user.userId;
    const userRole = ctx.state.user.role;

    // Find marker
    const marker = await Marker.findById(markerId).exec();

    if (!marker) {
      ctx.response.status = 404;
      ctx.response.body = { message: "Marker not found" };
      return;
    }

    // Check permissions
    if (!isAdminOrModerator(userRole) && marker.userId.toString() !== userId) {
      ctx.response.status = 403;
      ctx.response.body = {
        message: "Unauthorized to delete this marker",
        requiredRole: "admin/moderator or marker owner",
      };
      return;
    }

    await marker.delete();

    ctx.response.status = 200;
    ctx.response.body = { message: "Marker deleted successfully" };
  } catch (error) {
    console.error("Delete marker error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
