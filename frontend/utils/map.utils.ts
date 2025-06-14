import { Marker } from "@/types/marker.types";
import {
    getObstacleColor,
    getObstacleEmoji,
    getObstacleIcon,
} from "@/stores/marker/marker.utils";
import { formatDistance } from "./distanceUtils";

/**
 * Map-related utility functions
 * Pure functions with no side effects for safe extraction
 */

export interface LocationCoordinate {
    latitude: number;
    longitude: number;
}

export interface RoutePoint extends LocationCoordinate {}

export interface UserPreferences {
    preferedUnit?: string;
}

/**
 * Format marker title for map display
 */
export function formatMarkerTitle(marker: Marker): string {
    const emoji = getObstacleEmoji(marker.obstacleType);
    const type = marker.obstacleType.replace(/_/g, " ").replace(
        /\b\w/g,
        (char) => char.toUpperCase(),
    );
    return `${emoji} ${type}`;
}

/**
 * Format marker description for map callout
 */
export function formatMarkerDescription(
    marker: Marker,
    userPreferences?: UserPreferences,
): string {
    const severity = marker.obstacleScore >= 4
        ? "High"
        : marker.obstacleScore >= 2
        ? "Medium"
        : "Low";

    // Use a reasonable default distance since we don't have real distance calculation in the original
    const distanceText = formatDistance(
        0.2,
        userPreferences?.preferedUnit as any,
    );

    return `${severity} severity: ${
        marker.description || "No description"
    } - ${distanceText} away`;
}

/**
 * Filter route points for visual display
 * Reduces the number of route points shown as visual cues
 */
export function filterRoutePointsForDisplay(
    routeCoordinates: RoutePoint[],
    maxPoints: number = 10,
): RoutePoint[] {
    if (routeCoordinates.length <= 2) return []; // Skip first and last points

    return routeCoordinates
        .filter((_, index) => {
            // Skip first and last points
            if (index === 0 || index === routeCoordinates.length - 1) {
                return false;
            }

            // For shorter routes, show every 3rd point
            if (routeCoordinates.length < 20) return index % 3 === 0;

            // For longer routes, space points evenly up to maxPoints
            return index % Math.floor(routeCoordinates.length / maxPoints) ===
                0;
        });
}

/**
 * Validate route data to ensure it's usable
 */
export function validateRouteData(routeData: any): boolean {
    if (!routeData) return false;
    if (!routeData.points || !Array.isArray(routeData.points)) return false;
    if (routeData.points.length < 2) return false;

    // Validate that points have required coordinates
    return routeData.points.every((point: any) =>
        typeof point.latitude === "number" &&
        typeof point.longitude === "number" &&
        !isNaN(point.latitude) &&
        !isNaN(point.longitude)
    );
}

/**
 * Ensure valid route data, handling nested responses
 */
export function ensureValidRouteData(routeData: any): any | null {
    if (!routeData) return null;

    // Check if points is missing but exists in a nested data property
    if (!routeData.points && routeData.data && routeData.data.points) {
        return routeData.data;
    }

    return validateRouteData(routeData) ? routeData : null;
}

/**
 * Check if a location coordinate is valid (not default/zero coordinates)
 */
export function isValidLocation(
    location: LocationCoordinate | null | undefined,
): boolean {
    if (!location) return false;

    return (
        typeof location.latitude === "number" &&
        typeof location.longitude === "number" &&
        !isNaN(location.latitude) &&
        !isNaN(location.longitude) &&
        (Math.abs(location.latitude) > 0.000001 ||
            Math.abs(location.longitude) > 0.000001)
    );
}

/**
 * Check if route distance is reasonable (not too long)
 */
export function isRouteDistanceReasonable(
    distance: number,
    maxDistanceKm: number = 50,
): boolean {
    return distance > 0 && distance <= maxDistanceKm;
}

/**
 * Create error message for route calculation failures
 */
export function createRouteErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return "Failed to calculate a route. Please try again.";
}

/**
 * Get marker display properties
 */
export function getMarkerDisplayProps(marker: Marker) {
    return {
        title: formatMarkerTitle(marker),
        color: getObstacleColor(marker.obstacleScore),
        icon: getObstacleIcon(marker.obstacleType),
    };
}
