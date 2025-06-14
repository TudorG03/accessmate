import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useLocationStore } from "../location.store";
import { getCurrentLocation } from "@/services/location.service";
import { trackingManager } from "@/services/tracking-manager.service";
import { getLocationConfig } from "@/config/location.config";

// Get configuration instance
const config = getLocationConfig();

export function useLocation() {
    const {
        currentLocation,
        lastLocationUpdateTime,
        isTrackingEnabled,
        obstacleCheckRadius,
        getProcessedMarkerIds,
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

    // Initialize TrackingManager-only location system
    const initialize = useCallback(async () => {
        setIsInitializing(true);
        try {
            console.log(
                "🔄 useLocation: Initializing TrackingManager-only location system...",
            );

            // Initialize TrackingManager (no fallback)
            const trackingInitialized = await trackingManager.initialize();
            if (!trackingInitialized) {
                console.error(
                    "❌ useLocation: TrackingManager initialization failed",
                );
                setIsInitializing(false);

                // Show user-friendly error message
                Alert.alert(
                    "Location Setup Issue",
                    "Location tracking couldn't be started automatically. Please check permissions and try enabling it manually in settings.",
                    [{ text: "OK" }],
                );
                return false;
            }

            console.log("✅ useLocation: TrackingManager initialized");

            // Auto-start tracking if it's enabled in store but not actually running
            if (isTrackingEnabled) {
                console.log(
                    "🚀 useLocation: Auto-starting tracking (enabled in store)",
                );
                const started = await trackingManager.startTracking();
                if (started) {
                    console.log("✅ useLocation: Auto-start successful");
                } else {
                    console.warn(
                        "⚠️ useLocation: Auto-start failed, but continuing",
                    );
                }
            } else {
                // If tracking is disabled in store, enable it by default and start it
                console.log(
                    "🔄 useLocation: Enabling tracking by default and starting",
                );
                setIsTrackingEnabled(true);
                const started = await trackingManager.startTracking();
                if (started) {
                    console.log(
                        "✅ useLocation: Default tracking start successful",
                    );
                } else {
                    console.warn(
                        "⚠️ useLocation: Default tracking start failed",
                    );
                    // Don't disable tracking flag, let user manually try later
                }
            }

            // Ensure we have a valid location
            await ensureValidLocation();

            // Clear expired processed markers
            clearExpiredProcessedMarkers();

            console.log(
                "✅ useLocation: TrackingManager-only initialization complete",
            );
            return true;
        } catch (error) {
            console.error(
                "❌ useLocation: Error during initialization:",
                error,
            );

            // Show user-friendly error for unexpected failures
            Alert.alert(
                "Location Error",
                "An unexpected error occurred while setting up location tracking. Please try again.",
                [{ text: "OK" }],
            );
            return false;
        } finally {
            setIsInitializing(false);
        }
    }, [
        clearExpiredProcessedMarkers,
        ensureValidLocation,
        isTrackingEnabled,
        setIsTrackingEnabled,
    ]);

    // Toggle location tracking (TrackingManager-only)
    const toggleTracking = useCallback(async () => {
        try {
            // Use TrackingManager for enhanced tracking control
            if (isTrackingEnabled) {
                const stopped = await trackingManager.stopTracking();
                if (stopped) {
                    setIsTrackingEnabled(false);
                    console.log("✅ useLocation: TrackingManager stopped");
                }
            } else {
                const started = await trackingManager.startTracking();
                if (started) {
                    setIsTrackingEnabled(true);
                    console.log("✅ useLocation: TrackingManager started");
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
            console.error("❌ useLocation: Error toggling tracking:", error);
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

    // Manual retry function for failed tracking initialization
    const retryTracking = useCallback(async () => {
        console.log("🔄 useLocation: Manual retry of tracking initialization");
        setIsInitializing(true);
        try {
            // Try to reinitialize TrackingManager
            const trackingInitialized = await trackingManager.initialize();
            if (trackingInitialized) {
                // Try to start tracking
                const started = await trackingManager.startTracking();
                if (started) {
                    setIsTrackingEnabled(true);
                    Alert.alert(
                        "Success",
                        "Location tracking has been enabled successfully!",
                        [{ text: "OK" }],
                    );
                    return true;
                } else {
                    Alert.alert(
                        "Partial Success",
                        "Location system is ready, but tracking couldn't start. Please check permissions.",
                        [{ text: "OK" }],
                    );
                }
            } else {
                Alert.alert(
                    "Still Having Issues",
                    "Please check your location permissions in device settings and try again.",
                    [{ text: "OK" }],
                );
            }
        } catch (error) {
            console.error("❌ useLocation: Retry failed:", error);
            Alert.alert(
                "Retry Failed",
                "Unable to start location tracking. Please check permissions and try again later.",
                [{ text: "OK" }],
            );
        } finally {
            setIsInitializing(false);
        }
        return false;
    }, [setIsTrackingEnabled]);

    // Initialize on component mount
    useEffect(() => {
        initialize();

        // Cleanup on unmount
        return () => {
            // Nothing to clean up here, as we want tracking to continue in background
        };
    }, []);

    // Initial cleanup of expired processed markers
    useEffect(() => {
        // Only do initial cleanup - periodic cleanup is handled by location service
        clearExpiredProcessedMarkers();
    }, [clearExpiredProcessedMarkers]);

    return {
        currentLocation,
        lastLocationUpdateTime,
        isTrackingEnabled,
        obstacleCheckRadius,
        processedMarkersCount: getProcessedMarkerIds().length,
        isInitializing,
        initialize,
        toggleTracking,
        updateCheckRadius,
        clearAllProcessedMarkers,
        ensureValidLocation,
        retryTracking,
    };
}
