import { ObstacleType } from "@/types/marker.types";

/**
 * Calculate distance between two geographic points
 * Using the Haversine formula
 *
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in meters
 */
export function calculateDistance(
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
    const distance = R * c;

    return distance; // in meters
}

/**
 * Get obstacle emoji based on obstacle type
 */
export function getObstacleEmoji(obstacleType: string): string {
    const emojiMap: Record<string, string> = {
        [ObstacleType.STAIRS]: "🪜",
        [ObstacleType.STEEP_RAMP]: "📈",
        [ObstacleType.NARROW_PASSAGE]: "↔️",
        [ObstacleType.CONSTRUCTION]: "🚧",
        [ObstacleType.UNEVEN_SURFACE]: "〰️",
        [ObstacleType.NO_SIDEWALK]: "🚫",
        [ObstacleType.HIGH_CURB]: "⬆️",
        [ObstacleType.TEMPORARY]: "⏱️",
        [ObstacleType.OTHER]: "❓",
    };

    return emojiMap[obstacleType] || "📍";
}

/**
 * Get color code based on obstacle score
 */
export function getObstacleColor(score: number): string {
    if (score >= 4) return "#d32f2f"; // high severity - red
    if (score >= 2) return "#ff9800"; // medium severity - orange
    return "#4caf50"; // low severity - green
}

/**
 * Construct a human-readable description of the obstacle
 */
export function getObstacleSummary(
    obstacleType: string,
    score: number,
    description?: string,
): string {
    const emoji = getObstacleEmoji(obstacleType);
    const typeFormatted = obstacleType.replace("_", " ").replace(
        /\b\w/g,
        (char) => char.toUpperCase(),
    );

    let summary = `${emoji} ${typeFormatted}`;

    const severityText = score >= 4
        ? "High severity"
        : score >= 2
        ? "Medium severity"
        : "Low severity";

    summary += ` (${severityText})`;

    if (description) {
        summary += `: ${description}`;
    }

    return summary;
}
