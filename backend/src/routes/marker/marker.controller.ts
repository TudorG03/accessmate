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
  notThere?: number;
  description?: string;
  images?: string[];
}

interface UpdateMarkerRequest {
  location?: Location;
  obstacleType?: string;
  obstacleScore?: number;
  notThere?: number;
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

// Get marker by ID
export const getMarkerById = async (ctx: RouterContext<"/:id">) => {
  try {
    const markerId = ctx.params.id;

    // Validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(markerId)) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Invalid marker ID format" };
      return;
    }

    // Find the marker by ID
    const marker = await Marker.findById(markerId).exec();

    if (!marker) {
      ctx.response.status = 404;
      ctx.response.body = { message: "Marker not found" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Marker retrieved successfully",
      marker: {
        ...marker.toObject(),
        id: marker._id,
      },
    };
  } catch (error) {
    console.error("Get marker by ID error:", error);
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

    // Validate radius (limit to reasonable values for performance)
    const maxRadius = 5000; // 5km maximum
    const validRadius = Math.min(Math.max(radius, 10), maxRadius); // Between 10m and 5km

    console.log("Executing optimized query with coordinates:", [
      longitude,
      latitude,
    ]);

    try {
      // Use optimized bounding box with more precise calculations
      const earthRadius = 6371000; // Earth's radius in meters
      const latDelta = validRadius / earthRadius * (180 / Math.PI);

      // More accurate longitude delta calculation
      const longDelta = validRadius /
        (earthRadius * Math.cos(latitude * Math.PI / 180)) * (180 / Math.PI);

      console.log("Optimized search box:", {
        latMin: latitude - latDelta,
        latMax: latitude + latDelta,
        longMin: longitude - longDelta,
        longMax: longitude + longDelta,
        radius: validRadius,
      });

      // Use MongoDB aggregation pipeline for better performance
      const nearbyMarkers = await Marker.aggregate([
        // Stage 1: Filter by bounding box (uses index)
        {
          $match: {
            "location.latitude": {
              $gte: latitude - latDelta,
              $lte: latitude + latDelta,
            },
            "location.longitude": {
              $gte: longitude - longDelta,
              $lte: longitude + longDelta,
            },
          },
        },
        // Stage 2: Add calculated distance field
        {
          $addFields: {
            distance: {
              $let: {
                vars: {
                  dLat: {
                    $multiply: [
                      { $subtract: ["$location.latitude", latitude] },
                      Math.PI / 180,
                    ],
                  },
                  dLon: {
                    $multiply: [
                      { $subtract: ["$location.longitude", longitude] },
                      Math.PI / 180,
                    ],
                  },
                  lat1: { $multiply: [latitude, Math.PI / 180] },
                  lat2: { $multiply: ["$location.latitude", Math.PI / 180] },
                },
                in: {
                  $multiply: [
                    earthRadius,
                    {
                      $multiply: [
                        2,
                        {
                          $atan2: [
                            {
                              $sqrt: {
                                $add: [
                                  {
                                    $pow: [
                                      { $sin: { $divide: ["$$dLat", 2] } },
                                      2,
                                    ],
                                  },
                                  {
                                    $multiply: [
                                      { $cos: "$$lat1" },
                                      { $cos: "$$lat2" },
                                      {
                                        $pow: [{
                                          $sin: { $divide: ["$$dLon", 2] },
                                        }, 2],
                                      },
                                    ],
                                  },
                                ],
                              },
                            },
                            {
                              $sqrt: {
                                $subtract: [
                                  1,
                                  {
                                    $add: [
                                      {
                                        $pow: [{
                                          $sin: { $divide: ["$$dLat", 2] },
                                        }, 2],
                                      },
                                      {
                                        $multiply: [
                                          { $cos: "$$lat1" },
                                          { $cos: "$$lat2" },
                                          {
                                            $pow: [{
                                              $sin: { $divide: ["$$dLon", 2] },
                                            }, 2],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        // Stage 3: Filter by actual distance
        {
          $match: {
            distance: { $lte: validRadius },
          },
        },
        // Stage 4: Sort by distance (closest first)
        {
          $sort: { distance: 1 },
        },
        // Stage 5: Limit results for performance (max 50 markers)
        {
          $limit: 50,
        },
        // Stage 6: Add the _id as id field and round distance
        {
          $addFields: {
            id: "$_id",
            distance: { $round: ["$distance", 0] },
          },
        },
      ]).exec();

      console.log(
        `Found ${nearbyMarkers.length} nearby markers using optimized aggregation`,
      );

      // Format the response
      ctx.response.status = 200;
      ctx.response.body = {
        message:
          `Found ${nearbyMarkers.length} markers within ${validRadius} meters`,
        markers: nearbyMarkers,
        searchRadius: validRadius,
        searchCenter: { latitude, longitude },
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
      notThere: data.notThere || 0,
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

    // Check permissions first - allow any user to increment notThere, but require ownership/admin for other updates
    const isOwnerOrAdmin = isAdminOrModerator(userRole) ||
      marker.userId.toString() === userId;
    const isOnlyNotThereUpdate = data.notThere != null &&
      Object.keys(data).length === 1;

    if (!isOnlyNotThereUpdate && !isOwnerOrAdmin) {
      ctx.response.status = 403;
      ctx.response.body = {
        message: "Unauthorized to update this marker",
        requiredRole: "admin/moderator or marker owner",
      };
      return;
    }

    // Handle notThere increment (allowed for any authenticated user)
    if (data.notThere != null && marker.notThere < data.notThere) {
      const updatedMarker = await Marker.findByIdAndUpdate(
        markerId,
        { $set: { notThere: data.notThere } },
        { new: true }, // Return the updated document
      ).exec();

      ctx.response.status = 200;
      ctx.response.body = {
        message: "Marker updated successfully",
        marker: updatedMarker?.toObject(),
      };
      return; // Important: return here to prevent further execution
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
      notThere: null,
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

    if (marker.notThere >= 5) {
      await marker.delete();
      ctx.response.status = 200;
      ctx.response.body = { message: "Marker deleted successfully" };
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
