import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { useLocationStore } from "@/stores/location/location.store";
import { useLocation } from "@/stores/location/hooks/useLocation";

export type LocationPermissionStatus = "unknown" | "granted" | "denied";

/**
 * Hook for managing location permissions and auto-refresh functionality
 * Extracted from map component for better separation of concerns
 */
export function useMapPermissions() {
    const [locationPermissionStatus, setLocationPermissionStatus] = useState<
        LocationPermissionStatus
    >("unknown");
    const { isTrackingEnabled, toggleTracking } = useLocation();

    // Check location permissions on mount
    useEffect(() => {
        const checkLocationPermissions = async () => {
            try {
                const foregroundStatus = await Location
                    .getForegroundPermissionsAsync();
                setLocationPermissionStatus(
                    foregroundStatus.granted ? "granted" : "denied",
                );
            } catch (error) {
                setLocationPermissionStatus("denied");
            }
        };

        checkLocationPermissions();
    }, []);

    /**
     * Request location permissions and enable tracking
     * Returns true if permissions were granted
     * Location updates are handled by the tracking system
     */
    const requestLocationPermissionsAndRefresh = async (): Promise<boolean> => {
        try {
            const { status } = await Location
                .requestForegroundPermissionsAsync();

            if (status === "granted") {
                setLocationPermissionStatus("granted");

                // Auto-enable tracking when permissions are granted
                // The tracking system will handle location updates and notifications
                if (!isTrackingEnabled) {
                    await toggleTracking();
                }

                return true;
            } else {
                setLocationPermissionStatus("denied");
                return false;
            }
        } catch (error) {
            console.error("Failed to request location permissions:", error);
            setLocationPermissionStatus("denied");
            return false;
        }
    };

    /**
     * Check if location services are available and enabled
     */
    const hasLocationPermission = locationPermissionStatus === "granted";

    /**
     * Check if location tracking is both permitted and enabled
     */
    const canShowUserLocation = hasLocationPermission && isTrackingEnabled;

    return {
        locationPermissionStatus,
        hasLocationPermission,
        canShowUserLocation,
        requestLocationPermissionsAndRefresh,
    };
}
