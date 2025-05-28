import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { MarkerService } from "@/stores/marker/marker.service";
import { calculateDistance } from "@/stores/marker/marker.utils";
import { useLocationStore } from "@/stores/location/location.store";
import { sendObstacleValidationNotification } from "./notification.service";
import * as Notifications from "expo-notifications";
import { isAuthenticated } from "@/stores/auth/auth.utils";

// Define the background task name
export const LOCATION_TRACKING_TASK = "background-location-tracking";

// Define the proximity threshold in meters
const MARKER_PROXIMITY_THRESHOLD = 100;
const LOCATION_UPDATE_INTERVAL = 2000; // 2 seconds - updated for faster location updates

// Register the background task
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
    if (error) {
        console.error("Location tracking task error:", error);
        return;
    }

    if (!data) {
        console.warn("Location tracking task received no data");
        return;
    }

    // Extract location from the data
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    // Get the most recent location
    const location = locations[locations.length - 1];

    console.log(
        `📍 Location update: ${location.coords.latitude.toFixed(6)}, ${
            location.coords.longitude.toFixed(6)
        }`,
    );

    // Update the location in store
    const { setCurrentLocation, setLastLocationUpdateTime } = useLocationStore
        .getState();
    setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
    });
    setLastLocationUpdateTime(new Date());

    // Check for nearby markers
    await checkNearbyMarkers(location);
});

/**
 * Check for markers near the current location
 */
