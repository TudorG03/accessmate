/**
 * Map Configuration
 * Centralizes all map-related constants and configuration values
 */

export const MAP_CONFIG = {
    // Marker Configuration
    MARKERS: {
        MAX_VISIBLE: 30,
        FETCH_RADIUS_DEFAULT: 2000,
        FETCH_RADIUS_MIN: 300,
        FETCH_RADIUS_MAX: 1500,
        CLUSTER_THRESHOLD: 15,
    },

    // Map Region Configuration
    REGION: {
        DEFAULT_LATITUDE_DELTA: 0.01,
        DEFAULT_LONGITUDE_DELTA: 0.01,
        ZOOM_ANIMATION_DURATION: 1000,
        REGION_CHANGE_THRESHOLD: 0.001,
    },

    // Navigation Configuration
    NAVIGATION: {
        MAX_ROUTE_DISTANCE_KM: 50,
        ROUTE_PADDING: {
            top: 80,
            right: 50,
            bottom: 80,
            left: 50,
        },
        ROUTE_STROKE_WIDTH: 5,
        ROUTE_GLOW_WIDTH: 8,
        ROUTE_DASH_PATTERN: [5, 5],
        ROUTE_POINT_SIZE: 8,
        ROUTE_POINT_SPACING_SHORT: 3,
        ROUTE_POINT_SPACING_LONG: 10,
    },

    // UI Configuration
    UI: {
        BUTTON_SIZE: 60,
        BOTTOM_MARGIN: 8,
        SIDE_MARGIN: 5,
        LOADING_SPINNER_SIZE: "large" as const,
        SMALL_SPINNER_SIZE: "small" as const,
    },

    // Default Location (Fallback)
    DEFAULT_LOCATION: {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    },

    // Color Configuration
    COLORS: {
        PRIMARY: "#F1B24A",
        ROUTE_GLOW: "rgba(241, 178, 74, 0.3)",
        WHITE: "#ffffff",
        TRANSPARENT_BLACK: "rgba(0, 0, 0, 0.3)",
    },

    // Performance Configuration
    PERFORMANCE: {
        REGION_CHANGE_DEBOUNCE_MS: 300,
        MARKER_UPDATE_DEBOUNCE_MS: 500,
        MAX_ROUTE_POINTS_FOR_VISUAL: 20,
    },
} as const;

/**
 * Calculate search radius based on visible region
 */
export function calculateSearchRadius(latitudeDelta: number): number {
    const latKm = 111; // 1 degree of latitude ≈ 111km
    const visibleRadiusInMeters = (latitudeDelta * latKm * 1000) / 2;

    return Math.max(
        MAP_CONFIG.MARKERS.FETCH_RADIUS_MIN,
        Math.min(
            MAP_CONFIG.MARKERS.FETCH_RADIUS_MAX,
            Math.round(visibleRadiusInMeters),
        ),
    );
}

/**
 * Create default region with optional overrides
 */
export function createDefaultRegion(
    overrides?: Partial<{
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    }>,
): {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
} {
    return {
        ...MAP_CONFIG.DEFAULT_LOCATION,
        ...overrides,
    };
}

/**
 * Check if two regions are significantly different
 */
export function hasRegionChanged(
    current: { latitude: number; longitude: number } | null,
    new_region: { latitude: number; longitude: number },
): boolean {
    if (!current) return true;

    return (
        Math.abs(current.latitude - new_region.latitude) >
            MAP_CONFIG.REGION.REGION_CHANGE_THRESHOLD ||
        Math.abs(current.longitude - new_region.longitude) >
            MAP_CONFIG.REGION.REGION_CHANGE_THRESHOLD
    );
}
