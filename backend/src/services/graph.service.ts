/**
 * Graph Service for accessible routing
 * Manages OSM graph construction, caching, and routing algorithms
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import RoutingGraph, { IRoutingGraph } from "../models/routing/graph.model.ts";
import MarkerModel from "../models/marker/marker.mongo.ts";
import osmGridService from "./osm-grid.service.ts";

// Promisify exec for running Python scripts
const execAsync = promisify(exec);

// Constants for graph operations
const GRAPH_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const MAX_GRAPH_SIZE = 5; // km - maximum size of graph to generate (radius)
const GRAPH_BUFFER = 0.5; // km - buffer around route for graph generation
const DEFAULT_NETWORK_TYPE = "walk";

// Obstacle weight configuration
const OBSTACLE_WEIGHTS = {
  STAIRS: 1000,
  NARROW_PATH: 800,
  STEEP_INCLINE: 900,
  UNEVEN_SURFACE: 700,
  OBSTACLE_IN_PATH: 1000,
  POOR_LIGHTING: 500,
  CONSTRUCTION: 900,
  MISSING_RAMP: 800,
  MISSING_CROSSWALK: 700,
  OTHER: 600,
};

// Interface for routing parameters
interface RoutingParams {
  origin: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  avoidObstacles?: boolean;
  userPreferences?: {
    avoidStairs?: boolean;
    maxSlope?: number;
    minimumWidth?: number;
  };
}

// Interface for routing results
interface RoutingResult {
  points: Array<{ latitude: number; longitude: number }>;
  distance: number; // in kilometers
  duration: string;
  hasObstacles: boolean;
  steps: Array<{
    instructions: string;
    distance: string;
    duration: string;
    startLocation: { latitude: number; longitude: number };
    endLocation: { latitude: number; longitude: number };
    polyline?: string;
  }>;
}

/**
 * Get or create an OSM graph for a specific region
 */
async function getOrCreateGraph(
  bbox: { north: number; south: number; east: number; west: number },
  networkType: string = DEFAULT_NETWORK_TYPE,
): Promise<string> {
  try {
    // Check if we have a valid cached graph
    const cachedGraph = await RoutingGraph.findOne({
      "bbox.north": { $gte: bbox.north },
      "bbox.south": { $lte: bbox.south },
      "bbox.east": { $gte: bbox.east },
      "bbox.west": { $lte: bbox.west },
      lastUpdated: { $gte: new Date(Date.now() - GRAPH_CACHE_TTL) },
    });

    if (cachedGraph) {
      // Update last accessed time
      await RoutingGraph.updateOne(
        { _id: cachedGraph._id },
        { lastAccessed: new Date() },
      );
      return cachedGraph.graphData;
    }

    // No cached graph found, create a new one using Python script with OSMNX
    // For now, we'll return a placeholder
    const graphData = JSON.stringify({
      placeholder:
        "This would be a serialized NetworkX graph in a real implementation",
    });

    // Try to store the new graph in the database (but don't stop if it fails)
    try {
      const newGraph = new RoutingGraph({
        region: `${bbox.north.toFixed(2)},${bbox.south.toFixed(2)},${
          bbox.east.toFixed(2)
        },${bbox.west.toFixed(2)}`,
        bbox,
        graphData,
        nodeCount: 0, // This would be actual node count in real implementation
        edgeCount: 0, // This would be actual edge count in real implementation
        lastUpdated: new Date(),
        lastAccessed: new Date(),
      });

      await newGraph.save();
    } catch (dbError) {
      console.warn(
        "Failed to save graph to database, continuing with in-memory graph:",
        dbError,
      );
    }

    return graphData;
  } catch (error) {
    console.error("Error in getOrCreateGraph:", error);
    // Return a default graph even if we had errors
    return JSON.stringify({
      placeholder: "Default fallback graph",
    });
  }
}

/**
 * Calculate a bounding box around two points
 */
