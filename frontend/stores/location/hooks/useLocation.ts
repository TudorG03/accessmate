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
    } = useLocationStore();

    const [isInitializing, setIsInitializing] = useState(false);

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

            // Get initial location
            await getCurrentLocation();

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
    }, [isTrackingEnabled, setIsTrackingEnabled, clearExpiredProcessedMarkers]);

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
    };
}
