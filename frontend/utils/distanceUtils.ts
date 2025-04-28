import { DistanceUnit } from "@/types/auth.types";

/**
 * Convert distance from kilometers to the user's preferred unit
 *
 * @param distanceInKm Distance in kilometers
 * @param preferedUnit User's preferred unit (kilometers or miles)
 * @returns Formatted distance string with unit
 */
export function formatDistance(
    distanceInKm: number,
    preferedUnit: DistanceUnit = DistanceUnit.KILOMETERS,
): string {
    if (preferedUnit === DistanceUnit.MILES) {
        // Convert km to miles (1 km = 0.621371 miles)
        const distanceInMiles = distanceInKm * 0.621371;
        return `${distanceInMiles.toFixed(1)} mi`;
    } else {
        return `${distanceInKm.toFixed(1)} km`;
    }
}

/**
 * Convert a distance value to the user's preferred unit without formatting
 *
 * @param distanceInKm Distance in kilometers
 * @param preferedUnit User's preferred unit
 * @returns Number in the preferred unit (km or miles)
 */
export function convertDistance(
    distanceInKm: number,
    preferedUnit: DistanceUnit = DistanceUnit.KILOMETERS,
): number {
    if (preferedUnit === DistanceUnit.MILES) {
        return distanceInKm * 0.621371;
    } else {
        return distanceInKm;
    }
}
