import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Dimensions, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker as MapMarker, PROVIDER_GOOGLE, Region, Callout, Polyline, PointOfInterest } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import AddMarkerModal from "@/components/markers/AddMarkerModal";
import MarkerDetailsModal from "@/components/markers/MarkerDetailsModal";
import RouteConfirmationModal from "@/components/map/RouteConfirmationModal";
import PlaceDetailsModal from "@/components/map/PlaceDetailsModal";
import PlaceSearchBar from "@/components/map/PlaceSearchBar";
import { useMarker } from "@/stores/marker/hooks/useMarker";
import { Marker } from "@/types/marker.types";
import { getObstacleColor, getObstacleEmoji } from "@/stores/marker/marker.utils";
import { useTheme } from "@/stores/theme/useTheme";
import { useRouter } from "expo-router";
import { getDirections } from "@/services/places.service";
import DirectionsPanel from '@/components/map/DirectionsPanel';
import { getAccessibleRoute } from '@/services/navigation.service';
import useAuth from "../../stores/auth/hooks/useAuth";
import { formatDistance } from "@/utils/distanceUtils";

type LocationObjectType = Location.LocationObject;

export default function MapScreen() {
  const [location, setLocation] = useState<LocationObjectType | null>(null);
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

  // New state for place details modal
  const [placeDetailsModalVisible, setPlaceDetailsModalVisible] = useState(false);
  const [selectedPoiPlaceId, setSelectedPoiPlaceId] = useState<string | null>(null);

  const mapRef = useRef<MapView | null>(null);
  const { isDark, colors } = useTheme();
  const router = useRouter();

  // Use our marker hook to access marker data
  const { markers, findNearbyMarkers } = useMarker();

  // Add this line with the other state hooks
  const { user } = useAuth();

  // Function to handle marker selection
  const handleMarkerPress = (marker: Marker) => {
    setSelectedMarker(marker);
    setDetailsModalVisible(true);
  };

  // Handle place selection from search
  const handlePlaceSelected = (place: { id: string, name: string, address: string }) => {
    // Only store the ID when opening the modal - full details will be fetched by the modal
    setSelectedPlace({ id: place.id });
    setRouteConfirmationModalVisible(true);
  };

  // Handle request to show place info from search results
  const handlePlaceInfoRequested = (placeId: string) => {
    console.log("Showing info for place:", placeId);
    setSelectedPoiPlaceId(placeId);
    setPlaceDetailsModalVisible(true);
  };

  // Handle POI click on the map
  const handlePoiClick = (event: any) => {
    console.log("POI clicked:", JSON.stringify(event.nativeEvent));

    // Extract the placeId from the nativeEvent
    const { placeId, name, coordinate } = event.nativeEvent;

    if (placeId) {
      console.log(`POI selected: ${name} (${placeId}) at coordinates: ${JSON.stringify(coordinate)}`);
      setSelectedPoiPlaceId(placeId);
      setPlaceDetailsModalVisible(true);
    } else {
      console.error("No placeId found in POI click event:", event);
    }
  };

  // Handle starting navigation from a POI
  const handleStartNavigation = (placeId: string) => {
    // Store the place ID and open the route confirmation modal
    setSelectedPlace({ id: placeId });
    setRouteConfirmationModalVisible(true);
  };

  // Handle location selection from search
  const handleLocationSelected = (location: { latitude: number, longitude: number }) => {
    // Animate map to the selected location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  // Handle route confirmation
  const handleRouteConfirmation = async (
    transportMode: 'walking' | 'driving',
    destination: {
      placeId: string,
      name: string,
      address: string,
      location: { latitude: number, longitude: number }
    },
    useAccessibleRouting: boolean = true
  ) => {
    if (!location) {
      return;
    }

    try {
      // Update selectedPlace with the complete destination data including location
      setSelectedPlace(destination);
      setNavigationMode(transportMode);
      setIsNavigating(true);
      setRouteConfirmationModalVisible(false);
      // Update accessible route preference
      setUseAccessibleRoute(useAccessibleRouting);

      // Get directions from current location to destination
      const originLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };

      let directionsResult;

      // If walking and accessibility routing is enabled, use our custom routing
      if (transportMode === 'walking' && useAccessibleRouting) {
        // Get relevant obstacles from the store - only consider obstacles with moderate or higher severity
        const relevantObstacles = markers.filter(marker => marker.obstacleScore >= 2);

        directionsResult = await getAccessibleRoute(
          originLocation,
          destination.location,
          relevantObstacles,
          transportMode
        );
      } else {
        // Otherwise use standard Google directions
        directionsResult = await getDirections(originLocation, destination.location, transportMode);
      }

      setRouteCoordinates(directionsResult.points);
      setRouteInfo({
        distance: directionsResult.distance,
        duration: directionsResult.duration
      });
      setRouteSteps(directionsResult.steps);
      setShowDirections(true);

      // Fit map to show the entire route
      if (mapRef.current && directionsResult.points.length > 0) {
        mapRef.current.fitToCoordinates(directionsResult.points, {
          edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
          animated: true
        });
      }
    } catch (error) {
      console.error('Error getting directions:', error);
      // Show an error toast or alert here
    }
  };

  // Cancel navigation
  const cancelNavigation = () => {
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

  // Handler for map ready event
  const handleMapReady = () => {
    console.log("Map is ready, POI clicks should now work");
  };

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        console.log("Requesting location permission...");

        // Ask for permission to access location
        let { status } = await Location.requestForegroundPermissionsAsync();
        console.log("Location permission status:", status);

        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          setIsLoading(false);
          return;
        }

        // Get the user's current position
        console.log("Getting current position...");
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        console.log("Current location:", currentLocation);

        setLocation(currentLocation);

        // Set initial region based on user's location
        const initialRegion = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setCurrentRegion(initialRegion);

        setIsLoading(false);

        // Find markers near the user
        if (currentLocation) {
          await fetchNearbyMarkers(
            currentLocation.coords.latitude,
            currentLocation.coords.longitude,
            3000
          );
        }
      } catch (error) {
        console.log('Error getting location:', error);
        setErrorMsg('Could not get your location. Please try again.');
        setIsLoading(false);
      }
    })();
  }, []);

  // Function to fetch nearby markers
  const fetchNearbyMarkers = useCallback(async (
    latitude: number,
    longitude: number,
    radius: number = 3000
  ) => {
    if (isFetchingMarkers) return;

    try {
      setIsFetchingMarkers(true);
      console.log(`Fetching markers near [${latitude}, ${longitude}] with radius ${radius}m`);
      await findNearbyMarkers(radius, { latitude, longitude });
    } catch (error) {
      console.error('Error fetching nearby markers:', error);
    } finally {
      setIsFetchingMarkers(false);
    }
  }, [findNearbyMarkers, isFetchingMarkers]);

  // Handle map region changes to fetch new markers
  const handleRegionChangeComplete = useCallback((region: Region) => {
    setCurrentRegion(region);

    // Calculate approximate radius based on the visible region
    // LatitudeDelta of 0.01 is roughly 1.1km, so we use this to estimate the radius
    const latKm = 111; // 1 degree of latitude is approximately 111km
    const visibleRadiusInMeters = (region.latitudeDelta * latKm * 1000) / 2;

    // Fetch markers for the new region, with a minimum radius of 300m
    const searchRadius = Math.max(300, Math.round(visibleRadiusInMeters));
    fetchNearbyMarkers(region.latitude, region.longitude, searchRadius);
  }, [fetchNearbyMarkers]);

  const zoomToCurrentLocation = useCallback(() => {
    if (location && mapRef.current) {
      console.log("Zooming to current location:", location.coords);
      const region: Region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current.animateToRegion(region, 1000);
    }
  }, [location]);

  useEffect(() => {
    if (location) {
      zoomToCurrentLocation();
    }
  }, [location, zoomToCurrentLocation]);

  // Default region used if location is not available
  const defaultRegion: Region = {
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // Format marker callout titles
  const getMarkerTitle = (marker: Marker): string => {
    const emoji = getObstacleEmoji(marker.obstacleType);
    const type = marker.obstacleType.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    return `${emoji} ${type}`;
  };

  // Format marker descriptions for callouts
  const getMarkerDescription = (marker: Marker): string => {
    const severity = marker.obstacleScore >= 4 ? 'High' :
      marker.obstacleScore >= 2 ? 'Medium' : 'Low';
    return `${severity} severity: ${marker.description || 'No description'} - ${formatDistance(0.2, user?.preferences?.preferedUnit)} away`;
  };

  // Handle refresh of markers when modal closes
  const handleModalClose = useCallback(() => {
    setModalVisible(false);

    // Refresh markers when modal closes using the current region
    if (currentRegion) {
      fetchNearbyMarkers(
        currentRegion.latitude,
        currentRegion.longitude,
        Math.max(300, Math.round((currentRegion.latitudeDelta * 111 * 1000) / 2))
      );
    } else if (location) {
      // Fallback to user location if no current region
      fetchNearbyMarkers(
        location.coords.latitude,
        location.coords.longitude,
        3000
      );
    }
  }, [currentRegion, location, fetchNearbyMarkers]);

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
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={true}
            showsScale={true}
            followsUserLocation={true}
            initialRegion={currentRegion || defaultRegion}
            onRegionChangeComplete={handleRegionChangeComplete}
            onPoiClick={handlePoiClick}
            onMapReady={handleMapReady}
          >
            {/* Display all obstacle markers from the store */}
            {markers.map((marker, index) => (
              <MapMarker
                key={marker.id || `marker-${index}`}
                coordinate={{
                  latitude: marker.location.latitude,
                  longitude: marker.location.longitude,
                }}
                pinColor={getObstacleColor(marker.obstacleScore)}
                title={getMarkerTitle(marker)}
                description={getMarkerDescription(marker)}
                onPress={() => handleMarkerPress(marker)}
              />
            ))}

            {/* Display the route polyline if navigating */}
            {isNavigating && routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeWidth={5}
                strokeColor="#F1B24A"
                lineDashPattern={[1]}
              />
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
            onPress={zoomToCurrentLocation}
          >
            <Ionicons name="locate" size={24} color={isDark ? "#ffffff" : "#333333"} />
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
          {location && (
            <DirectionsPanel
              steps={routeSteps}
              visible={showDirections && isNavigating}
              onClose={() => setShowDirections(false)}
              currentLocation={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
              }}
            />
          )}

          {/* Add marker modal */}
          <AddMarkerModal
            visible={modalVisible}
            onClose={handleModalClose}
          />

          {/* Marker details modal */}
          <MarkerDetailsModal
            visible={detailsModalVisible}
            onClose={() => setDetailsModalVisible(false)}
            marker={selectedMarker}
          />

          {/* Route confirmation modal */}
          <RouteConfirmationModal
            visible={routeConfirmationModalVisible}
            onClose={() => setRouteConfirmationModalVisible(false)}
            onConfirm={handleRouteConfirmation}
            placeId={selectedPlace?.id || null}
            originLocation={location ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            } : null}
          />

          {/* Place Details Modal */}
          <PlaceDetailsModal
            visible={placeDetailsModalVisible}
            onClose={() => setPlaceDetailsModalVisible(false)}
            onStartNavigation={handleStartNavigation}
            placeId={selectedPoiPlaceId}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// Only style needed for the map to display properly
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
}); 