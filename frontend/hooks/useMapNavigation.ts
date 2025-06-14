import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useLocationStore } from "@/stores/location/location.store";
import { getDirections } from "@/services/places.service";
import accessibleRouteService from "@/services/accessible-route.service";
import navigationHistoryService from "@/services/navigation-history.service";
import {
    createRouteErrorMessage,
    ensureValidRouteData,
    isRouteDistanceReasonable,
} from "@/utils/map.utils";
import { MAP_CONFIG } from "@/config/map.config";

export interface NavigationDestination {
    placeId: string;
    name: string;
    address: string;
    location: { latitude: number; longitude: number };
    types?: string[];
}

export interface RouteInfo {
    distance: number;
    duration: string;
}

export interface RouteCoordinate {
    latitude: number;
    longitude: number;
}

/**
 * Hook for managing map navigation state and route calculations
 * Extracted from map component for better separation of concerns
 */
export function useMapNavigation() {
    // Navigation state
    const [selectedPlace, setSelectedPlace] = useState<
        NavigationDestination | null
    >(null);
    const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>(
        [],
    );
    const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
    const [navigationMode, setNavigationMode] = useState<"walking" | "driving">(
        "walking",
    );
    const [isNavigating, setIsNavigating] = useState(false);
    const [routeSteps, setRouteSteps] = useState<Array<any>>([]);
    const [showDirections, setShowDirections] = useState(false);
    const [useAccessibleRoute, setUseAccessibleRoute] = useState(true);
    const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
    const [currentNavigationId, setCurrentNavigationId] = useState<
        string | null
    >(null);

    /**
     * Get Google Maps API route
     */
    const getGoogleMapsApiRoute = async (
        originLocation: { latitude: number; longitude: number },
        destinationLocation: { latitude: number; longitude: number },
        transportMode: "walking" | "driving",
    ) => {
        const directionsResult = await getDirections(
            originLocation,
            destinationLocation,
            transportMode,
        );
        return directionsResult;
    };

    /**
     * Continue with valid route data
     */
    const continueWithRoute = useCallback((directionsResult: any) => {
        // Check if we received a valid route
        if (
            !directionsResult || !directionsResult.points ||
            directionsResult.points.length < 2
        ) {
            Alert.alert(
                "Navigation Error",
                "Failed to calculate a valid route. Please try again with a different destination.",
                [{ text: "OK" }],
            );
            cancelNavigation();
            return;
        }

        // Set the navigation state with the route data
        setIsNavigating(true);
        setRouteCoordinates(directionsResult.points);
        setRouteInfo({
            distance: directionsResult.distance,
            duration: directionsResult.duration,
        });
        setRouteSteps(directionsResult.steps || []);
        setShowDirections(true);
    }, []);

    /**
     * Handle routing errors
     */
    const handleRoutingError = useCallback((error: unknown) => {
        console.error("Navigation routing error:", error);

        // Reset navigation state
        cancelNavigation();

        // Show error message to user
        const errorMessage = createRouteErrorMessage(error);
        Alert.alert("Navigation Error", errorMessage, [{ text: "OK" }]);
    }, []);

    /**
     * Cancel navigation and cleanup
     */
    const cancelNavigation = useCallback(() => {
        // Mark navigation as completed if we have a navigation ID
        if (currentNavigationId) {
            try {
                navigationHistoryService.completeNavigation(currentNavigationId)
                    .then(() => {
                        console.log("Navigation marked as completed");
                    })
                    .catch((error: Error) => {
                        console.warn(
                            "Failed to mark navigation as completed:",
                            error,
                        );
                    });

                setCurrentNavigationId(null);
            } catch (error) {
                console.warn("Failed to complete navigation cleanup:", error);
            }
        }

        setIsNavigating(false);
        setRouteCoordinates([]);
        setRouteInfo(null);
        setSelectedPlace(null);
        setRouteSteps([]);
        setShowDirections(false);
        setIsCalculatingRoute(false);
    }, [currentNavigationId]);

    /**
     * Handle route confirmation and calculation
     */
    const handleRouteConfirmation = useCallback(async (
        transportMode: "walking" | "driving",
        destination: NavigationDestination,
        useAccessibleRouting: boolean = true,
        navigationId: string | null = null,
    ) => {
        // Get the most current location from store for navigation
        const locationStore = useLocationStore.getState();
        let userLocation = locationStore.getPersistedLocation();

        if (
            !userLocation ||
            (Math.abs(userLocation.latitude) < 0.000001 &&
                Math.abs(userLocation.longitude) < 0.000001)
        ) {
            Alert.alert(
                "Location Required",
                "Your current location is not available. Please enable location services and try again.",
                [{ text: "OK" }],
            );
            return;
        }

        try {
            setIsCalculatingRoute(true);
            setSelectedPlace(destination);
            setNavigationMode(transportMode);
            setUseAccessibleRoute(useAccessibleRouting);

            if (navigationId) {
                setCurrentNavigationId(navigationId);
            }

            const originLocation = {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
            };

            let directionsResult;

            // If walking and accessibility routing is enabled, use custom routing
            if (transportMode === "walking" && useAccessibleRouting) {
                try {
                    const routingParams = {
                        origin: originLocation,
                        destination: destination.location,
                        avoidObstacles: true,
                        userPreferences: {
                            avoidStairs: true,
                            maxSlope: 0.08,
                            minimumWidth: 1.2,
                        },
                        useOsmRouting: true,
                    };

                    directionsResult = await accessibleRouteService
                        .getAccessibleRoute(routingParams);
                    directionsResult = ensureValidRouteData(directionsResult);

                    if (
                        !directionsResult || !directionsResult.points ||
                        directionsResult.points.length < 2
                    ) {
                        throw new Error(
                            "Invalid route data received from routing service",
                        );
                    }

                    if (
                        !isRouteDistanceReasonable(
                            directionsResult.distance,
                            MAP_CONFIG.NAVIGATION.MAX_ROUTE_DISTANCE_KM,
                        )
                    ) {
                        throw new Error(
                            `The calculated route is unusually long (over ${MAP_CONFIG.NAVIGATION.MAX_ROUTE_DISTANCE_KM}km). Please choose a closer destination.`,
                        );
                    }
                } catch (error) {
                    const errorMessage = createRouteErrorMessage(error);

                    Alert.alert(
                        "Accessible Routing Issue",
                        errorMessage,
                        [{
                            text: "Use Standard Navigation",
                            onPress: async () => {
                                try {
                                    setIsCalculatingRoute(true);
                                    directionsResult =
                                        await getGoogleMapsApiRoute(
                                            originLocation,
                                            destination.location,
                                            transportMode,
                                        );
                                    continueWithRoute(directionsResult);
                                } catch (fallbackError) {
                                    handleRoutingError(fallbackError);
                                } finally {
                                    setIsCalculatingRoute(false);
                                }
                            },
                        }, {
                            text: "Cancel",
                            style: "cancel",
                            onPress: () => {
                                cancelNavigation();
                                setIsCalculatingRoute(false);
                            },
                        }],
                    );
                    return;
                }
            } else {
                directionsResult = await getGoogleMapsApiRoute(
                    originLocation,
                    destination.location,
                    transportMode,
                );
            }

            continueWithRoute(directionsResult);
        } catch (error) {
            handleRoutingError(error);
        } finally {
            setIsCalculatingRoute(false);
        }
    }, [
        continueWithRoute,
        handleRoutingError,
        cancelNavigation,
        getGoogleMapsApiRoute,
    ]);

    /**
     * Toggle directions panel visibility
     */
    const toggleDirectionsPanel = useCallback(() => {
        setShowDirections(!showDirections);
    }, [showDirections]);

    /**
     * Toggle accessible routing and recalculate if needed
     */
    const toggleAccessibleRouting = useCallback(() => {
        const newValue = !useAccessibleRoute;
        setUseAccessibleRoute(newValue);

        // If already navigating and in walking mode, recalculate the route
        if (isNavigating && navigationMode === "walking" && selectedPlace) {
            handleRouteConfirmation(navigationMode, selectedPlace, newValue);
        }
    }, [
        useAccessibleRoute,
        isNavigating,
        navigationMode,
        selectedPlace,
        handleRouteConfirmation,
    ]);

    return {
        // State
        selectedPlace,
        routeCoordinates,
        routeInfo,
        navigationMode,
        isNavigating,
        routeSteps,
        showDirections,
        useAccessibleRoute,
        isCalculatingRoute,
        currentNavigationId,

        // Setters for external control
        setSelectedPlace,

        // Actions
        handleRouteConfirmation,
        cancelNavigation,
        toggleDirectionsPanel,
        toggleAccessibleRouting,
    };
}