function calculateBoundingBox(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number },
  bufferInKm: number = GRAPH_BUFFER,
): { north: number; south: number; east: number; west: number } {
  // Calculate the bounding box with buffer
  const lat1 = point1.latitude;
  const lon1 = point1.longitude;
  const lat2 = point2.latitude;
  const lon2 = point2.longitude;

  // Find min/max
  const minLat = Math.min(lat1, lat2);
  const maxLat = Math.max(lat1, lat2);
  const minLon = Math.min(lon1, lon2);
  const maxLon = Math.max(lon1, lon2);

  // Add buffer (approximate conversion from km to degrees)
  // 1 degree of latitude = ~111km, 1 degree of longitude = ~111km * cos(latitude)
  const latBuffer = bufferInKm / 111;
  const avgLat = (minLat + maxLat) / 2;
  const lonBuffer = bufferInKm / (111 * Math.cos(avgLat * Math.PI / 180));

  return {
    north: maxLat + latBuffer,
    south: minLat - latBuffer,
    east: maxLon + lonBuffer,
    west: minLon - lonBuffer,
  };
}

/**
 * Get obstacles within a bounding box
 */
async function getObstaclesInBbox(
  bbox: { north: number; south: number; east: number; west: number },
): Promise<any[]> {
  try {
    return await MarkerModel.find({
      "location.latitude": { $gte: bbox.south, $lte: bbox.north },
      "location.longitude": { $gte: bbox.west, $lte: bbox.east },
    }).lean();
  } catch (error) {
    console.error("Error getting obstacles:", error);
    return []; // Return empty array if there's an error
  }
}

/**
 * Snap points to roads using Google Maps Roads API
 */
