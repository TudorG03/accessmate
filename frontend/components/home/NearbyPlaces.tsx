import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, Image, TouchableOpacity, Alert, Switch } from "react-native";
import { useTheme } from "../../stores/theme/useTheme";
import { formatDistance } from "@/utils/distanceUtils";
import useAuth from "../../stores/auth/hooks/useAuth";
import { getNearbyPlaces, NearbyPlace, getPlacePhoto } from "../../services/places.service";
import { PlaceType } from "@/types/auth.types";
import { useLocation } from "@/stores/location/hooks/useLocation";
import { router } from "expo-router";
import { useLocationStore } from "@/stores/location/location.store";

const NearbyPlaces = () => {
    const { colors, isDark } = useTheme();
    const { user } = useAuth();
    const { ensureValidLocation } = useLocation();
    const [places, setPlaces] = useState<NearbyPlace[]>([]);
    const [placeImages, setPlaceImages] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMockData, setIsMockData] = useState(false);
    const [locationSource, setLocationSource] = useState<'gps' | 'preferences' | 'fallback'>('gps');
    const [useCurrentLocation, setUseCurrentLocation] = useState(true);

    // Function to handle place card tap
    const handlePlaceCardPress = (place: NearbyPlace) => {
        console.log('Place card tapped:', place.name, 'ID:', place.id);
        console.log('Full place object:', JSON.stringify(place, null, 2));

        // Validate the place ID before navigation
        if (!place.id || place.id.startsWith('mock') || place.id.startsWith('anonymous_place_')) {
            console.warn('Invalid place ID detected, cannot open details for mock/anonymous data');
            Alert.alert(
                "Demo Data",
                "This place data is not complete. To see real place details, please ensure you have an active internet connection and try refreshing the nearby places.",
                [{ text: "OK" }]
            );
            return;
        }

        // Validate that we have a proper Google Places ID (usually starts with ChIJ)
        if (place.id.length < 20) {
            console.warn('Place ID appears to be invalid (too short):', place.id);
            Alert.alert(
                "Invalid Place",
                "This place doesn't have valid details available. Please try selecting a different place.",
                [{ text: "OK" }]
            );
            return;
        }

        // Navigate to map tab with the place ID to open the details modal
        router.push({
            pathname: "/(tabs)/map",
            params: {
                openPlaceDetails: "true",
                placeId: place.id
            }
        });
    };

    // Function to fetch place images
    const fetchPlaceImages = async (placesData: NearbyPlace[]) => {
        const imagePromises = placesData.map(async (place) => {
            if (place.photo) {
                try {
                    const imageUrl = await getPlacePhoto(place.photo, 300, 200);
                    if (imageUrl) {
                        return { id: place.id, url: imageUrl };
                    }
                } catch (error) {
                    console.error(`Error fetching image for place ${place.name}:`, error);
                }
            }
            return null;
        });

        const results = await Promise.all(imagePromises);
        const imageMap: Record<string, string> = {};

        results.forEach((result) => {
            if (result) {
                imageMap[result.id] = result.url;
            }
        });

        setPlaceImages(imageMap);
    };

    // Function to fetch nearby places based on user preferences
    const fetchNearbyPlaces = async () => {
        try {
            setLoading(true);
            setError(null);
            setIsMockData(false);

            // Get user preferences
            const activityTypes = user?.preferences?.activityTypes || [];
            const searchRadius = user?.preferences?.searchRadius || 5; // Default 5km/mi

            let effectiveLocation = { latitude: 0, longitude: 0 };

            // Check user's preference first
            if (useCurrentLocation) {
                // Priority 1: Try to get current GPS location (when user prefers current location)
                // Note: Location should already be initialized by LocationProvider
                try {
                    console.log('🌍 User prefers current location - checking location store...');

                    // Get the current location from the location store
                    const locationStore = useLocationStore.getState();
                    const currentLoc = locationStore.getPersistedLocation();

                    if (currentLoc &&
                        (Math.abs(currentLoc.latitude) > 0.000001 || Math.abs(currentLoc.longitude) > 0.000001)) {
                        effectiveLocation = currentLoc;
                        console.log('✅ Using current GPS location:', effectiveLocation);
                        setLocationSource('gps');
                    } else {
                        // If no persisted location, try to ensure we have valid location
                        console.log('🌍 No persisted location found, ensuring valid location...');
                        await ensureValidLocation();
                        const updatedLoc = locationStore.getPersistedLocation();

                        if (updatedLoc &&
                            (Math.abs(updatedLoc.latitude) > 0.000001 || Math.abs(updatedLoc.longitude) > 0.000001)) {
                            effectiveLocation = updatedLoc;
                            console.log('✅ Using ensured GPS location:', effectiveLocation);
                            setLocationSource('gps');
                        } else {
                            throw new Error('No valid current location available');
                        }
                    }
                } catch (gpsError) {
                    console.log('⚠️ GPS location not available, falling back to base location:', gpsError);

                    // Fallback to base location when GPS fails
                    if (user?.preferences?.baseLocation &&
                        (Math.abs(user.preferences.baseLocation.latitude) > 0.000001 ||
                            Math.abs(user.preferences.baseLocation.longitude) > 0.000001)) {
                        effectiveLocation = user.preferences.baseLocation;
                        console.log('📍 Using base location as fallback:', effectiveLocation);
                        setLocationSource('preferences');
                    } else {
                        console.log('⚠️ No valid base location in preferences');

                        // Final fallback to default location
                        const locationStore = useLocationStore.getState();
                        effectiveLocation = locationStore.getLastKnownLocation();
                        console.log('🔄 Using default location as final fallback:', effectiveLocation);
                        setLocationSource('fallback');
                    }
                }
            } else {
                // Priority 1: Use base location (when user prefers base location)
                if (user?.preferences?.baseLocation &&
                    (Math.abs(user.preferences.baseLocation.latitude) > 0.000001 ||
                        Math.abs(user.preferences.baseLocation.longitude) > 0.000001)) {
                    effectiveLocation = user.preferences.baseLocation;
                    console.log('🏠 User prefers base location:', effectiveLocation);
                    setLocationSource('preferences');
                } else {
                    console.log('⚠️ No base location set, falling back to current location');

                    // Fallback to current location when no base location is set
                    // Note: Location should already be initialized by LocationProvider
                    try {
                        const locationStore = useLocationStore.getState();
                        const currentLoc = locationStore.getPersistedLocation();

                        if (currentLoc &&
                            (Math.abs(currentLoc.latitude) > 0.000001 || Math.abs(currentLoc.longitude) > 0.000001)) {
                            effectiveLocation = currentLoc;
                            console.log('✅ Using current GPS location as fallback:', effectiveLocation);
                            setLocationSource('gps');
                        } else {
                            // If still no location, try to ensure we have valid location
                            console.log('🌍 No persisted location, ensuring valid location...');
                            await ensureValidLocation();
                            const updatedLoc = locationStore.getPersistedLocation();

                            if (updatedLoc &&
                                (Math.abs(updatedLoc.latitude) > 0.000001 || Math.abs(updatedLoc.longitude) > 0.000001)) {
                                effectiveLocation = updatedLoc;
                                console.log('✅ Using ensured GPS location as fallback:', effectiveLocation);
                                setLocationSource('gps');
                            } else {
                                throw new Error('No valid current location available');
                            }
                        }
                    } catch (gpsError) {
                        console.log('⚠️ GPS also not available, using default location:', gpsError);

                        // Final fallback to default location
                        const locationStore = useLocationStore.getState();
                        effectiveLocation = locationStore.getLastKnownLocation();
                        console.log('🔄 Using default location as final fallback:', effectiveLocation);
                        setLocationSource('fallback');
                    }
                }
            }

            // Print full request parameters for debugging
            console.log('🔍 Fetching nearby places with:', {
                activityTypes: activityTypes.map((t: PlaceType) => t.value),
                searchRadius,
                effectiveLocation,
                locationSource: effectiveLocation === user?.preferences?.baseLocation ? 'preferences' : 'gps/store'
            });

            // Use the places service to fetch nearby places
            const nearbyPlaces = await getNearbyPlaces({
                location: effectiveLocation,
                radius: searchRadius,
                types: activityTypes.map((type: PlaceType) => type.value),
                maxResults: 10
            });

            console.log(`📍 Received ${nearbyPlaces.length} places from API using location: ${effectiveLocation.latitude.toFixed(6)}, ${effectiveLocation.longitude.toFixed(6)}`);

            // If places array is not empty but contains mock data (as identified by mock IDs),
            // set the isMockData flag
            if (nearbyPlaces.length > 0 && nearbyPlaces[0].id.startsWith('mock')) {
                setIsMockData(true);
                console.log('🎭 Using mock data instead of API results');
            }

            // Calculate distance for each place if location is available and distance not already set
            const placesWithDistance = nearbyPlaces.map(place => {
                if (place.location && !place.distance) {
                    const distance = calculateDistance(
                        effectiveLocation.latitude,
                        effectiveLocation.longitude,
                        place.location.latitude,
                        place.location.longitude
                    );
                    return { ...place, distance };
                }
                return place;
            });

            setPlaces(placesWithDistance);

            // Fetch images for places that have photo references
            await fetchPlaceImages(placesWithDistance);

        } catch (err) {
            console.error('❌ Error fetching nearby places:', err);
            setError('Could not load nearby places');
            setIsMockData(true);
        } finally {
            setLoading(false);
        }
    };

    // Simple Haversine formula to calculate distance between two coordinates
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c; // Distance in km
        return distance;
    };

    const deg2rad = (deg: number): number => {
        return deg * (Math.PI / 180);
    };

    // Fetch places when component mounts or when user preferences or location preference changes
    useEffect(() => {
        fetchNearbyPlaces();
    }, [user?.preferences, useCurrentLocation]);

    if (loading) {
        return (
            <View className="mb-6">
                <Text className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    Nearby Places
                </Text>
                <View className="items-center justify-center h-[150px]">
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </View>
        );
    }

    if (error && places.length === 0) {
        return (
            <View className="mb-6">
                <Text className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    Nearby Places
                </Text>
                <View className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <Text className={`${isDark ? 'text-white' : 'text-gray-800'}`}>Unable to load places. Please try again later.</Text>
                </View>
            </View>
        );
    }

    return (
        <View className="mb-6">
            {/* Location Preference Toggle */}
            <View className={`p-3 rounded-xl border mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
                            {useCurrentLocation ? 'Using Current Location' : 'Using Base Location'}
                        </Text>
                        <Text className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {useCurrentLocation
                                ? 'Finding places near your GPS location'
                                : 'Finding places near your saved base location'
                            }
                        </Text>
                    </View>
                    <Switch
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="white"
                        onValueChange={(value) => {
                            setUseCurrentLocation(value);
                            // The useEffect will automatically trigger fetchNearbyPlaces when useCurrentLocation changes
                        }}
                        value={useCurrentLocation}
                    />
                </View>

                {/* Show helper text when base location is selected but not set */}
                {!useCurrentLocation && (!user?.preferences?.baseLocation ||
                    (Math.abs(user.preferences.baseLocation.latitude) < 0.000001 &&
                        Math.abs(user.preferences.baseLocation.longitude) < 0.000001)) && (
                        <View className={`mt-2 p-2 rounded-lg ${isDark ? 'bg-orange-900/20' : 'bg-orange-100'}`}>
                            <Text className={`text-xs ${isDark ? 'text-orange-300' : 'text-orange-600'}`}>
                                ⚠️ No base location set. Go to Settings → Preferences to set your base location.
                            </Text>
                        </View>
                    )}
            </View>

            <View className="flex-row items-center justify-between mb-3">
                <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    {
                        locationSource === 'gps' ?
                            'Nearby Places' : locationSource === 'preferences' ?
                                'Around my base location' : 'Error - Using a default location'
                    }
                </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {places.map((place) => (
                    <TouchableOpacity
                        key={place.id}
                        onPress={() => handlePlaceCardPress(place)}
                        activeOpacity={0.7}
                        className="mr-4"
                    >
                        <View
                            className={`p-3 rounded-xl border w-64 h-72 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                            style={{
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                elevation: 2,
                            }}
                        >
                            {/* Image or placeholder - Fixed height */}
                            {placeImages[place.id] ? (
                                <Image
                                    source={{ uri: placeImages[place.id] }}
                                    className="h-32 rounded-lg mb-3"
                                    resizeMode="cover"
                                    onError={(error) => {
                                        console.log(`🖼️ Place image load error for ${place.name}:`, error);
                                    }}
                                    onLoad={() => {
                                        console.log(`🖼️ Place image loaded successfully for ${place.name}`);
                                    }}
                                />
                            ) : (
                                <View className={`h-32 rounded-lg mb-3 items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                    <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {place.photo ? 'Loading...' : 'No image'}
                                    </Text>
                                </View>
                            )}

                            {/* Content area - Flexible but controlled */}
                            <View className="flex-1 justify-between">
                                {/* Top content */}
                                <View>
                                    <Text
                                        className={`font-medium text-base mb-1 ${isDark ? 'text-white' : 'text-gray-800'}`}
                                        numberOfLines={2}
                                        ellipsizeMode="tail"
                                    >
                                        {place.name}
                                    </Text>
                                    {place.distance && (
                                        <Text className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {formatDistance(place.distance, user?.preferences?.preferedUnit)} away
                                        </Text>
                                    )}
                                </View>

                                {/* Bottom content - Feature tags */}
                                <View className="flex-row flex-wrap mt-auto">
                                    {place.types.slice(0, 2).map((feature, index) => (
                                        <View
                                            key={index}
                                            className={`rounded-full px-2 py-1 mr-1 mb-1 ${index === 0
                                                ? (isDark ? 'bg-blue-900' : 'bg-blue-100')
                                                : (isDark ? 'bg-green-900' : 'bg-green-100')
                                                }`}
                                        >
                                            <Text
                                                className={`text-xs ${index === 0
                                                    ? (isDark ? 'text-blue-300' : 'text-blue-600')
                                                    : (isDark ? 'text-green-300' : 'text-green-600')
                                                    }`}
                                                numberOfLines={1}
                                            >
                                                {feature}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

export default NearbyPlaces; 