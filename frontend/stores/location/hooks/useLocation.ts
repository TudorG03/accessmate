import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useLocationStore } from "../location.store";
import {
    getCurrentLocation,
    requestLocationPermissions,
    startLocationTracking,
    stopLocationTracking,
} from "@/services/location.service";
import { initializeNotifications } from "@/services/notification.service";

export function useLocation() {
    const {
        currentLocation,
        lastLocationUpdateTime,
        isTrackingEnabled,
        obstacleCheckRadius,
        processedMarkers,
        setIsTrackingEnabled,
        setObstacleCheckRadius,
        clearExpiredProcessedMarkers,
        resetProcessedMarkers,
        getLastKnownLocation,
        getPersistedLocation,
        hasValidPersistedLocation,
    } = useLocationStore();

    const [isInitializing, setIsInitializing] = useState(false);

    // Ensure we have a valid location - either from store or by fetching new
    const ensureValidLocation = useCallback(async () => {
        console.log("Ensuring valid location is available");

        // First check if we have a valid persisted location
        if (hasValidPersistedLocation()) {
            const persistedLocation = getPersistedLocation();
            console.log("Using persisted location:", persistedLocation);
            return persistedLocation!; // We know it's not null because hasValidPersistedLocation returned true
        }

        // If no valid persisted location, try to get current location from GPS
        console.log(
            "No valid persisted location, fetching current location from GPS",
        );
        try {
            const newLocation = await getCurrentLocation();
            if (newLocation) {
                console.log(
                    "Successfully got new GPS location:",
                    newLocation.coords,
                );
                return {
                    latitude: newLocation.coords.latitude,
                    longitude: newLocation.coords.longitude,
                };
            }
        } catch (error) {
            console.warn("Failed to get GPS location:", error);
        }

        // If GPS fails, return default location
        console.log("GPS failed, using default location");
        return getLastKnownLocation(); // This will return the default location
    }, [hasValidPersistedLocation, getPersistedLocation, getLastKnownLocation]);

    // Initialize location tracking and notifications
    const initialize = useCallback(async () => {
        setIsInitializing(true);
        try {
            // Request location permissions
            const locationPermissionGranted =
                await requestLocationPermissions();
            if (!locationPermissionGranted) {
                Alert.alert(
                    "Location Permission Required",
                    "This app needs location access to notify you about nearby obstacles. Please grant location permission in your device settings.",
                    [{ text: "OK" }],
                );
                setIsTrackingEnabled(false);
                setIsInitializing(false);
                return false;
            }

            // Initialize notifications
            const notificationsInitialized = await initializeNotifications();
            if (!notificationsInitialized) {
                Alert.alert(
                    "Notification Permission Required",
                    "This app needs notification permission to alert you about nearby obstacles. Please grant notification permission in your device settings.",
                    [{ text: "OK" }],
                );
            }

            // Ensure we have a valid location
            await ensureValidLocation();

            // Clear expired processed markers
            clearExpiredProcessedMarkers();

            // Start location tracking if enabled
            if (isTrackingEnabled) {
                await startLocationTracking();
            }

            return true;
        } catch (error) {
            console.error("Error initializing location tracking:", error);
            return false;
        } finally {
            setIsInitializing(false);
        }
    }, [
        isTrackingEnabled,
        setIsTrackingEnabled,
        clearExpiredProcessedMarkers,
        ensureValidLocation,
    ]);

    // Toggle location tracking
    const toggleTracking = useCallback(async () => {
        try {
            if (isTrackingEnabled) {
                await stopLocationTracking();
                setIsTrackingEnabled(false);
            } else {
                const permissionGranted = await requestLocationPermissions();
                if (permissionGranted) {
                    await startLocationTracking();
                    setIsTrackingEnabled(true);
                } else {
                    Alert.alert(
                        "Location Permission Required",
                        "This app needs location access to notify you about nearby obstacles. Please grant location permission in your device settings.",
                        [{ text: "OK" }],
                    );
                }
            }
            return isTrackingEnabled;
        } catch (error) {
            console.error("Error toggling location tracking:", error);
            return isTrackingEnabled;
        }
    }, [isTrackingEnabled, setIsTrackingEnabled]);

    // Update check radius
    const updateCheckRadius = useCallback((radius: number) => {
        setObstacleCheckRadius(Math.max(10, Math.min(1000, radius)));
    }, [setObstacleCheckRadius]);

    // Clear all processed markers
    const clearAllProcessedMarkers = useCallback(() => {
        resetProcessedMarkers();
    }, [resetProcessedMarkers]);

    // Initialize on component mount
    useEffect(() => {
        initialize();

        // Cleanup on unmount
        return () => {
            // Nothing to clean up here, as we want tracking to continue in background
        };
    }, []);

    return {
        currentLocation,
        lastLocationUpdateTime,
        isTrackingEnabled,
        obstacleCheckRadius,
        processedMarkersCount: processedMarkers.length,
        isInitializing,
        initialize,
        toggleTracking,
        updateCheckRadius,
        clearAllProcessedMarkers,
        ensureValidLocation,
    };
}
