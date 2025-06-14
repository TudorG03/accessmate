import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Dimensions, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker as MapMarker, PROVIDER_GOOGLE, Region, Callout, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import AddMarkerModal from "@/components/markers/AddMarkerModal";
import MarkerDetailsModal from "@/components/markers/MarkerDetailsModal";
import RouteConfirmationModal from "@/components/map/RouteConfirmationModal";
import PlaceDetailsModal from "@/components/map/PlaceDetailsModal";
import PlaceSearchBar from "@/components/map/PlaceSearchBar";
import { useMarker } from "@/stores/marker/hooks/useMarker";
import { Marker } from "@/types/marker.types";
import { getObstacleColor, getObstacleEmoji, getObstacleIcon } from "@/stores/marker/marker.utils";
import { useTheme } from "@/stores/theme/useTheme";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getDirections } from "@/services/places.service";
import DirectionsPanel from '@/components/map/DirectionsPanel';
import useAuth from "../../stores/auth/hooks/useAuth";
import { formatDistance } from "@/utils/distanceUtils";
import { ensureValidRouteData } from "@/utils/map.utils";
import accessibleRouteService from "@/services/accessible-route.service";
import navigationHistoryService from "@/services/navigation-history.service";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocationStore } from "@/stores/location/location.store";
import { useLocation } from "@/stores/location/hooks/useLocation";
import { useMapPermissions } from "@/hooks/useMapPermissions";
import OptimizedMarker from "@/components/map/OptimizedMarker";


type LocationObjectType = Location.LocationObject;

