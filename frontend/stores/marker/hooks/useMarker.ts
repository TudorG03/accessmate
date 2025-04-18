import { useCallback } from "react";
import { useMarkerStore } from "../marker.store";
import {
    MarkerCreate,
    MarkerLocation,
    MarkerUpdate,
} from "@/types/marker.types";
import * as Location from "expo-location";

/**
 * Custom hook for working with markers
 */
export const useMarker = () => {
    const {
        markers,
        userMarkers,
        nearbyMarkers,
        isLoading,
        error,
        fetchMarkers,
        fetchUserMarkers,
        fetchNearbyMarkers,
        createMarker,
        updateMarker,
        deleteMarker,
        clearError,
    } = useMarkerStore();

    /**
     * Create a marker at the user's current location
     */
    const createMarkerAtCurrentLocation = useCallback(
        async (
            markerData: Omit<MarkerCreate, "location">,
        ) => {
            try {
                // Request location permissions if needed
                const { status } = await Location
                    .requestForegroundPermissionsAsync();
                if (status !== "granted") {
                    throw new Error("Location permission not granted");
                }

                // Get current location
                const currentLocation = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                // Create the marker with current location
                const fullMarkerData: MarkerCreate = {
                    ...markerData,
                    location: {
                        latitude: currentLocation.coords.latitude,
                        longitude: currentLocation.coords.longitude,
                    },
                };

                return await createMarker(fullMarkerData);
            } catch (error) {
                console.error(
                    "Error creating marker at current location:",
                    error,
                );
                return null;
            }
        },
        [createMarker],
    );

    /**
     * Find markers near the specified location or user's current location
     */
    const findNearbyMarkers = useCallback(
        async (radiusInMeters = 300, customLocation?: MarkerLocation) => {
            try {
                // If custom location is provided, use it
                if (customLocation) {
                    // Find nearby markers using the provided location
                    await fetchNearbyMarkers(
                        customLocation,
                        radiusInMeters,
                    );
                    return nearbyMarkers;
                }

                // Otherwise, get current user location
                // Request location permissions if needed
                const { status } = await Location
                    .requestForegroundPermissionsAsync();
                if (status !== "granted") {
                    throw new Error("Location permission not granted");
                }

                // Get current location
                const currentLocation = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                // Find nearby markers
                await fetchNearbyMarkers(
                    {
                        latitude: currentLocation.coords.latitude,
                        longitude: currentLocation.coords.longitude,
                    },
                    radiusInMeters,
                );

                return nearbyMarkers;
            } catch (error) {
                console.error("Error finding nearby markers:", error);
                return [];
            }
        },
        [fetchNearbyMarkers, nearbyMarkers],
    );

    return {
        // State
        markers,
        userMarkers,
        nearbyMarkers,
        isLoading,
        error,

        // Basic operations
        fetchMarkers,
        fetchUserMarkers,
        fetchNearbyMarkers,
        createMarker,
        updateMarker,
        deleteMarker,
        clearError,

        // Enhanced operations
        createMarkerAtCurrentLocation,
        findNearbyMarkers,
    };
};
