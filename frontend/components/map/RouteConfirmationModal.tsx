import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlaceDetails, getDirections } from '@/services/places.service';
import { useTheme } from '@/stores/theme/useTheme';
import { useMarker } from '@/stores/marker/hooks/useMarker';
import useAuth from '@/stores/auth/hooks/useAuth';
import { formatDistance } from '@/utils/distanceUtils';
import navigationHistoryService from '@/services/navigation-history.service';

interface RouteConfirmationModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (
        transportMode: 'walking' | 'driving',
        destination: any,
        useAccessibleRoute: boolean,
        navigationId?: string | null
    ) => void;
    placeId: string | null;
    originLocation: { latitude: number, longitude: number } | null;
}

export default function RouteConfirmationModal({
    visible,
    onClose,
    onConfirm,
    placeId,
    originLocation
}: RouteConfirmationModalProps) {
    const [placeDetails, setPlaceDetails] = useState<any>(null);
    const [isLoading, setLoading] = useState(false);
    const [selectedTransport, setSelectedTransport] = useState<'walking' | 'driving'>('walking');
    const [routeInfo, setRouteInfo] = useState<{ distance: number, duration: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [useAccessibleRoute, setUseAccessibleRoute] = useState(true);

    const { isDark, colors } = useTheme();
    const { markers } = useMarker();
    const { user } = useAuth();

    // Fetch place details when placeId changes
    useEffect(() => {
        if (placeId && visible) {
            fetchPlaceDetails();
        }
    }, [placeId, visible]);

    // Fetch directions when place details and transport mode change
    useEffect(() => {
        if (placeDetails && originLocation && visible) {
            fetchDirections(selectedTransport);
        }
    }, [placeDetails, selectedTransport, originLocation, visible]);

    async function fetchPlaceDetails() {
        if (!placeId) return;

        setLoading(true);
        setError(null);

        try {
            const details = await getPlaceDetails(placeId);
            setPlaceDetails(details);
        } catch (err) {
            console.error('Error fetching place details:', err);
            setError('Failed to load place information');
        } finally {
            setLoading(false);
        }
    }

    async function fetchDirections(mode: 'walking' | 'driving') {
        if (!placeDetails || !originLocation) return;

        setLoading(true);

        try {
            const destination = {
                latitude: placeDetails.geometry.location.lat,
                longitude: placeDetails.geometry.location.lng
            };

            const directions = await getDirections(originLocation, destination, mode);

            // directions.distance is now a number in kilometers
            setRouteInfo({
                distance: directions.distance,
                duration: directions.duration
            });
        } catch (err) {
            console.error('Error fetching directions:', err);
            setError('Failed to calculate route information');
        } finally {
            setLoading(false);
        }
    }

    async function handleConfirm() {
        if (!placeDetails) return;

        setLoading(true);
        console.log("🚀 Route Confirmation: Start button pressed");

        // Define the destination data
        const destination = {
            placeId: placeId as string,
            name: placeDetails.name,
            address: placeDetails.formatted_address,
            location: {
                latitude: placeDetails.geometry.location.lat,
                longitude: placeDetails.geometry.location.lng
            },
            types: placeDetails.types || []
        };
        console.log("🚀 Route Confirmation: Destination data prepared:", destination);

        // Record navigation history
        let navigationId: string | null = null;

        try {
            console.log("🚀 Route Confirmation: Calling navigationHistoryService.recordNavigationStart");
            console.log(destination);
            
            navigationId = await navigationHistoryService.recordNavigationStart(
                {
                    placeId: destination.placeId,
                    placeName: destination.name,
                    placeTypes: Array.isArray(destination.types) ? destination.types : ['place'],
                    location: destination.location
                },
                user?.id // Pass the user ID from useAuth hook
            );
            console.log("🚀 Route Confirmation: Navigation history recorded, ID:", navigationId);
        } catch (historyError) {
            console.error("🚀 Route Confirmation: Failed to record navigation history:", historyError);
            // We'll continue without a navigation ID
        }

        // Call onConfirm with navigationId (which might be null)
        console.log("🚀 Route Confirmation: Calling onConfirm with navigationId:", navigationId);
        onConfirm(selectedTransport, destination, useAccessibleRoute, navigationId);
        setLoading(false);
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black bg-opacity-50">
                <View className={`rounded-t-3xl ${isDark ? 'bg-gray-900' : 'bg-white'} p-5 min-h-[65%] max-h-[90%]`}>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Navigate to destination</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={isDark ? "white" : "black"} />
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <View className="flex-1 justify-center items-center py-10">
                            <ActivityIndicator size="large" color="#F1B24A" />
                            <Text className={`mt-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                Loading route information...
                            </Text>
                        </View>
                    ) : error ? (
                        <View className="flex-1 justify-center items-center py-10">
                            <Ionicons name="alert-circle" size={48} color="red" />
                            <Text className="text-red-500 text-center mt-4">{error}</Text>
                        </View>
                    ) : placeDetails ? (
                        <ScrollView className="flex-1">
                            <View className="mb-5">
                                <Text className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>{placeDetails.name}</Text>
                                <Text className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{placeDetails.formatted_address}</Text>
                            </View>

                            <Text className={`text-base font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>Select mode of transportation:</Text>

                            <View className="flex-row justify-around mb-5">
                                <TouchableOpacity
                                    className={`flex-1 p-4 items-center rounded-lg border mx-1 ${selectedTransport === 'walking'
                                        ? `border-[#F1B24A] ${isDark ? 'bg-[#3a3300]' : 'bg-[#fff8e7]'}`
                                        : `${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`
                                        }`}
                                    onPress={() => setSelectedTransport('walking')}
                                >
                                    <Ionicons
                                        name="walk"
                                        size={28}
                                        color={selectedTransport === 'walking' ? '#F1B24A' : isDark ? '#888' : '#666'}
                                    />
                                    <Text className={`mt-1 font-medium ${selectedTransport === 'walking'
                                        ? 'text-[#F1B24A] font-bold'
                                        : isDark ? 'text-gray-300' : 'text-gray-600'
                                        }`}>Walking</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className={`flex-1 p-4 items-center rounded-lg border mx-1 ${selectedTransport === 'driving'
                                        ? `border-[#F1B24A] ${isDark ? 'bg-[#3a3300]' : 'bg-[#fff8e7]'}`
                                        : `${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`
                                        }`}
                                    onPress={() => setSelectedTransport('driving')}
                                >
                                    <Ionicons
                                        name="car"
                                        size={28}
                                        color={selectedTransport === 'driving' ? '#F1B24A' : isDark ? '#888' : '#666'}
                                    />
                                    <Text className={`mt-1 font-medium ${selectedTransport === 'driving'
                                        ? 'text-[#F1B24A] font-bold'
                                        : isDark ? 'text-gray-300' : 'text-gray-600'
                                        }`}>Car</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Route Info */}
                            {routeInfo && (
                                <View className={`flex-row justify-around p-4 rounded-lg mb-5 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                    <View className="items-center">
                                        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Distance</Text>
                                        <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                            {routeInfo.distance < 1
                                                ? `${Math.round(routeInfo.distance * 1000)} m`
                                                : formatDistance(routeInfo.distance, user?.preferences?.preferedUnit)
                                            }
                                        </Text>
                                    </View>
                                    <View className="items-center">
                                        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Duration</Text>
                                        <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{routeInfo.duration}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Accessible Routing Option - only show for walking */}
                            {selectedTransport === 'walking' && (
                                <View className={`p-4 rounded-lg mb-5 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                    <View className="flex-row justify-between items-center mb-2">
                                        <View className="flex-row items-center">
                                            <Ionicons name="accessibility" size={22} color="#F1B24A" />
                                            <Text className={`ml-2 font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                                Accessible Route
                                            </Text>
                                        </View>
                                        <Switch
                                            value={useAccessibleRoute}
                                            onValueChange={setUseAccessibleRoute}
                                            trackColor={{ false: isDark ? '#4b5563' : '#d1d5db', true: '#F1B24A' }}
                                            thumbColor={isDark ? '#e5e7eb' : '#ffffff'}
                                        />
                                    </View>

                                    <Text className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        {useAccessibleRoute
                                            ? 'Routes will be optimized to avoid obstacles and barriers using OpenStreetMap data for more accurate walkways.'
                                            : 'Standard Google Maps route without accessibility optimizations.'}
                                    </Text>
                                </View>
                            )}

                            <View className={`flex-row items-center p-4 rounded-lg mb-5 ${isDark ? 'bg-[#1a355b]' : 'bg-[#e6f2ff]'}`}>
                                <Ionicons name="information-circle" size={24} color={isDark ? "#a8c7f0" : "#3498db"} />
                                <Text className={`flex-1 ml-2.5 text-sm ${isDark ? 'text-[#a8c7f0]' : 'text-[#3498db]'}`}>
                                    This route will prioritize accessible paths and avoid obstacles when possible.
                                </Text>
                            </View>
                        </ScrollView>
                    ) : null}

                    {/* Action Buttons */}
                    <View className="flex-row justify-between p-5 border-t border-gray-700">
                        <TouchableOpacity
                            className={`px-6 py-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}
                            onPress={onClose}
                        >
                            <Text className={isDark ? 'text-white' : 'text-gray-800'}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className={`px-6 py-3 rounded-lg ${!placeDetails || isLoading ? 'bg-gray-600' : 'bg-[#F1B24A]'}`}
                            onPress={handleConfirm}
                            disabled={!placeDetails || isLoading}
                        >
                            <View className="flex-row items-center">
                                <Text className={`font-medium text-white mr-1`}>Start</Text>
                                <Ionicons name="navigate" size={16} color="white" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
} 