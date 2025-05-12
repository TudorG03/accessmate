/**
 * Accessible Route Service
 * Handles communication with the backend for accessible routing
 */
import { Marker } from "@/types/marker.types";
import apiService from "./api.service";
import { getDirections } from "./places.service";

// Interface for points
interface Point {
    latitude: number;
    longitude: number;
}

// Interface for routing parameters
interface RoutingParams {
    origin: Point;
    destination: Point;
    userPreferences?: {
        avoidStairs?: boolean;
        maxSlope?: number;
        minimumWidth?: number;
    };
    useOsmRouting?: boolean;
}

// Interface for routing results
interface RoutingResult {
    points: Point[];
    distance: number;
    duration: string;
    hasObstacles: boolean;
    steps: Array<{
        instructions: string;
        distance: string;
        duration: string;
        startLocation: Point;
        endLocation: Point;
    }>;
}

/**
 * Get an accessible route between two points
 * @param params Routing parameters
 * @returns Accessible route information
 */
export async function getAccessibleRoute(
    params: RoutingParams,
): Promise<RoutingResult> {
    try {
        // Always use OSM routing if not specified
        const routingParams = {
            ...params,
            useOsmRouting: params.useOsmRouting !== false, // Default to true if not explicitly set to false
        };

        console.log(
            "Requesting accessible route from backend with params:",
            JSON.stringify(routingParams),
        );

        // Call the backend API
        const response = await apiService.post(
            "/api/routing/accessible-route",
            routingParams,
        );

        // Check if the request was successful
        if (response.data) {
            console.log(
                "Received accessible route from backend:",
                JSON.stringify(response.data).substring(0, 300) + "...",
            );

            // The actual route data is nested in response.data.data
            const routeData = response.data.success && response.data.data
                ? response.data.data
                : response.data;

            // Log the structure of the response
            console.log("Response points array exists:", !!routeData.points);
            if (routeData.points) {
                console.log("Points array length:", routeData.points.length);
                if (routeData.points.length > 0) {
                    console.log(
                        "First point:",
                        JSON.stringify(routeData.points[0]),
                    );
                }
            }

            // Check for specific error responses from the backend
            if (routeData.error) {
                console.error("Backend returned an error:", routeData.error);
                throw new Error(routeData.error);
            }

            // Ensure the data has the expected structure
            if (!routeData.points || !Array.isArray(routeData.points)) {
                console.warn(
                    "Backend response missing valid points array",
                );
                throw new Error("Invalid route data: Missing points array");
            }

            // Validate the points array to ensure it only contains valid coordinates
            const validPoints = routeData.points.filter((point: any) =>
                point &&
                typeof point.latitude === "number" &&
                typeof point.longitude === "number" &&
                !isNaN(point.latitude) &&
                !isNaN(point.longitude)
            );

            console.log(
                `Filtered route points, now have ${validPoints.length} valid points out of ${routeData.points.length}`,
            );

            // If we lost too many points during validation, throw an error
            if (validPoints.length < 3 && routeData.points.length > 3) {
                throw new Error("Route contains too many invalid coordinates");
            }

            // If we have very few points, it might not be a valid route
            if (validPoints.length < 3) {
                // The route is likely not valid or just a straight line
                console.warn("Route has too few points, may not be valid");
                throw new Error(
                    "Could not calculate a detailed accessible route",
                );
            }

            // Update the route data with validated points
            routeData.points = validPoints;

            return routeData;
        }

        console.error("Backend response empty or invalid");
        throw new Error("Failed to get accessible route: Empty response");
    } catch (error) {
        console.error("Error getting accessible route:", error);

        // Extract meaningful error message
        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error calculating accessible route";

        // Check for specific known errors to provide better user feedback
        if (errorMessage.includes("too long")) {
            throw new Error(
                "The route is too long for accessible routing. Please choose a closer destination.",
            );
        }

        if (errorMessage.includes("No accessible roads")) {
            throw new Error(
                "No accessible roads found near your start or end point.",
            );
        }

        // If we're using OSM routing, throw the error instead of falling back
        if (params.useOsmRouting) {
            throw new Error(`Accessible routing failed: ${errorMessage}`);
        }

        // Otherwise, fallback to Google Directions API
        console.log("Falling back to Google Directions API");
        try {
            const directionsResult = await getDirections(
                params.origin,
                params.destination,
                "walking",
            );

            // Create a proper RoutingResult object with all required properties
            const result: RoutingResult = {
                ...directionsResult,
                hasObstacles: false, // Default value when falling back to Google Directions
                points: directionsResult.points || [], // Ensure the points property is never undefined
            };

            // Track that this is from Google fallback (as a non-interface property)
            (result as any)._isGoogleFallback = true;

            // Log and validate the fallback route
            console.log(
                `Using Google fallback route with ${result.points.length} points`,
            );

            if (!result.points || result.points.length < 2) {
                throw new Error(
                    "Google Directions API could not calculate a route",
                );
            }

            return result;
        } catch (fallbackError) {
            console.error(
                "Google Directions fallback also failed:",
                fallbackError,
            );
            throw new Error(
                "Could not calculate any route. Please try a different destination.",
            );
        }
    }
}

/**
 * Get obstacles within a bounding box
 * @param bbox Bounding box coordinates
 * @returns Array of obstacles
 */
export async function getObstaclesInBoundingBox(
    bbox: { north: number; south: number; east: number; west: number },
): Promise<Marker[]> {
    try {
        // Build query string
        const queryParams = new URLSearchParams({
            north: bbox.north.toString(),
            south: bbox.south.toString(),
            east: bbox.east.toString(),
            west: bbox.west.toString(),
        }).toString();

        // Call the backend API
        const response = await apiService.get(
            `/api/routing/obstacles?${queryParams}`,
        );

        // Check if the request was successful and data is an array
        if (
            response.data && response.data.success &&
            Array.isArray(response.data.data)
        ) {
            return response.data.data;
        } else if (response.data && Array.isArray(response.data)) {
            return response.data;
        }

        return [];
    } catch (error) {
        console.error("Error getting obstacles:", error);
        return [];
    }
}

/**
 * Calculate a bounding box around two points
 * @param point1 First point
 * @param point2 Second point
 * @param bufferInKm Buffer distance in kilometers
 * @returns Bounding box coordinates
 */
export function calculateBoundingBox(
    point1: Point,
    point2: Point,
    bufferInKm: number = 0.5,
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

export default {
    getAccessibleRoute,
    getObstaclesInBoundingBox,
    calculateBoundingBox,
};
