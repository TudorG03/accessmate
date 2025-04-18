import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Dimensions, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker as MapMarker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import AddMarkerModal from "@/components/markers/AddMarkerModal";
import { useMarker } from "@/stores/marker/hooks/useMarker";
import { Marker } from "@/types/marker.types";
import { getObstacleColor, getObstacleEmoji } from "@/stores/marker/marker.utils";

type LocationObjectType = Location.LocationObject;

export default function MapScreen() {
  const [location, setLocation] = useState<LocationObjectType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [isFetchingMarkers, setIsFetchingMarkers] = useState(false);
  const mapRef = useRef<MapView | null>(null);

  // Use our marker hook to access marker data
  const { markers, findNearbyMarkers } = useMarker();

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
    return `${severity} severity: ${marker.description || 'No description'}`;
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
    <SafeAreaView className="flex-1 bg-white">
      {isLoading ? (
        <View className="flex-1 justify-center items-center p-4">
          <ActivityIndicator size="large" className="mb-2" color="#F1B24A" />
          <Text className="text-gray-600">Getting your location...</Text>
        </View>
      ) : errorMsg ? (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-red-500 text-center mb-4">{errorMsg}</Text>
          <Text className="text-gray-600 text-center">
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
              />
            ))}
          </MapView>

          {/* Loading indicator when fetching markers */}
          {isFetchingMarkers && (
            <View className="absolute top-5 self-center bg-white bg-opacity-80 p-2 rounded-full shadow">
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
            className="absolute bottom-8 right-5 bg-[#4285F4] rounded-full w-[60px] h-[60px] justify-center items-center shadow-md"
            onPress={zoomToCurrentLocation}
          >
            <Ionicons name="locate" size={24} color="white" />
          </TouchableOpacity>

          {/* Marker add modal */}
          <AddMarkerModal
            visible={modalVisible}
            onClose={handleModalClose}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}); 