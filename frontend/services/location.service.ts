import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { MarkerService } from "@/stores/marker/marker.service";
import { calculateDistance } from "@/stores/marker/marker.utils";
import { useLocationStore } from "@/stores/location/location.store";
import { sendObstacleValidationNotification } from "./notification.service";
import * as Notifications from "expo-notifications";
import { isAuthenticatedSimple } from "@/stores/auth/auth.token-utils";
import {
    CleanupCategory,
    registerCleanupFunction,
    trackBackgroundTask,
    trackInterval,
    untrackBackgroundTask,
    untrackInterval,
} from "./cleanup.service";
import { getLocationConfig } from "@/config/location.config";

// Get configuration instance
const config = getLocationConfig();

// Validate configuration on service initialization
const configValidation = config.validateConfiguration();
if (!configValidation.isValid) {
    console.error(
        "❌ Location service configuration validation failed:",
        configValidation.errors,
    );
    console.log("📍 Current configuration:", config.getConfigSnapshot());
} else {
    console.log("✅ Location service configuration validated successfully");
}

// Export the task name for external use
export const LOCATION_TRACKING_TASK = config.LOCATION_TRACKING_TASK;

// State
let cleanupInterval: NodeJS.Timeout | null = null;
let isTrackingActive = false;

// Helper Functions
const safeGetLocationStore = () => {
    try {
        return useLocationStore.getState();
    } catch (error) {
        console.error("❌ Error accessing location store:", error);
        return null;
    }
};

const withTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = "Operation timeout",
): Promise<T> => {
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
            () => reject(new Error(errorMessage)),
            timeoutMs,
        );
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);
        return result;
    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        throw error;
    }
};

const executeWithStore = <T>(
    operation: (store: ReturnType<typeof useLocationStore.getState>) => T,
    fallback?: T,
): T | undefined => {
    const store = safeGetLocationStore();
    if (!store) {
        console.error("❌ Store not available for operation");
        return fallback;
    }
    return operation(store);
};

const logLocation = (location: Location.LocationObject, context: string) => {
    console.log(
        `📍 ${context}: ${location.coords.latitude.toFixed(6)}, ${
            location.coords.longitude.toFixed(6)
        }`,
    );
};

const manageCleanupInterval = (start: boolean) => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        untrackInterval(cleanupInterval);
        cleanupInterval = null;
    }

    if (start) {
        cleanupInterval = setInterval(() => {
            executeWithStore((store) => store.clearExpiredProcessedMarkers());
        }, config.CLEANUP_INTERVAL);
        trackInterval(cleanupInterval);
    }
};

// Register cleanup
registerCleanupFunction(async () => {
    console.log("🧹 Executing location service cleanup...");

    manageCleanupInterval(false);

    try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(
            config.LOCATION_TRACKING_TASK,
        );
        if (hasStarted) {
            await Location.stopLocationUpdatesAsync(
                config.LOCATION_TRACKING_TASK,
            );
            untrackBackgroundTask(config.LOCATION_TRACKING_TASK);
            console.log("🧹 Location tracking stopped during cleanup");
        }
    } catch (error) {
        console.error(
            "❌ Error stopping location tracking during cleanup:",
            error,
        );
    }

    isTrackingActive = false;
    console.log("✅ Location service cleanup completed");
}, CleanupCategory.LOCATION);

// Background Task
TaskManager.defineTask(
    config.LOCATION_TRACKING_TASK,
    async ({ data, error }) => {
        if (error) {
            console.error("Location tracking task error:", error);
            return;
        }

        const { locations } =
            data as { locations: Location.LocationObject[] } ||
            {};
        if (!locations?.length) return;

        const location = locations[locations.length - 1];
        logLocation(location, "Background update");

        executeWithStore((store) => {
            store.setCurrentLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
            store.setLastLocationUpdateTime(new Date());
        });

        await checkNearbyMarkers(location);
    },
);

// Core Functions
async function checkNearbyMarkers(location: Location.LocationObject) {
    try {
        logLocation(location, "Checking for nearby markers");

        if (!isAuthenticatedSimple()) {
            console.log(
                "❌ User not authenticated, skipping nearby marker check",
            );
            return;
        }

        const store = safeGetLocationStore();
        if (!store?.isTrackingEnabled) {
            console.log("❌ Location tracking disabled, skipping marker check");
            return;
        }

        const {
            clearExpiredProcessedMarkers,
            addProcessedMarker,
            isMarkerInCooldown,
        } = store;

        try {
            clearExpiredProcessedMarkers();
            console.log("🧹 Cleared expired processed markers");
        } catch (cleanupError) {
            console.error("❌ Error clearing expired markers:", cleanupError);
        }

        try {
            console.log(
                `📊 Fetching markers within ${config.MARKER_PROXIMITY_THRESHOLD}m radius`,
            );

            const markers = await withTimeout(
                MarkerService.getMarkersNearLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                }, config.MARKER_PROXIMITY_THRESHOLD),
                config.MARKER_FETCH_TIMEOUT,
                "Marker fetch timeout",
            );

            if (!markers?.length) {
                console.log("📊 No markers found nearby");
                return;
            }

            console.log(`📊 Found ${markers.length} total markers nearby`);
            await processNearbyMarkers(location, markers, {
                addProcessedMarker,
                isMarkerInCooldown,
            });
        } catch (markerError) {
            console.error("❌ Error fetching nearby markers:", markerError);
            if (
                markerError instanceof Error &&
                markerError.message !== "Marker fetch timeout"
            ) {
                console.log(
                    "🔄 Will retry marker check in next location update",
                );
            }
        }
    } catch (error) {
        console.error("❌ Critical error in checkNearbyMarkers:", error);
        if (error instanceof Error && error.stack) {
            console.error("Stack trace:", error.stack);
        }
    }
}