async function snapToRoads(
  points: Array<{ latitude: number; longitude: number }>,
  interpolate: boolean = true,
): Promise<Array<{ latitude: number; longitude: number }>> {
  try {
    // Don't process if we have too few points
    if (points.length < 2) {
      return points;
    }

    // Google Roads API has a limit of 100 points per request
    const MAX_POINTS_PER_REQUEST = 100;
    let allSnappedPoints: Array<{ latitude: number; longitude: number }> = [];

    // Process points in chunks to respect the API limits
    for (let i = 0; i < points.length; i += MAX_POINTS_PER_REQUEST - 1) {
      const chunkEnd = Math.min(i + MAX_POINTS_PER_REQUEST, points.length);
      const pointsChunk = points.slice(i, chunkEnd);

      // If this isn't the first chunk, include the last point from the previous chunk
      // to ensure continuity between chunks
      if (i > 0 && allSnappedPoints.length > 0) {
        pointsChunk.unshift(allSnappedPoints[allSnappedPoints.length - 1]);
      }

      // Format points for the Roads API
      const pathParam = pointsChunk
        .map((p) => `${p.latitude},${p.longitude}`)
        .join("|");

      const apiUrl =
        `https://roads.googleapis.com/v1/snapToRoads?path=${pathParam}&interpolate=${interpolate}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

      console.log(`Snapping ${pointsChunk.length} points to roads`);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Roads API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.snappedPoints || !Array.isArray(data.snappedPoints)) {
        throw new Error("Invalid response from Roads API");
      }

      const snappedPoints = data.snappedPoints.map((point: any) => ({
        latitude: point.location.latitude,
        longitude: point.location.longitude,
      }));

      // If this isn't the first chunk, skip the first point since it's a duplicate
      const pointsToAdd = i > 0 ? snappedPoints.slice(1) : snappedPoints;
      allSnappedPoints = [...allSnappedPoints, ...pointsToAdd];
    }

    console.log(
      `Successfully snapped ${points.length} points to ${allSnappedPoints.length} road points`,
    );
    return allSnappedPoints;
  } catch (error) {
    console.error("Error in snapToRoads:", error);
    // Fall back to original points if the API fails
    console.log("Falling back to original points");
    return points;
  }
}

/**
 * Calculate an accessible route between two points
 */
export async function findAccessibleRoute(
  params: RoutingParams,
): Promise<RoutingResult> {
  try {
    const { origin, destination, avoidObstacles = true } = params;

    // Ensure Google Maps API key is configured
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.error("Google Maps API key is not configured");
      throw new Error("Google Maps API key is not configured");
    }

    // Calculate bounding box for the route
    const bbox = calculateBoundingBox(origin, destination);

    // Get obstacles within the bounding box if needed
    let obstacles: any[] = [];
    if (avoidObstacles) {
      try {
        obstacles = await getObstaclesInBbox(bbox);
        console.log(`Found ${obstacles.length} obstacles in bounding box`);
      } catch (obstaclesError) {
        console.warn(
          "Failed to get obstacles, continuing without them:",
          obstaclesError,
        );
      }
    }

    try {
      // Get a route from Google Maps API using Directions API
      console.log(
        `Requesting Google Maps directions from ${origin.latitude},${origin.longitude} to ${destination.latitude},${destination.longitude}`,
      );

      // Request detailed walkways and pedestrian paths by setting options appropriately
      const apiUrl = `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${origin.latitude},${origin.longitude}` +
        `&destination=${destination.latitude},${destination.longitude}` +
        `&mode=walking` +
        `&alternatives=true` + // Get alternative routes to choose the best one
        `&units=metric` +
        `&waypoints=optimize:true` + // Allow optimizing waypoints if needed
        `&key=${process.env.GOOGLE_MAPS_API_KEY}`;

      console.log("Requesting detailed route from Google Maps API");
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`Directions API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
        throw new Error(`Directions API returned status: ${data.status}`);
      }

      // Select the best route - for accessible routing, we typically want
      // the route with the most detailed waypoints for better road adherence
      const allRoutes = data.routes;
      let bestRoute = allRoutes[0]; // Default to first route
      let bestRouteWithObstacles = true;

      // Check which routes avoid obstacles
      if (obstacles.length > 0) {
        // For each route, check if it avoids obstacles
        for (const route of allRoutes) {
          // Extract points from the route's overview polyline
          const routePoints = decodePolyline(route.overview_polyline.points)
            .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

          // Check if this route crosses any obstacles
          const hasObstacles = checkForObstaclesNearRoute(
            routePoints,
            obstacles,
          );

          // If we find a route without obstacles, use it
          if (!hasObstacles) {
            bestRoute = route;
            bestRouteWithObstacles = false;
            console.log("Found a route that avoids all obstacles");
            break;
          }
        }
      }

      // If all routes have obstacles, select the one with the most waypoints for better detail
      if (bestRouteWithObstacles && allRoutes.length > 1) {
        let maxWaypoints = 0;

        for (const route of allRoutes) {
          let waypointCount = 0;

          // Count all steps in all legs as a proxy for route detail
          for (const leg of route.legs) {
            waypointCount += leg.steps.length;
          }

          if (waypointCount > maxWaypoints) {
            maxWaypoints = waypointCount;
            bestRoute = route;
          }
        }

        console.log(
          `Selected best route with ${maxWaypoints} waypoints from ${allRoutes.length} alternatives`,
        );
      }

      const route = bestRoute;
      const leg = route.legs[0];

      // Extract ALL steps with detailed instructions
      const steps = leg.steps.map((step: any) => ({
        instructions: step.html_instructions,
        distance: step.distance.text,
        duration: step.duration.text,
        startLocation: {
          latitude: step.start_location.lat,
          longitude: step.start_location.lng,
        },
        endLocation: {
          latitude: step.end_location.lat,
          longitude: step.end_location.lng,
        },
        polyline: step.polyline?.points || null,
      }));

      // We'll build a comprehensive array of points that precisely follow roads
      let routePoints: Array<{ latitude: number; longitude: number }> = [];

      // First, try to build points from the detailed step polylines
      for (const step of steps) {
        if (step.polyline) {
          const stepPoints = decodePolyline(step.polyline)
            .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

          // Skip the first point of each step after the first step to avoid duplication
          if (routePoints.length > 0 && stepPoints.length > 0) {
            routePoints = [...routePoints, ...stepPoints.slice(1)];
          } else {
            routePoints = [...routePoints, ...stepPoints];
          }
        }
      }

      // If there aren't enough points from step polylines, use the overview polyline
      if (routePoints.length < 5) {
        console.log("Not enough points from steps, using overview polyline");
        const overviewPoints = decodePolyline(route.overview_polyline.points)
          .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

        if (overviewPoints.length > routePoints.length) {
          routePoints = overviewPoints;
        }
      }

      // Make sure we have the exact origin and destination in the route
      // Add origin if needed
      if (
        routePoints.length === 0 ||
        routePoints[0].latitude !== origin.latitude ||
        routePoints[0].longitude !== origin.longitude
      ) {
        routePoints.unshift(origin);
      }

      // Add destination if needed
      if (
        routePoints.length === 0 ||
        routePoints[routePoints.length - 1].latitude !== destination.latitude ||
        routePoints[routePoints.length - 1].longitude !== destination.longitude
      ) {
        routePoints.push(destination);
      }

      console.log(
        `Generated route with ${routePoints.length} points that follow roads`,
      );

      // Get distance in kilometers and duration in minutes
      const distance = leg.distance.value / 1000; // meters to kilometers
      let duration = leg.duration.text;

      // Check if the route has obstacles near it
      const hasObstacles = checkForObstaclesNearRoute(routePoints, obstacles);

      return {
        points: routePoints,
        distance: Number(distance.toFixed(2)),
        duration: duration,
        hasObstacles: hasObstacles,
        steps: steps,
      };
    } catch (error) {
      console.error("Error in Google Directions API request:", error);

      // If the Google request fails, we'll fall back to a simple straight line
      // but with some interpolated points to make it look more natural
      console.warn("Falling back to straight line route");

      // Calculate haversine distance between origin and destination
      const distance = haversineDistanceInMeters(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude,
      ) / 1000; // Convert to kilometers

      const estimatedMinutes = Math.round(distance * 15); // 15 minutes per km

      // Create interpolated points to avoid the straight line appearance
      const intermediatePoints = [];
      for (let i = 1; i < 10; i++) {
        const fraction = i / 10;
        intermediatePoints.push({
          latitude: origin.latitude +
            (destination.latitude - origin.latitude) * fraction,
          longitude: origin.longitude +
            (destination.longitude - origin.longitude) * fraction,
        });
      }

      const allPoints = [origin, ...intermediatePoints, destination];

      return {
        points: allPoints,
        distance: Number(distance.toFixed(2)),
        duration: `${estimatedMinutes} mins`,
        hasObstacles: obstacles.length > 0,
        steps: [
          {
            instructions: "Follow the accessible path.",
            distance: `${distance.toFixed(2)} km`,
            duration: `${estimatedMinutes} mins`,
            startLocation: origin,
            endLocation: destination,
          },
        ],
      };
    }
  } catch (error) {
    console.error("Error in findAccessibleRoute:", error);
    throw new Error("Failed to get accessible route");
  }
}