async function checkNearbyMarkers(location: Location.LocationObject) {
    try {
        console.log(
            `🔍 Checking for nearby markers at ${
                location.coords.latitude.toFixed(6)
            }, ${location.coords.longitude.toFixed(6)}`,
        );

        // Check authentication before making API calls
        if (!(await isAuthenticated())) {
            console.log(
                "❌ User not authenticated, skipping nearby marker check",
            );
            return;
        }

        // Get the current tracking settings
        const {
            isTrackingEnabled,
            clearExpiredProcessedMarkers,
            addProcessedMarker,
            getProcessedMarkerIds,
        } = useLocationStore.getState();

        if (!isTrackingEnabled) {
            console.log(
                "❌ Location tracking is disabled, skipping marker check",
            );
            return;
        }

        // Clear expired processed markers
        clearExpiredProcessedMarkers();
        console.log("🧹 Cleared expired processed markers list");

        // Get nearby markers from the service
        try {
            console.log(`📊 Fetching markers within 100m radius`);
            const markers = await MarkerService.getMarkersNearLocation(
                {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                },
                100, // Get markers within 100 meters
            );

            // Skip if no markers nearby
            if (!markers || markers.length === 0) {
                console.log("📊 No markers found nearby");
                return;
            }

            console.log(`📊 Found ${markers.length} total markers nearby`);

            // Get processed marker IDs to prevent duplicate notifications
            const processedMarkerIds = getProcessedMarkerIds();

            // Log marker details for debugging
            markers.forEach((marker, index) => {
                console.log(
                    `📌 Marker ${
                        index + 1
                    }: type=${marker.obstacleType}, id=${marker.id}, 
                position=${marker.location.latitude.toFixed(6)},${
                        marker.location.longitude.toFixed(6)
                    }`,
                );
            });

            // Group markers by type
            const markersByType = markers.reduce((acc, marker) => {
                // Calculate distance to the marker
                const distance = calculateDistance(
                    location.coords.latitude,
                    location.coords.longitude,
                    marker.location.latitude,
                    marker.location.longitude,
                );

                console.log(
                    `📏 Distance to marker ${marker.id}: ${
                        distance.toFixed(2)
                    }m (threshold: ${MARKER_PROXIMITY_THRESHOLD}m)`,
                );

                // Check if within threshold and not recently processed
                if (
                    distance <= MARKER_PROXIMITY_THRESHOLD &&
                    marker.id && // Ensure marker has an ID
                    !processedMarkerIds.includes(marker.id) // Check if not recently processed
                ) {
                    console.log(
                        `✅ Marker ${marker.id} is within threshold: ${
                            distance.toFixed(2)
                        }m and not recently processed`,
                    );
                    // Group by obstacle type
                    if (!acc[marker.obstacleType]) {
                        acc[marker.obstacleType] = [];
                    }
                    acc[marker.obstacleType].push({ ...marker, distance });

                    // Mark this marker as processed
                    addProcessedMarker(marker.id);
                }

                return acc;
            }, {} as Record<string, Array<any>>);

            // Debug output
            const typesCount = Object.keys(markersByType).length;
            console.log(
                `📊 Found ${typesCount} types of obstacles nearby for validation`,
            );

            if (typesCount === 0) {
                console.log(
                    "❌ No new markers within the proximity threshold to validate",
                );
            } else {
                // Send validation notifications for each obstacle type
                for (
                    const [obstacleType, typeMarkers] of Object.entries(
                        markersByType,
                    )
                ) {
                    if (typeMarkers.length > 0) {
                        console.log(
                            `🔔 Attempting to send validation notification for ${typeMarkers.length} nearby ${obstacleType} markers`,
                        );

                        try {
                            // Send notification for this obstacle type
                            const notified =
                                await sendObstacleValidationNotification(
                                    obstacleType,
                                    typeMarkers,
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
            }
        } catch (markerError) {
            console.error("❌ Error fetching nearby markers:", markerError);
        }
    } catch (error) {
        console.error("❌ Error checking nearby markers:", error);
    }
}

/**
 * Request location permissions from the user
 */
export async function requestLocationPermissions(): Promise<boolean> {
    try {
        console.log("📍 Requesting location permissions...");

        // Request foreground permission first
        const { status: foregroundStatus } = await Location
            .requestForegroundPermissionsAsync();
        console.log(
            `📍 Foreground location permission status: ${foregroundStatus}`,
        );

        if (foregroundStatus !== "granted") {
            console.log("❌ Foreground location permission denied");
            return false;
        }

        // Request notification permissions on all platforms
        try {
            console.log(
                "🔔 Requesting notification permissions from location service...",
            );
            const { status: notificationStatus } = await Notifications
                .getPermissionsAsync();
            console.log(
                `🔔 Current notification permission status: ${notificationStatus}`,
            );

            if (notificationStatus !== "granted") {
                console.log(
                    "🔔 Notification permissions not granted, requesting now...",
                );
                const { status: newStatus } = await Notifications
                    .requestPermissionsAsync();
                console.log(
                    `🔔 New notification permission status: ${newStatus}`,
                );

                if (newStatus !== "granted") {
                    console.warn("⚠️ Notification permissions were denied");
                    // Continue anyway as location might still work
                }
            }
        } catch (notificationError) {
            console.error(
                "❌ Error requesting notification permissions:",
                notificationError,
            );
            // Continue anyway as location is the primary permission
        }

        // Request background permission if on iOS or Android
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

/**
 * Start tracking user location
 */
export async function startLocationTracking(): Promise<boolean> {
    try {
        const permissionGranted = await requestLocationPermissions();
        if (!permissionGranted) return false;

        // Check if the task is already defined and running
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(
            LOCATION_TRACKING_TASK,
        ).catch(() => false); // Handle potential exceptions gracefully

        if (hasStarted) {
            console.log("Location tracking already started");
            return true;
        }

        console.log("Starting location tracking service...");

        // Different config options based on platform
        const trackingOptions: Location.LocationTaskOptions = {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: LOCATION_UPDATE_INTERVAL,
            distanceInterval: 10, // Only notify when user moves more than 10 meters
            showsBackgroundLocationIndicator: true,
            activityType: Location.ActivityType.Fitness,
        };

        // Add foreground service options for Android
        if (Platform.OS === "android") {
            trackingOptions.foregroundService = {
                notificationTitle: "AccessMate",
                notificationBody: "Detecting nearby accessibility obstacles",
                notificationColor: "#F1B24A",
            };
        }

        // Start location updates with appropriate options
        await Location.startLocationUpdatesAsync(
            LOCATION_TRACKING_TASK,
            trackingOptions,
        );

        console.log("Location tracking started successfully");
        const { setIsTrackingEnabled } = useLocationStore.getState();
        setIsTrackingEnabled(true);
        return true;
    } catch (error) {
        console.error("Error starting location tracking:", error);
        return false;
    }
}

/**
 * Stop tracking user location
 */
export async function stopLocationTracking(): Promise<boolean> {
    try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(
            LOCATION_TRACKING_TASK,
        );
        if (!hasStarted) {
            console.log("Location tracking not started");
            return true;
        }

        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
        console.log("Location tracking stopped");

        const { setIsTrackingEnabled } = useLocationStore.getState();
        setIsTrackingEnabled(false);
        return true;
    } catch (error) {
        console.error("Error stopping location tracking:", error);
        return false;
    }
}

/**
 * Get the current location once
 */
export async function getCurrentLocation(): Promise<
    Location.LocationObject | null
> {
    try {
        const permissionGranted = await requestLocationPermissions();
        if (!permissionGranted) return null;

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        // Update location in store
        const { setCurrentLocation, setLastLocationUpdateTime } =
            useLocationStore.getState();
        setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        });
        setLastLocationUpdateTime(new Date());

        return location;
    } catch (error) {
        console.error("Error getting current location:", error);
        return null;
    }
}