async function processNearbyMarkers(
    location: Location.LocationObject,
    markers: any[],
    storeFunctions: {
        addProcessedMarker: (id: string) => void;
        isMarkerInCooldown: (id: string) => boolean;
    },
) {
    const { addProcessedMarker, isMarkerInCooldown } = storeFunctions;

    // Log marker details
    markers.forEach((marker, index) => {
        console.log(
            `📌 Marker ${
                index + 1
            }: type=${marker.obstacleType}, id=${marker.id}, ` +
                `position=${marker.location.latitude.toFixed(6)},${
                    marker.location.longitude.toFixed(6)
                }`,
        );
    });

    // Process markers and group by type
    const markersByType = markers.reduce((acc, marker) => {
        const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            marker.location.latitude,
            marker.location.longitude,
        );

        console.log(
            `📏 Distance to marker ${marker.id}: ${
                distance.toFixed(2)
            }m (threshold: ${config.MARKER_PROXIMITY_THRESHOLD}m)`,
        );

        if (
            distance <= config.MARKER_PROXIMITY_THRESHOLD && marker.id &&
            !isMarkerInCooldown(marker.id)
        ) {
            console.log(
                `✅ Marker ${marker.id} is within threshold and not in cooldown`,
            );

            if (!acc[marker.obstacleType]) {
                acc[marker.obstacleType] = [];
            }
            acc[marker.obstacleType].push({ ...marker, distance });

            try {
                addProcessedMarker(marker.id);
            } catch (processError) {
                console.error(
                    `❌ Error marking marker ${marker.id} as processed:`,
                    processError,
                );
            }
        } else if (
            distance <= config.MARKER_PROXIMITY_THRESHOLD && marker.id &&
            isMarkerInCooldown(marker.id)
        ) {
            logCooldownStatus(marker.id, distance);
        }

        return acc;
    }, {} as Record<string, Array<any>>);

    await sendNotificationsForMarkerTypes(markersByType);
}

function logCooldownStatus(markerId: string, distance: number) {
    const store = safeGetLocationStore();
    if (!store) return;

    const timestamp = store.processedTimestamps[markerId];
    if (timestamp) {
        const elapsed = Date.now() - timestamp;
        const remaining = config.MARKER_COOLDOWN_DURATION - elapsed;
        const remainingMinutes = Math.ceil(remaining / (60 * 1000));

        console.log(
            `⏳ Marker ${markerId} is in cooldown period (${
                distance.toFixed(2)
            }m away) - ${remainingMinutes} minutes remaining`,
        );
    }
}

async function sendNotificationsForMarkerTypes(
    markersByType: Record<string, Array<any>>,
) {
    const typesCount = Object.keys(markersByType).length;
    console.log(
        `📊 Found ${typesCount} types of obstacles nearby for validation`,
    );

    if (typesCount === 0) {
        console.log(
            "❌ No new markers within the proximity threshold to validate",
        );
        return;
    }

    for (const [obstacleType, typeMarkers] of Object.entries(markersByType)) {
        if (typeMarkers.length === 0) continue;

        console.log(
            `🔔 Attempting to send validation notification for ${typeMarkers.length} nearby ${obstacleType} markers`,
        );

        try {
            const notified = await withTimeout(
                sendObstacleValidationNotification(obstacleType, typeMarkers),
                config.NOTIFICATION_TIMEOUT,
                "Notification timeout",
            );

            if (notified) {
                console.log(
                    `✅ Successfully sent validation notification for ${obstacleType}`,
                );
            } else {
                console.warn(
                    `❌ Failed to send validation notification for ${obstacleType}`,
                );
            }
        } catch (notificationError) {
            console.error(
                `❌ Error sending validation notification for ${obstacleType}:`,
                notificationError,
            );
        }
    }
}