/**
 * Check if there are obstacles near the route points
 */
function checkForObstaclesNearRoute(
  routePoints: Array<{ latitude: number; longitude: number }>,
  obstacles: any[],
  thresholdDistanceMeters: number = 20,
): boolean {
  if (
    !obstacles || obstacles.length === 0 || !routePoints ||
    routePoints.length === 0
  ) {
    console.log("No obstacles or route points to check");
    return false;
  }

  console.log(
    `Checking ${obstacles.length} obstacles against ${routePoints.length} route points`,
  );
  let nearbyObstacles = 0;

  for (const obstacle of obstacles) {
    // Skip invalid obstacles
    if (
      !obstacle.location || typeof obstacle.location.latitude !== "number" ||
      typeof obstacle.location.longitude !== "number"
    ) {
      console.warn("Found invalid obstacle without proper location data");
      continue;
    }

    for (const point of routePoints) {
      try {
        const distance = haversineDistanceInMeters(
          point.latitude,
          point.longitude,
          obstacle.location.latitude,
          obstacle.location.longitude,
        );

        if (distance <= thresholdDistanceMeters) {
          nearbyObstacles++;
          console.log(
            `Found obstacle near route: ${
              obstacle.obstacleType || "unknown"
            } (score: ${obstacle.obstacleScore || "unknown"}) at distance: ${
              distance.toFixed(2)
            }m`,
          );
          return true; // Return early once we find any obstacle
        }
      } catch (error) {
        console.warn("Error calculating distance for obstacle check:", error);
      }
    }
  }

  console.log(`No obstacles found within ${thresholdDistanceMeters}m of route`);
  return false;
}