export default function MapScreen() {
  // Use the location hook for proper location management
  const { currentLocation, ensureValidLocation, isTrackingEnabled, toggleTracking } = useLocation();

  // Use the map permissions hook for permission management
  const {
    locationPermissionStatus,
    hasLocationPermission,
    canShowUserLocation,
    requestLocationPermissionsAndRefresh
  } = useMapPermissions();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [isFetchingMarkers, setIsFetchingMarkers] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // New state for place search and navigation
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [routeConfirmationModalVisible, setRouteConfirmationModalVisible] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number, longitude: number }>>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number, duration: string } | null>(null);
  const [navigationMode, setNavigationMode] = useState<'walking' | 'driving'>('walking');
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeSteps, setRouteSteps] = useState<Array<any>>([]);
  const [showDirections, setShowDirections] = useState(false);
  const [useAccessibleRoute, setUseAccessibleRoute] = useState(true);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [currentNavigationId, setCurrentNavigationId] = useState<string | null>(null);

  // New state for place details modal
  const [placeDetailsModalVisible, setPlaceDetailsModalVisible] = useState(false);
  const [selectedPoiPlaceId, setSelectedPoiPlaceId] = useState<string | null>(null);

  const mapRef = useRef<MapView | null>(null);
  const { isDark, colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Use our marker hook to access marker data
  const { markers, findNearbyMarkers } = useMarker();

  // Memoize the markers slice to prevent unnecessary re-renders
  const visibleMarkers = useMemo(() => markers.slice(0, 30), [markers]);

  // Add this line with the other state hooks
  const { user } = useAuth();

  // Memoize anchor object to prevent re-creation
  const markerAnchor = useMemo(() => ({ x: 0.5, y: 1.0 }), []);
  const routePointAnchor = useMemo(() => ({ x: 0.5, y: 0.5 }), []);

  // Memoize Polyline dash pattern
  const routeDashPattern = useMemo(() => [5, 5], []);

  // Memoize MapView event handlers to prevent re-renders
  const handleMapReady = useCallback(() => {
    // Map is ready
  }, []);

  const closeDirectionsPanel = useCallback(() => {
    setShowDirections(false);
  }, []);

  const closeRouteConfirmationModal = useCallback(() => {
    setRouteConfirmationModalVisible(false);
  }, []);

  const closeDetailsModal = useCallback(() => {
    setDetailsModalVisible(false);
  }, []);

  // Memoize default region to prevent re-creation on every render
  const defaultRegion = useMemo((): Region => {
    // Get the most current location from store
    const locationStore = useLocationStore.getState();
    const persistedLocation = locationStore.getPersistedLocation();

    if (persistedLocation &&
      (Math.abs(persistedLocation.latitude) > 0.000001 ||
        Math.abs(persistedLocation.longitude) > 0.000001)) {
      return {
        latitude: persistedLocation.latitude,
        longitude: persistedLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    // Fallback to default location if no valid persisted location
    return {
      latitude: 44.461555, // Default to Bucharest
      longitude: 26.073303,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, []);

  // Use a ref to store the initial region - prevents MapView re-renders
  const initialRegionRef = useRef<Region | null>(null);

  // Set initial region only when we first get a valid location
  if (!initialRegionRef.current) {
    if (currentRegion) {
      initialRegionRef.current = currentRegion;
    } else {
      initialRegionRef.current = defaultRegion;
    }
  }

  // Permission checking is now handled by useMapPermissions hook

  // Handle navigation parameters to open place details modal
  useEffect(() => {
    if (params.openPlaceDetails === "true" && params.placeId) {
      setSelectedPoiPlaceId(params.placeId as string);
      setPlaceDetailsModalVisible(true);

      // Clear the parameters to prevent the modal from reopening
      router.setParams({ openPlaceDetails: undefined, placeId: undefined });
    }
  }, [params.openPlaceDetails, params.placeId]);

  // Handle navigation parameters to start navigation directly
  useEffect(() => {
    if (params.startNavigation === "true" && params.placeId) {
      // Store the place ID and open the route confirmation modal
      setSelectedPlace({ id: params.placeId as string });
      setRouteConfirmationModalVisible(true);

      // Clear the parameters to prevent the modal from reopening
      router.setParams({ startNavigation: undefined, placeId: undefined });
    }
  }, [params.startNavigation, params.placeId]);

  // Handle closing the place details modal
  const handlePlaceDetailsModalClose = useCallback(() => {
    setPlaceDetailsModalVisible(false);
    setSelectedPoiPlaceId(null);
  }, []);

  // Permission request logic is now handled by useMapPermissions hook

  // Function to handle marker selection
  const handleMarkerPress = useCallback((marker: Marker) => {
    setSelectedMarker(marker);
    setDetailsModalVisible(true);
  }, []);

  // Handle place selection from search
  const handlePlaceSelected = useCallback((place: { id: string, name: string, address: string }) => {
    // Only store the ID when opening the modal - full details will be fetched by the modal
    setSelectedPlace({ id: place.id });
    setRouteConfirmationModalVisible(true);
  }, []);

  // Handle request to show place info from search results
  const handlePlaceInfoRequested = useCallback((placeId: string) => {
    setSelectedPoiPlaceId(placeId);
    setPlaceDetailsModalVisible(true);
  }, []);

  // Handle POI click on the map
  const handlePoiClick = useCallback((event: any) => {
    // Extract the placeId from the nativeEvent
    const { placeId, name, coordinate } = event.nativeEvent;

    if (placeId) {
      setSelectedPoiPlaceId(placeId);
      setPlaceDetailsModalVisible(true);
    }
  }, []);

  // Handle starting navigation from a POI
  const handleStartNavigation = useCallback((placeId: string) => {
    // Store the place ID and open the route confirmation modal
    setSelectedPlace({ id: placeId });
    setRouteConfirmationModalVisible(true);
  }, []);

  // Handle location selection from search
  const handleLocationSelected = useCallback((location: { latitude: number, longitude: number }) => {
    // Animate map to the selected location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  }, []);

  // Route validation is handled by imported ensureValidRouteData from utils

  const getGoogleMapsApiRoute = async (
    originLocation: {
      latitude: number,
      longitude: number
    },
    destinationLocation: {
      latitude: number,
      longitude: number
    },
    transportMode: 'walking' | 'driving',
  ): Promise<{
    points: Array<{ latitude: number; longitude: number }>;
    distance: number;
    duration: string;
    steps: Array<{
      instructions: string;
      distance: string;
      duration: string;
      startLocation: { latitude: number; longitude: number };
      endLocation: { latitude: number; longitude: number };
    }>;
  }
  > => {
    const directionsResult = await getDirections(originLocation, destinationLocation, transportMode);
    return directionsResult;
  }

  // Handle route confirmation
  const handleRouteConfirmation = async (
    transportMode: 'walking' | 'driving',
    destination: {
      placeId: string,
      name: string,
      address: string,
      location: { latitude: number, longitude: number },
      types?: string[]
    },
    useAccessibleRouting: boolean = true,
    navigationId: string | null = null
  ) => {
    // Get the most current location from store for navigation
    const locationStore = useLocationStore.getState();
    let userLocation = locationStore.getPersistedLocation();

    if (!userLocation ||
      (Math.abs(userLocation.latitude) < 0.000001 && Math.abs(userLocation.longitude) < 0.000001)) {
      Alert.alert(
        "Location Required",
        "Your current location is not available. Please enable location services and try again.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      // Set route calculation to true to show loading spinner
      setIsCalculatingRoute(true);

      // Update selectedPlace with the complete destination data including location
      setSelectedPlace(destination);
      setNavigationMode(transportMode);
      setRouteConfirmationModalVisible(false);
      // Update accessible route preference
      setUseAccessibleRoute(useAccessibleRouting);

      // Store the navigation ID for tracking
      if (navigationId) {
        setCurrentNavigationId(navigationId);
      }

      // Get directions from current location to destination
      const originLocation = {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude
      };

      let directionsResult;

      // If walking and accessibility routing is enabled, use our custom routing
      if (transportMode === 'walking' && useAccessibleRouting) {
        // Get relevant obstacles from the store - only consider obstacles with moderate or higher severity
        const relevantObstacles = markers.filter(marker => marker.obstacleScore >= 2);

        // Use the accessible routing service
        const routingParams = {
          origin: originLocation,
          destination: destination.location,
          avoidObstacles: true,
          userPreferences: {
            avoidStairs: true,
            maxSlope: 0.08, // 8% maximum grade
            minimumWidth: 1.2 // 1.2 meters minimum width
          },
          useOsmRouting: true // Always use OSM-based routing
        };

        // Call the backend API for accessible routing
        try {
          directionsResult = await accessibleRouteService.getAccessibleRoute(routingParams);

          // Ensure we have valid route data
          directionsResult = ensureValidRouteData(directionsResult);

          // Verify that directionsResult has all required properties
          if (!directionsResult || !directionsResult.points || directionsResult.points.length < 2) {
            throw new Error("Invalid route data received from routing service");
          }



          // Validate route distance - check for unreasonably long routes
          if (directionsResult.distance > 50) {
            throw new Error("The calculated route is unusually long (over 50km). Please choose a closer destination.");
          }
        } catch (error) {

          // Show a specific error message to the user
          const errorMessage = error instanceof Error
            ? error.message
            : "The accessible routing service is currently unavailable.";

          // Show error message based on specific error cases
          Alert.alert(
            "Accessible Routing Issue",
            errorMessage,
            [{
              text: "Use Standard Navigation",
              onPress: async () => {
                try {
                  // Try standard Google routing as fallback
                  setIsCalculatingRoute(true);
                  directionsResult = await getGoogleMapsApiRoute(originLocation, destination.location, transportMode);
                  continueWithRoute(directionsResult);
                } catch (fallbackError) {
                  handleRoutingError(fallbackError);
                } finally {
                  setIsCalculatingRoute(false);
                }
              }
            },
            {
              text: "Cancel", style: "cancel", onPress: () => {
                // Reset navigation state
                cancelNavigation();
                setIsCalculatingRoute(false);
              }
            }]
          );

          // Return early to prevent further processing
          return;
        }
      } else {
        // Otherwise use standard Google directions
        directionsResult = await getGoogleMapsApiRoute(originLocation, destination.location, transportMode);
      }

      // Continue with the successfully calculated route
      continueWithRoute(directionsResult);

    } catch (error) {
      handleRoutingError(error);
    } finally {
      // Set route calculation to false when finished (success or error)
      setIsCalculatingRoute(false);
    }
  };

  // Helper function to continue with valid route data
  const continueWithRoute = (directionsResult: any) => {
    // Check if we received a valid route
    if (!directionsResult || !directionsResult.points || directionsResult.points.length < 2) {
      Alert.alert(
        "Navigation Error",
        "Failed to calculate a valid route. Please try again with a different destination.",
        [{ text: "OK" }]
      );

      cancelNavigation();
      return;
    }

    // Set the navigation state with the route data
    setIsNavigating(true);
    setRouteCoordinates(directionsResult.points);
    setRouteInfo({
      distance: directionsResult.distance,
      duration: directionsResult.duration
    });
    setRouteSteps(directionsResult.steps || []);
    setShowDirections(true);

    // Fit map to show the entire route
    if (mapRef.current && directionsResult.points && directionsResult.points.length > 0) {
      mapRef.current.fitToCoordinates(directionsResult.points, {
        edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
        animated: true
      });
    }
  };

  // Helper function to handle routing errors
  const handleRoutingError = (error: unknown) => {

    // Reset navigation state
    cancelNavigation();

    // Show error message to user
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to calculate a route. Please try again.";

    Alert.alert(
      "Navigation Error",
      errorMessage,
      [{ text: "OK" }]
    );
  };

  // Cancel navigation
  const cancelNavigation = () => {
    // Mark navigation as completed if we have a navigation ID
    if (currentNavigationId) {
      try {
        navigationHistoryService.completeNavigation(currentNavigationId)
          .then(() => {

          })
          .catch((error: Error) => {
            // Silent error handling
          });

        setCurrentNavigationId(null);
      } catch (error) {
        // Silent error handling
      }
    }

    setIsNavigating(false);
    setRouteCoordinates([]);
    setRouteInfo(null);
    setSelectedPlace(null);
    setRouteSteps([]);
    setShowDirections(false);
  };

  // Toggle directions panel
  const toggleDirectionsPanel = () => {
    setShowDirections(!showDirections);
  };

  // Toggle accessible routing
  const toggleAccessibleRouting = () => {
    const newValue = !useAccessibleRoute;
    setUseAccessibleRoute(newValue);

    // If already navigating and in walking mode, recalculate the route
    if (isNavigating && navigationMode === 'walking' && selectedPlace) {
      handleRouteConfirmation(navigationMode, selectedPlace, newValue);
    }
  };



  // Function to fetch nearby markers
  const fetchNearbyMarkers = useCallback(async (
    latitude: number,
    longitude: number,
    radius: number = 2000  // Reduced from 3000 to 2000 meters
  ) => {
    if (isFetchingMarkers) return;

    try {
      setIsFetchingMarkers(true);
      await findNearbyMarkers(radius, { latitude, longitude });
    } catch (error) {
      // Silent error handling
    } finally {
      setIsFetchingMarkers(false);
    }
  }, [findNearbyMarkers, isFetchingMarkers]);

  useEffect(() => {
    const initializeLocationAndMap = async () => {
      try {
        setIsLoading(true);

        // Get the location store to check for persisted location
        const locationStore = useLocationStore.getState();
        let effectiveLocation = locationStore.getPersistedLocation();

        if (effectiveLocation &&
          (Math.abs(effectiveLocation.latitude) > 0.000001 || Math.abs(effectiveLocation.longitude) > 0.000001)) {
          // Using persisted location from store
        } else {
          // If no valid persisted location, try to get from location hook
          if (currentLocation &&
            (Math.abs(currentLocation.latitude) > 0.000001 || Math.abs(currentLocation.longitude) > 0.000001)) {
            effectiveLocation = currentLocation;
          } else {
            // Final fallback to default location
            effectiveLocation = locationStore.getLastKnownLocation();
          }
        }

        if (effectiveLocation) {

          // Set initial region based on effective location
          const initialRegion = {
            latitude: effectiveLocation.latitude,
            longitude: effectiveLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setCurrentRegion(initialRegion);

          // Find markers near the location
          await findNearbyMarkers(3000, {
            latitude: effectiveLocation.latitude,
            longitude: effectiveLocation.longitude
          });
        } else {
          setErrorMsg('Could not get your location. Please enable location services and try again.');
        }
      } catch (error) {
        setErrorMsg('Could not get your location. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeLocationAndMap();
  }, []); // Only run once on mount

  // Ref to store the timeout ID for debouncing
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced marker fetching to prevent excessive API calls
  const debouncedFetchMarkers = useCallback((latitude: number, longitude: number, radius: number) => {
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      findNearbyMarkers(radius, { latitude, longitude });
    }, 300); // 300ms debounce
  }, [findNearbyMarkers]);

  // Handle map region changes to fetch new markers
  const handleRegionChangeComplete = useCallback((region: Region) => {
    // Use requestAnimationFrame to prevent blocking the UI
    requestAnimationFrame(() => {
      setCurrentRegion(region);

      // Calculate approximate radius based on the visible region
      // LatitudeDelta of 0.01 is roughly 1.1km, so we use this to estimate the radius
      const latKm = 111; // 1 degree of latitude is approximately 111km
      const visibleRadiusInMeters = (region.latitudeDelta * latKm * 1000) / 2;

      // Fetch markers for the new region, with a minimum radius of 300m and maximum of 1500m
      const searchRadius = Math.max(300, Math.min(1500, Math.round(visibleRadiusInMeters)));

      // Use debounced fetching
      debouncedFetchMarkers(region.latitude, region.longitude, searchRadius);
    });
  }, [debouncedFetchMarkers]);

  const zoomToCurrentLocation = useCallback(async () => {
    try {
      // Get the most current location from store
      const locationStore = useLocationStore.getState();
      let effectiveLocation = locationStore.getPersistedLocation();

      if (!effectiveLocation ||
        (Math.abs(effectiveLocation.latitude) < 0.000001 && Math.abs(effectiveLocation.longitude) < 0.000001)) {
        // If no valid persisted location, try to ensure we have valid location
        effectiveLocation = await ensureValidLocation();

        if (!effectiveLocation) {
          // Final fallback to default location
          effectiveLocation = locationStore.getLastKnownLocation();
        }
      }

      if (effectiveLocation && mapRef.current) {
        const region: Region = {
          latitude: effectiveLocation.latitude,
          longitude: effectiveLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        mapRef.current.animateToRegion(region, 1000);
      }
    } catch (error) {
      // Silent error handling
    }
  }, [ensureValidLocation]);

  // Monitor significant location changes and update map region accordingly
  useEffect(() => {
    if (currentLocation && currentRegion) {
      const distanceThreshold = 0.005; // About 500 meters - larger threshold to reduce updates

      if (Math.abs(currentLocation.latitude - currentRegion.latitude) > distanceThreshold ||
        Math.abs(currentLocation.longitude - currentRegion.longitude) > distanceThreshold) {

        // Use requestAnimationFrame to prevent blocking
        requestAnimationFrame(() => {
          const newRegion = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: currentRegion?.latitudeDelta || 0.01,
            longitudeDelta: currentRegion?.longitudeDelta || 0.01,
          };
          setCurrentRegion(newRegion);

          // Animate map to the new location
          if (mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 1000);
          }
        });
      }
    }
  }, [currentLocation]);

  // Format marker callout titles (memoized)
  const getMarkerTitle = useCallback((marker: Marker): string => {
    const emoji = getObstacleEmoji(marker.obstacleType);
    const type = marker.obstacleType.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    return `${emoji} ${type}`;
  }, []);

  // Format marker descriptions for callouts (memoized)
  const getMarkerDescription = useCallback((marker: Marker): string => {
    const severity = marker.obstacleScore >= 4 ? 'High' :
      marker.obstacleScore >= 2 ? 'Medium' : 'Low';
    return `${severity} severity: ${marker.description || 'No description'} - ${formatDistance(0.2, user?.preferences?.preferedUnit)} away`;
  }, [user?.preferences?.preferedUnit]);

  // Handle refresh of markers when modal closes
  const handleModalClose = useCallback(() => {
    setModalVisible(false);

    // Refresh markers when modal closes using the current region
    if (currentRegion) {
      const radius = Math.max(300, Math.round((currentRegion.latitudeDelta * 111 * 1000) / 2));
      findNearbyMarkers(radius, {
        latitude: currentRegion.latitude,
        longitude: currentRegion.longitude
      });
    } else {
      // Fallback to user location if no current region
      const locationStore = useLocationStore.getState();
      const persistedLocation = locationStore.getPersistedLocation();

      if (persistedLocation) {
        findNearbyMarkers(2000, {
          latitude: persistedLocation.latitude,
          longitude: persistedLocation.longitude
        });
      }
    }
  }, [currentRegion, findNearbyMarkers]);

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {isLoading ? (
        <View className="flex-1 justify-center items-center p-4">
          <ActivityIndicator size="large" className="mb-2" color="#F1B24A" />
          <Text className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Getting your location...</Text>
        </View>
      ) : errorMsg ? (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-red-500 text-center mb-4">{errorMsg}</Text>
          <Text className={`text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Please enable location services and try again.
          </Text>
        </View>
      ) : (
        <View className="flex-1">
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            showsUserLocation={canShowUserLocation}
            showsMyLocationButton={false}
            showsCompass={true}
            showsScale={true}
            followsUserLocation={canShowUserLocation}
            userLocationAnnotationTitle="You are here"
            userLocationPriority="high"
            initialRegion={initialRegionRef.current}
            onRegionChangeComplete={handleRegionChangeComplete}
            onPoiClick={handlePoiClick}
            onMapReady={handleMapReady}
          >
            {/* Display all obstacle markers from the store with custom icons */}
            {visibleMarkers.map((marker, index) => (
              <OptimizedMarker
                key={marker.id || `marker-${index}`}
                marker={marker}
                index={index}
                onPress={handleMarkerPress}
                getMarkerTitle={getMarkerTitle}
                getMarkerDescription={getMarkerDescription}
                markerAnchor={markerAnchor}
                styles={styles}
              />
            ))}

            {/* Display the route polyline if navigating */}
            {isNavigating && routeCoordinates.length > 0 && (
              <>
                {/* Main route path - precise, dotted line with app's orange color */}
                <Polyline
                  coordinates={routeCoordinates}
                  strokeWidth={5}
                  strokeColor="#F1B24A"
                  lineCap="round"
                  lineJoin="round"
                  lineDashPattern={routeDashPattern}
                />

                {/* Outer glow effect for better visibility */}
                <Polyline
                  coordinates={routeCoordinates}
                  strokeWidth={8}
                  strokeColor="rgba(241, 178, 74, 0.3)"
                  lineCap="round"
                  lineJoin="round"
                />

                {/* Route points at key locations */}
                {routeCoordinates
                  .filter((_, index) => {
                    // Show a subset of route points for visual cues
                    // Only at turning points or spaced regularly
                    if (index === 0 || index === routeCoordinates.length - 1) return false; // Skip first and last
                    if (routeCoordinates.length < 20) return index % 3 === 0; // For shorter routes
                    return index % Math.floor(routeCoordinates.length / 10) === 0; // ~10 points for longer routes
                  })
                  .map((coord, index) => (
                    <MapMarker
                      key={`routepoint-${index}`}
                      coordinate={coord}
                      anchor={routePointAnchor}
                      tracksViewChanges={false}
                    >
                      <View style={styles.routePoint} />
                    </MapMarker>
                  ))
                }
              </>
            )}

            {/* Display destination marker if navigating */}
            {isNavigating && selectedPlace && selectedPlace.location && (
              <MapMarker
                coordinate={{
                  latitude: selectedPlace.location.latitude,
                  longitude: selectedPlace.location.longitude,
                }}
                pinColor="#F1B24A"
              >
                <Callout>
                  <View className={`p-2.5 w-[200px] ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                    <Text className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>{selectedPlace.name}</Text>
                    <Text className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{selectedPlace.address}</Text>
                  </View>
                </Callout>
              </MapMarker>
            )}
          </MapView>

          {/* Search bar */}
          {!isNavigating && (
            <PlaceSearchBar
              onPlaceSelected={handlePlaceSelected}
              onLocationSelected={handleLocationSelected}
              onPlaceInfoRequested={handlePlaceInfoRequested}
            />
          )}

          {/* Route calculation loading indicator */}
          {isCalculatingRoute && (
            <View className="absolute top-0 bottom-0 left-0 right-0 justify-center items-center bg-black bg-opacity-30">
              <View className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
                <ActivityIndicator size="large" color="#F1B24A" />
                <Text className={`mt-2 font-medium text-center ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  Calculating accessible route...
                </Text>
              </View>
            </View>
          )}

          {/* Loading indicator when fetching markers */}
          {isFetchingMarkers && (
            <View className={`absolute top-5 self-center p-2 rounded-full shadow ${isDark ? 'bg-gray-800 bg-opacity-80' : 'bg-white bg-opacity-80'}`}>
              <ActivityIndicator size="small" color="#F1B24A" />
            </View>
          )}

          {/* Add marker button */}
          <TouchableOpacity
            className="absolute bottom-8 left-5 bg-[#F1B24A] rounded-full w-[60px] h-[60px] justify-center items-center shadow-md"
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add-circle" size={24} color="white" />
          </TouchableOpacity>

          {/* Current location button */}
          <TouchableOpacity
            className={`absolute bottom-8 right-5 rounded-full w-[60px] h-[60px] justify-center items-center shadow-md ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            onPress={async () => {
              if (!hasLocationPermission) {
                const granted = await requestLocationPermissionsAndRefresh();
                if (!granted) {
                  Alert.alert(
                    'Location Permission Required',
                    'Please grant location permission to see your current location on the map.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
              } else if (!isTrackingEnabled) {
                await toggleTracking();
                return;
              }
              zoomToCurrentLocation();
            }}
          >
            <Ionicons
              name={canShowUserLocation ? "locate" : "locate-outline"}
              size={24}
              color={canShowUserLocation ? (isDark ? "#ffffff" : "#333333") : "#999999"}
            />
          </TouchableOpacity>

          {/* Navigation info, directions toggle and cancel button */}
          {isNavigating && routeInfo && (
            <View className={`absolute top-3 left-2.5 right-2.5 rounded-xl p-4 flex-row items-center justify-between shadow-md ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <View className="flex-row items-center">
                <View className={`flex-row items-center mr-4 rounded-lg px-2.5 py-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <Ionicons name={navigationMode === 'walking' ? 'walk' : 'car'} size={20} color="#F1B24A" />
                  <Text className={`ml-1.5 font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    {formatDistance(routeInfo.distance, user?.preferences?.preferedUnit)}
                  </Text>
                </View>
                <View className={`flex-row items-center rounded-lg px-2.5 py-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <Ionicons name="time" size={20} color="#F1B24A" />
                  <Text className={`ml-1.5 font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{routeInfo.duration}</Text>
                </View>
              </View>
              <View className="flex-row">
                {/* Show accessible routing toggle only when walking */}
                {navigationMode === 'walking' && (
                  <TouchableOpacity
                    className={`rounded-lg p-2.5 mx-2 ${useAccessibleRoute ? 'bg-green-600' : isDark ? 'bg-gray-600' : 'bg-gray-300'}`}
                    onPress={toggleAccessibleRouting}
                  >
                    <Ionicons name="accessibility" size={20} color="#ffffff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  className={`bg-gray-600 rounded-lg p-2.5 mr-2`}
                  onPress={toggleDirectionsPanel}
                >
                  <Ionicons name="list" size={20} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-[#F1B24A] rounded-lg p-2.5"
                  onPress={cancelNavigation}
                >
                  <Text className="text-sm font-bold text-white">End</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Directions Panel */}
          {(() => {
            const locationStore = useLocationStore.getState();
            const persistedLocation = locationStore.getPersistedLocation();
            return persistedLocation && (
              <DirectionsPanel
                steps={routeSteps || []}
                visible={showDirections && isNavigating}
                onClose={closeDirectionsPanel}
                currentLocation={{
                  latitude: persistedLocation.latitude,
                  longitude: persistedLocation.longitude
                }}
              />
            );
          })()}

          {/* Add marker modal */}
          <AddMarkerModal
            visible={modalVisible}
            onClose={handleModalClose}
          />

          {/* Marker details modal */}
          <MarkerDetailsModal
            visible={detailsModalVisible}
            onClose={closeDetailsModal}
            marker={selectedMarker}
          />

          {/* Route confirmation modal */}
          <RouteConfirmationModal
            visible={routeConfirmationModalVisible}
            onClose={closeRouteConfirmationModal}
            onConfirm={handleRouteConfirmation}
            placeId={selectedPlace?.id || null}
            originLocation={(() => {
              const locationStore = useLocationStore.getState();
              const persistedLocation = locationStore.getPersistedLocation();
              return persistedLocation ? {
                latitude: persistedLocation.latitude,
                longitude: persistedLocation.longitude
              } : null;
            })()}
          />

          {/* Place Details Modal */}
          <PlaceDetailsModal
            visible={placeDetailsModalVisible}
            onClose={handlePlaceDetailsModalClose}
            onStartNavigation={handleStartNavigation}
            placeId={selectedPoiPlaceId}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// Styles for the map and markers (memoized to prevent re-creation)
const styles = StyleSheet.create({
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  infoPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
    zIndex: 1000,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIcon: {
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: 'white',
  },
  routePoint: {
    width: 8,
    height: 8,
    backgroundColor: '#F1B24A',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'white',
  },
});