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

// Export the task name for external use
export const LOCATION_TRACKING_TASK = config.LOCATION_TRACKING_TASK;

// Store references to active tracking state
let backgroundTaskTracker: string | null = null;
let markerCheckInterval: NodeJS.Timeout | null = null;

// Async function to safely get location store
async function getLocationStore() {
    try {
        return useLocationStore.getState();
    } catch (error) {
        return null;
    }
}

// Background task for location tracking
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
    if (error) {
        console.error("❌ Background location task error:", error);
        return;
    }

    if (data) {
        const { locations } = data as any;
        const location = locations[0];

        if (location && isAuthenticatedSimple()) {
            console.log("📍 Background task: Processing location update:", {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy,
                timestamp: new Date(location.timestamp).toISOString(),
            });

            const store = await getLocationStore();
            if (!store) {
                console.warn(
                    "❌ Background task: Could not get location store",
                );
                return;
            }

            // Update location in store with timestamp
            store.setCurrentLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            // Check if tracking is enabled before processing markers
            if (!store.isTrackingEnabled) {
                console.log(
                    "📍 Background task: Tracking disabled, skipping marker check",
                );
                return;
            }

            console.log("📍 Background task: Checking nearby markers...");
            await checkNearbyMarkers(location);
        }
    }
});

// Main cleanup function for location services
export async function cleanupLocationServices(): Promise<void> {
    try {
        // Clean up background task
        if (backgroundTaskTracker) {
            untrackBackgroundTask(backgroundTaskTracker);
            backgroundTaskTracker = null;
        }

        // Clean up interval
        if (markerCheckInterval) {
            untrackInterval(markerCheckInterval);
            clearInterval(markerCheckInterval);
            markerCheckInterval = null;
        }

        // Stop location tracking
        try {
            const isTracking = await Location.hasStartedLocationUpdatesAsync(
                LOCATION_TRACKING_TASK,
            );
            if (isTracking) {
                await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
            }
        } catch (error) {
            // Silent error handling
        }
    } catch (error) {
        // Silent error handling
    }
}

// Register cleanup function
registerCleanupFunction(cleanupLocationServices, CleanupCategory.LOCATION);

// Background task error handler
TaskManager.defineTask(LOCATION_TRACKING_TASK + "_ERROR", async ({ error }) => {
    if (error) {
        // Silent error handling
    }
});

// Function to check for nearby markers and send notifications
async function checkNearbyMarkers(location: Location.LocationObject) {
    try {
        if (!isAuthenticatedSimple()) {
            console.log("📍 Marker check: User not authenticated, skipping");
            return;
        }

        const store = await getLocationStore();
        if (!store) {
            console.warn("❌ Marker check: Could not get location store");
            return;
        }

        // Check if location tracking is enabled
        if (!store.isTrackingEnabled) {
            console.log("📍 Marker check: Tracking disabled, skipping");
            return;
        }

        // Clear expired processed markers periodically
        try {
            console.log("🧹 Clearing expired processed markers...");
            const processedBefore = store.getProcessedMarkerIds().length;
            store.clearExpiredProcessedMarkers();
            const processedAfter = store.getProcessedMarkerIds().length;
            console.log(
                `🧹 Processed markers: ${processedBefore} → ${processedAfter}`,
            );
        } catch (cleanupError) {
            console.warn(
                "⚠️ Marker check: Error clearing expired markers:",
                cleanupError,
            );
        }

        console.log(
            `📍 Marker check: Fetching markers near [${
                location.coords.latitude.toFixed(6)
            }, ${
                location.coords.longitude.toFixed(6)
            }] within ${config.MARKER_PROXIMITY_THRESHOLD}m`,
        );

        // Fetch markers near the user's location
        try {
            const markers = await withTimeout(
                MarkerService.getMarkersNearLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                }, config.MARKER_PROXIMITY_THRESHOLD),
                config.MARKER_FETCH_TIMEOUT,
                "Marker fetch timeout",
            );

            console.log(
                `📍 Marker check: Found ${markers?.length || 0} markers nearby`,
            );

            if (!markers?.length) {
                return;
            }

            await processNearbyMarkers(location, markers, {
                addProcessedMarker: (id: string) =>
                    store.addProcessedMarker(id),
                isMarkerInCooldown: (id: string) =>
                    store.isMarkerInCooldown(id),
            });
        } catch (markerError) {
            console.error(
                "❌ Marker check: Error fetching markers:",
                markerError,
            );
        }
    } catch (error) {
        console.error("❌ Marker check: General error:", error);
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

    console.log(`📍 Processing ${markers.length} markers for notifications`);

    // Log current processed markers count for debugging
    const processedMarkerIds = useLocationStore.getState()
        .getProcessedMarkerIds();
    console.log(
        `📍 Currently ${processedMarkerIds.length} markers in cooldown:`,
        processedMarkerIds.slice(0, 5).map((id) => id.substring(0, 8)),
    );

    // Group markers by obstacle type that are within proximity and not in cooldown
    const markersByType = markers.reduce((acc, marker) => {
        const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            marker.location.latitude,
            marker.location.longitude,
        );

        const inCooldown = marker.id ? isMarkerInCooldown(marker.id) : false;

        console.log(
            `📍 Marker ${
                marker.id?.substring(0, 8)
            } (${marker.obstacleType}): distance=${
                distance.toFixed(1)
            }m, cooldown=${inCooldown}`,
        );

        if (
            distance <= config.MARKER_PROXIMITY_THRESHOLD && marker.id &&
            !inCooldown
        ) {
            if (!acc[marker.obstacleType]) {
                acc[marker.obstacleType] = [];
            }
            acc[marker.obstacleType].push({ ...marker, distance });

            // DON'T add to processed list here - wait until notification is sent
            console.log(
                `📍 Queued marker ${
                    marker.id.substring(0, 8)
                } for ${marker.obstacleType} notification`,
            );
        } else if (inCooldown) {
            console.log(
                `⏰ Marker ${
                    marker.id?.substring(0, 8)
                } in cooldown, skipping notification`,
            );
        }

        return acc;
    }, {} as Record<string, Array<any>>);

    const notificationTypes = Object.keys(markersByType);
    console.log(
        `📍 Will send notifications for ${notificationTypes.length} obstacle types:`,
        notificationTypes,
    );

    // Send notifications and add markers to cooldown only after successful sending
    await sendNotificationsForMarkerTypes(markersByType, addProcessedMarker);
}