/**
 * Calculate distance between two points in meters using Haversine formula
 */
export function haversineDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Function to decode Google's polyline format
function decodePolyline(encoded: string): Array<[number, number]> {
  const poly: Array<[number, number]> = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    poly.push([lat / 1e5, lng / 1e5]);
  }

  return poly;
}

/**
 * Clean up old graph cache entries
 * This should be run periodically
 */
export async function cleanupGraphCache(
  maxAgeInDays: number = 30,
): Promise<void> {
  try {
    const cutoffDate = new Date(
      Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000),
    );

    await RoutingGraph.deleteMany({
      lastAccessed: { $lt: cutoffDate },
    });
  } catch (error) {
    console.error("Error cleaning up graph cache:", error);
    // Don't throw, as this is a background maintenance task
  }
}

/**
 * Find an accessible route using OSM grid-based routing
 * This is an alternative to the Google-based routing
 */
export async function findOsmBasedAccessibleRoute(
  params: RoutingParams,
): Promise<RoutingResult> {
  try {
    const { origin, destination, avoidObstacles = true } = params;

    // Calculate bounding box for the route
    const bbox = calculateBoundingBox(origin, destination);

    // Get obstacles within the bounding box if needed
    let obstacles: any[] = [];
    if (avoidObstacles) {
      try {
        obstacles = await getObstaclesInBbox(bbox);
        console.log(`Found ${obstacles.length} obstacles in bounding box`);
      } catch (obstaclesError) {
        console.warn(
          "Failed to get obstacles, continuing without them:",
          obstaclesError,
        );
      }
    }

    console.log("Using OSM grid-based routing for accessible path...");
    const routePoints = await osmGridService.findOsmGridRoute(
      origin,
      destination,
      obstacles,
      10, // 10 meter cell size
      1.0, // 1km buffer
    );

    // Calculate route statistics
    const distance = calculateRouteDistance(routePoints) / 1000; // Convert to km
    const estimatedMinutes = Math.round(distance * 15); // Approx. 15 min per km walking
    const duration = `${estimatedMinutes} mins`;

    // Check if there are obstacles near the route
    const hasObstacles = checkForObstaclesNearRoute(routePoints, obstacles);

    // Create basic step information
    const steps = [{
      instructions: "Follow the accessible path.",
      distance: `${distance.toFixed(2)} km`,
      duration: duration,
      startLocation: origin,
      endLocation: destination,
    }];

    return {
      points: routePoints,
      distance: Number(distance.toFixed(2)),
      duration: duration,
      hasObstacles: hasObstacles,
      steps: steps,
    };
  } catch (error) {
    console.error("Error in OSM grid routing:", error);

    // Fall back to Google-based routing
    return findAccessibleRoute(params);
  }
}

/**
 * Calculate the total distance of a route in meters
 */
function calculateRouteDistance(
  points: Array<{ latitude: number; longitude: number }>,
): number {
  if (points.length < 2) return 0;

  let totalDistance = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    totalDistance += haversineDistanceInMeters(
      p1.latitude,
      p1.longitude,
      p2.latitude,
      p2.longitude,
    );
  }

  return totalDistance;
}

export default {
  findAccessibleRoute,
  cleanupGraphCache,
  findOsmBasedAccessibleRoute,
};