export async function requestLocationPermissions(): Promise<boolean> {
    try {
        console.log("📍 Requesting location permissions...");

        // Request foreground permission
        const { status: foregroundStatus } = await Location
            .requestForegroundPermissionsAsync();
        console.log(
            `📍 Foreground location permission status: ${foregroundStatus}`,
        );

        if (foregroundStatus !== "granted") {
            console.log("❌ Foreground location permission denied");
            return false;
        }

        // Request notification permissions
        try {
            console.log("🔔 Requesting notification permissions...");
            const { status: notificationStatus } = await Notifications
                .getPermissionsAsync();
            console.log(
                `🔔 Current notification permission status: ${notificationStatus}`,
            );

            if (notificationStatus !== "granted") {
                const { status: newStatus } = await Notifications
                    .requestPermissionsAsync();
                console.log(
                    `🔔 New notification permission status: ${newStatus}`,
                );

                if (newStatus !== "granted") {
                    console.warn("⚠️ Notification permissions were denied");
                }
            }
        } catch (notificationError) {
            console.error(
                "❌ Error requesting notification permissions:",
                notificationError,
            );
        }

        // Request background permission for iOS
        if (Platform.OS === "ios") {
            console.log("📱 Requesting iOS background location permissions...");
            const { status: backgroundStatus } = await Location
                .requestBackgroundPermissionsAsync();
            console.log(
                `📱 iOS background location permission status: ${backgroundStatus}`,
            );

            if (backgroundStatus !== "granted") {
                console.log("❌ Background location permission denied");
                return false;
            }
        }

        console.log("✅ All required permissions granted successfully");
        return true;
    } catch (error) {
        console.error("❌ Error requesting location permissions:", error);
        return false;
    }
}

export async function startLocationTracking(): Promise<boolean> {
    try {
        const permissionGranted = await requestLocationPermissions();
        if (!permissionGranted) return false;

        const hasStarted = await Location.hasStartedLocationUpdatesAsync(
            config.LOCATION_TRACKING_TASK,
        )
            .catch(() => false);

        if (hasStarted) {
            console.log("Location tracking already started");
            return true;
        }

        console.log("Starting location tracking service...");

        const trackingOptions: Location.LocationTaskOptions = {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: config.LOCATION_UPDATE_INTERVAL,
            distanceInterval: config.MINIMUM_DISTANCE_CHANGE,
            showsBackgroundLocationIndicator: true,
            activityType: Location.ActivityType.Fitness,
        };

        if (Platform.OS === "android") {
            trackingOptions.foregroundService = {
                notificationTitle: config.NOTIFICATION_TITLE,
                notificationBody: config.NOTIFICATION_BODY,
                notificationColor: config.NOTIFICATION_COLOR,
            };
        }

        await Location.startLocationUpdatesAsync(
            config.LOCATION_TRACKING_TASK,
            trackingOptions,
        );

        manageCleanupInterval(true);
        trackBackgroundTask(config.LOCATION_TRACKING_TASK);
        isTrackingActive = true;

        console.log("Location tracking started successfully");
        executeWithStore((store) => store.setIsTrackingEnabled(true));
        return true;
    } catch (error) {
        console.error("Error starting location tracking:", error);
        return false;
    }
}

export async function stopLocationTracking(): Promise<boolean> {
    try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(
            config.LOCATION_TRACKING_TASK,
        );
        if (!hasStarted) {
            console.log("Location tracking not started");
            return true;
        }

        await Location.stopLocationUpdatesAsync(config.LOCATION_TRACKING_TASK);
        console.log("Location tracking stopped");

        executeWithStore((store) => store.setIsTrackingEnabled(false));
        manageCleanupInterval(false);
        untrackBackgroundTask(config.LOCATION_TRACKING_TASK);
        isTrackingActive = false;

        return true;
    } catch (error) {
        console.error("Error stopping location tracking:", error);
        return false;
    }
}

export async function getCurrentLocation(): Promise<
    Location.LocationObject | null
> {
    try {
        const permissionGranted = await requestLocationPermissions();
        if (!permissionGranted) return null;

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        executeWithStore((store) => {
            store.setCurrentLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
            store.setLastLocationUpdateTime(new Date());
        });

        return location;
    } catch (error) {
        console.error("Error getting current location:", error);
        return null;
    }
}

/**
 * @deprecated Use centralized cleanup service instead
 */
export async function cleanupLocationService(): Promise<void> {
    console.log(
        "🧹 Starting location service cleanup (deprecated - use cleanup service)...",
    );

    manageCleanupInterval(false);

    try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(
            config.LOCATION_TRACKING_TASK,
        );
        if (hasStarted) {
            await Location.stopLocationUpdatesAsync(
                config.LOCATION_TRACKING_TASK,
            );
            untrackBackgroundTask(config.LOCATION_TRACKING_TASK);
        }
    } catch (error) {
        console.error("❌ Error stopping location tracking:", error);
    }

    isTrackingActive = false;
    console.log("✅ Location service cleanup completed");
}

/**
 * Debug function to log current location service configuration
 */
export function logLocationServiceConfiguration(): void {
    config.logConfiguration();
    console.log(
        "📍 Location service validation:",
        config.validateConfiguration(),
    );
}

/**
 * Get current location service configuration snapshot
 */
export function getLocationServiceConfiguration() {
    return config.getConfigSnapshot();
}
