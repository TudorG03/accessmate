import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useTheme } from "../../stores/theme/useTheme";
import { formatDistance } from "@/utils/distanceUtils";
import useAuth from "../../stores/auth/hooks/useAuth";
import { getNearbyPlaces, NearbyPlace } from "../../services/places.service";
import { PlaceType } from "@/types/auth.types";

const NearbyPlaces = () => {
    const { colors, isDark } = useTheme();
    const { user } = useAuth();
    const [places, setPlaces] = useState<NearbyPlace[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMockData, setIsMockData] = useState(false);

    // Function to fetch nearby places based on user preferences
    const fetchNearbyPlaces = async () => {
        try {
            setLoading(true);
            setError(null);
            setIsMockData(false);

            // Get user preferences
            const activityTypes = user?.preferences?.activityTypes || [];
            const searchRadius = user?.preferences?.searchRadius || 5; // Default 5km/mi
            const baseLocation = user?.preferences?.baseLocation || { latitude: 0, longitude: 0 };

            console.log('Fetching nearby places with:', {
                activityTypes: activityTypes.map((t: PlaceType) => t.value),
                searchRadius,
                baseLocation
            });

            // Use the places service to fetch nearby places
            const nearbyPlaces = await getNearbyPlaces({
                location: baseLocation,
                radius: searchRadius,
                types: activityTypes.map((type: PlaceType) => type.value),
                maxResults: 10
            });

            console.log(`Received ${nearbyPlaces.length} places from API`);

            // If places array is not empty but contains mock data (as identified by mock IDs),
            // set the isMockData flag
            if (nearbyPlaces.length > 0 && nearbyPlaces[0].id.startsWith('mock')) {
                setIsMockData(true);
                console.log('Using mock data instead of API results');
            }

            // Calculate distance for each place if location is available and distance not already set
            const placesWithDistance = nearbyPlaces.map(place => {
                if (place.location && !place.distance) {
                    const distance = calculateDistance(
                        baseLocation.latitude,
                        baseLocation.longitude,
                        place.location.latitude,
                        place.location.longitude
                    );
                    return { ...place, distance };
                }
                return place;
            });

            setPlaces(placesWithDistance);
        } catch (err) {
            console.error('Error fetching nearby places:', err);
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

    // Fetch places when component mounts or when user preferences change
    useEffect(() => {
        fetchNearbyPlaces();
    }, [user?.preferences]);

    if (loading) {
        return (
            <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12, color: colors.text }}>
                    Nearby Places
                </Text>
                <View style={{ alignItems: 'center', justifyContent: 'center', height: 150 }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </View>
        );
    }

    if (error && places.length === 0) {
        return (
            <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12, color: colors.text }}>
                    Nearby Places
                </Text>
                <View style={{ padding: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.text }}>Unable to load places. Please try again later.</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12, color: colors.text }}>
                Nearby Places {isMockData && '(Demo Data)'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {places.map((place) => (
                    <View key={place.id} style={{ marginRight: 16, backgroundColor: colors.card, padding: 12, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border, width: 256 }}>
                        <View style={{ height: 128, backgroundColor: isDark ? colors.border : '#e5e7eb', borderRadius: 8, marginBottom: 8 }} />
                        <Text style={{ fontWeight: '500', color: colors.text }}>{place.name}</Text>
                        {place.distance && (
                            <Text style={{ fontSize: 12, color: colors.secondary, marginBottom: 4 }}>
                                {formatDistance(place.distance, user?.preferences?.preferedUnit)} away
                            </Text>
                        )}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {place.types.slice(0, 2).map((feature, index) => (
                                <View
                                    key={index}
                                    style={{
                                        backgroundColor: index === 0
                                            ? (isDark ? '#172554' : '#dbeafe')
                                            : (isDark ? '#14532d' : '#dcfce7'),
                                        borderRadius: 999,
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        marginRight: 4,
                                        marginBottom: 4
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: index === 0
                                                ? (isDark ? '#93c5fd' : '#3b82f6')
                                                : (isDark ? '#86efac' : '#16a34a')
                                        }}
                                    >
                                        {feature}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

export default NearbyPlaces; 