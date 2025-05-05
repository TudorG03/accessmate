import { useCallback, useState } from "react";
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

    // Local state for tracking fetch results
    const [lastFetchedMarkers, setLastFetchedMarkers] = useState<Marker[]>([]);

    /**
     * Create a marker at the user's current location
     */
    const createMarkerAtCurrentLocation = useCallback(
        async (
            markerData: Omit<MarkerCreate, "location">,
        ) => {
            try {
                console.log("🏷️ Starting marker creation at current location");

                // Request location permissions if needed
                const { status } = await Location
                    .requestForegroundPermissionsAsync();

                console.log("🏷️ Location permission status:", status);

                if (status !== "granted") {
                    console.error("🏷️ Location permission not granted");
                    throw new Error("Location permission not granted");
                }

                // Attempt to get current location with timeout handling
                let currentLocation = null;
                try {
                    console.log("🏷️ Getting current location with timeout");

                    // Create a promise that rejects after 10 seconds
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(
                            () =>
                                reject(new Error("Location request timed out")),
                            10000,
                        );
                    });

                    // Race the location request against the timeout
                    const locationPromise = Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });

                    currentLocation = await Promise.race([
                        locationPromise,
                        timeoutPromise,
                    ]);
                    console.log("🏷️ Got current location:", currentLocation);
                } catch (locationError) {
                    console.error(
                        "🏷️ Error getting current location:",
                        locationError,
                    );

                    // Fallback to last known location
                    console.log(
                        "🏷️ Attempting to get last known location as fallback",
                    );
                    const lastLocation = await Location
                        .getLastKnownPositionAsync();

                    if (!lastLocation) {
                        console.error("🏷️ No last known location available");
                        throw new Error(
                            "Could not determine your location. Please try again in an open area.",
                        );
                    }

                    console.log("🏷️ Using last known location:", lastLocation);
                    currentLocation = lastLocation;
                }

                if (!currentLocation || !currentLocation.coords) {
                    console.error("🏷️ Location is null or missing coordinates");
                    throw new Error(
                        "Could not determine your location coordinates.",
                    );
                }

                // Create the marker with current location
                const fullMarkerData: MarkerCreate = {
                    ...markerData,
                    location: {
                        latitude: currentLocation.coords.latitude,
                        longitude: currentLocation.coords.longitude,
                    },
                };

                console.log(
                    "🏷️ Submitting marker with location:",
                    fullMarkerData.location,
                );

                const newMarker = await createMarker(fullMarkerData);
                console.log("🏷️ Marker creation result:", newMarker);

                if (newMarker) {
                    // Refresh the markers list
                    console.log(
                        "🏷️ Refreshing markers after successful creation",
                    );
                    await fetchMarkers();
                }
                return newMarker;
            } catch (error) {
                console.error(
                    "🏷️ Error creating marker at current location:",
                    error,
                );
                // Rethrow the error so it can be handled by the caller
                throw error;
            }
        },
        [createMarker, fetchMarkers],
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
                    setLastFetchedMarkers(markers);
                    return markers;
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
                setLastFetchedMarkers(markers);
                return markers;
            } catch (error) {
                console.error("Error finding nearby markers:", error);
                setLastFetchedMarkers([]);
                return [];
            }
        },
        [fetchNearbyMarkers, markers],
    );

    return {
        // State
        markers: Array.isArray(markers) ? markers : [],
        userMarkers: Array.isArray(userMarkers) ? userMarkers : [],
        lastFetchedMarkers: Array.isArray(lastFetchedMarkers)
            ? lastFetchedMarkers
            : [],
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