async function sendNotificationsForMarkerTypes(
    markersByType: Record<string, Array<any>>,
    addProcessedMarker: (id: string) => void,
) {
    const typesCount = Object.keys(markersByType).length;

    if (typesCount === 0) {
        console.log(
            "📍 No notifications to send - no markers in range or all in cooldown",
        );
        return;
    }

    console.log(`📍 Sending notifications for ${typesCount} obstacle types`);

    for (const [obstacleType, typeMarkers] of Object.entries(markersByType)) {
        if (typeMarkers.length === 0) continue;

        console.log(
            `📍 Sending notification for ${obstacleType}: ${typeMarkers.length} markers`,
        );

        try {
            const notified = await withTimeout(
                sendObstacleValidationNotification(obstacleType, typeMarkers),
                config.NOTIFICATION_TIMEOUT,
                "Notification timeout",
            );

            if (notified) {
                console.log(
                    `✅ Successfully sent notification for ${obstacleType}`,
                );

                // Add markers to cooldown after successful notification
                for (const marker of typeMarkers) {
                    try {
                        addProcessedMarker(marker.id);
                        console.log(
                            `📍 Added marker ${
                                marker.id.substring(0, 8)
                            } to processed list`,
                        );
                    } catch (processError) {
                        console.warn(
                            `⚠️ Error adding marker ${marker.id} to processed list:`,
                            processError,
                        );
                    }
                }
            } else {
                console.warn(
                    `⚠️ Failed to send notification for ${obstacleType}`,
                );
                // Don't add to cooldown if notification failed
            }
        } catch (notificationError) {
            console.error(
                `❌ Error sending notification for ${obstacleType}:`,
                notificationError,
            );
            // Don't add to cooldown if notification failed
        }
    }
}

// Helper function to add timeout to promises
function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        ),
    ]);
}

// Request location permissions
export async function requestLocationPermissions(): Promise<boolean> {
    try {
        // Request foreground location permission
        let { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
            return false;
        }

        // Request notification permissions
        const { status: notificationStatus } = await Notifications
            .requestPermissionsAsync();

        if (notificationStatus !== "granted") {
            // Continue without notifications but allow location tracking
        }

        // On iOS, also request background location permission
        if (Platform.OS === "ios") {
            const { status: backgroundStatus } = await Location
                .requestBackgroundPermissionsAsync();

            if (backgroundStatus !== "granted") {
                return false;
            }
        }

        return true;
    } catch (error) {
        return false;
    }
}

// Start location tracking
export async function startLocationTracking(): Promise<boolean> {
    try {
        // Check if tracking is already started
        const isAlreadyTracking = await Location.hasStartedLocationUpdatesAsync(
            LOCATION_TRACKING_TASK,
        );

        if (isAlreadyTracking) {
            return true;
        }

        // Start location tracking
        await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: config.LOCATION_UPDATE_INTERVAL,
            distanceInterval: config.MINIMUM_DISTANCE_CHANGE,
            deferredUpdatesInterval: config.LOCATION_UPDATE_INTERVAL,
            foregroundService: {
                notificationTitle: config.NOTIFICATION_TITLE,
                notificationBody: config.NOTIFICATION_BODY,
                notificationColor: config.NOTIFICATION_COLOR,
            },
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: false,
        });

        // Track the background task
        trackBackgroundTask(LOCATION_TRACKING_TASK);
        backgroundTaskTracker = LOCATION_TRACKING_TASK;

        return true;
    } catch (error) {
        return false;
    }
}

// Stop location tracking
export async function stopLocationTracking(): Promise<boolean> {
    try {
        const isTracking = await Location.hasStartedLocationUpdatesAsync(
            LOCATION_TRACKING_TASK,
        );

        if (!isTracking) {
            return true;
        }

        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);

        // Clean up background task tracker
        if (backgroundTaskTracker) {
            untrackBackgroundTask(backgroundTaskTracker);
            backgroundTaskTracker = null;
        }

        return true;
    } catch (error) {
        return false;
    }
}

// Get current location
export async function getCurrentLocation(): Promise<
    Location.LocationObject | null
> {
    try {
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        return location;
    } catch (error) {
        return null;
    }
}

// Enhanced cleanup function (exported for external use)
export async function stopLocationTrackingAndCleanup(): Promise<void> {
    try {
        // Stop location tracking
        const isTracking = await Location.hasStartedLocationUpdatesAsync(
            LOCATION_TRACKING_TASK,
        );
        if (isTracking) {
            await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
        }

        // Clean up background task
        if (backgroundTaskTracker) {
            untrackBackgroundTask(backgroundTaskTracker);
            backgroundTaskTracker = null;
        }

        // Clean up intervals
        if (markerCheckInterval) {
            untrackInterval(markerCheckInterval);
            clearInterval(markerCheckInterval);
            markerCheckInterval = null;
        }
    } catch (error) {
        // Silent error handling
    }
}
