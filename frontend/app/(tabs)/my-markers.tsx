import React, { useEffect, useState, useCallback, Fragment } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMarker } from '@/stores/marker/hooks/useMarker';
import { Marker } from '@/types/marker.types';
import { getObstacleEmoji } from '@/stores/marker/marker.utils';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';
import { useRouter } from 'expo-router';
import MarkerDetailsModal from '@/components/markers/MarkerDetailsModal';
import AddMarkerModal from '@/components/markers/AddMarkerModal';

export default function MyMarkersScreen() {
    const { userMarkers, fetchUserMarkers, isLoading, deleteMarker } = useMarker();
    const [refreshing, setRefreshing] = useState(false);
    const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [markerToEdit, setMarkerToEdit] = useState<Marker | null>(null);
    const { isDark, colors } = useTheme();
    const router = useRouter();

    // Load user's markers when the screen is first rendered
    useEffect(() => {
        loadUserMarkers();
    }, []);

    // Function to load user markers
    const loadUserMarkers = useCallback(async () => {
        try {
            await fetchUserMarkers();
        } catch (error) {
            console.error('Error loading user markers:', error);
        }
    }, [fetchUserMarkers]);

    // Handle pull-to-refresh
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadUserMarkers();
        } finally {
            setRefreshing(false);
        }
    }, [loadUserMarkers]);

    // Handle marker deletion
    const handleDeleteMarker = useCallback(async (markerId: string) => {
        Alert.alert(
            'Delete Marker',
            'Are you sure you want to delete this marker?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await deleteMarker(markerId);
                            if (success) {
                                // Refresh the list
                                await loadUserMarkers();
                            }
                        } catch (error) {
                            console.error('Error deleting marker:', error);
                            Alert.alert('Error', 'Failed to delete marker. Please try again.');
                        }
                    }
                }
            ]
        );
    }, [deleteMarker, loadUserMarkers]);

    // Handle viewing marker details
    const handleViewMarker = useCallback((marker: Marker) => {
        setSelectedMarker(marker);
        setDetailsModalVisible(true);
    }, []);

    // Handle editing marker
    const handleEditMarker = useCallback((marker: Marker) => {
        setMarkerToEdit(marker);
        setEditModalVisible(true);
    }, []);

    // Handle edit modal close and refresh
    const handleEditModalClose = useCallback(() => {
        setEditModalVisible(false);
        setMarkerToEdit(null);
        loadUserMarkers(); // Refresh the markers list after editing
    }, [loadUserMarkers]);

    // Format the obstacle type for display
    const formatObstacleType = (type: string): string => {
        return type.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    };

    // Get severity text
    const getSeverityText = (score: number): string => {
        if (score >= 4) return 'High';
        if (score >= 2) return 'Medium';
        return 'Low';
    };

    // Get severity color
    const getSeverityColor = (score: number): string => {
        if (score >= 4) return isDark ? 'text-red-500' : 'text-red-600';
        if (score >= 2) return isDark ? 'text-orange-500' : 'text-orange-600';
        return isDark ? 'text-green-500' : 'text-green-600';
    };

    return (
        <SafeAreaView className={`flex-1 ${isDark ? 'bg-dark-background' : 'bg-white'}`} edges={['left', 'right']}>
            {/* Header */}
            <View className={`px-4 py-3 flex-row justify-center items-center border-b ${isDark ? 'border-dark-border' : 'border-gray-200'}`}>
                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                    My Markers
                </Text>
            </View>

            {isLoading && !refreshing ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#F1B24A" />
                </View>
            ) : (
                <ScrollView
                    className="flex-1"
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#F1B24A']}
                            tintColor={isDark ? '#F1B24A' : undefined}
                        />
                    }
                >
                    {userMarkers.length === 0 ? (
                        <View className="flex-1 justify-center items-center p-8 pt-16">
                            <Ionicons
                                name="bookmarks-outline"
                                size={64}
                                color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}
                            />
                            <Text className={`text-center mt-4 text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                You haven't added any markers yet
                            </Text>
                            <TouchableOpacity
                                className="mt-6 bg-[#F1B24A] rounded-lg px-6 py-3"
                                onPress={() => router.push('/(tabs)/map')}
                            >
                                <Text className="text-white font-semibold">Add Markers on Map</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className="p-4">
                            {userMarkers.map((marker) => (
                                <View
                                    key={`marker-${marker.id}`}
                                    className={`mb-4 rounded-lg p-4 shadow-sm ${isDark ? 'bg-dark-card' : 'bg-gray-50'}`}
                                >
                                    <View className="flex-row justify-between items-start">
                                        <View className="flex-1">
                                            <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                                                {getObstacleEmoji(marker.obstacleType)} {formatObstacleType(marker.obstacleType)}
                                            </Text>
                                            <Text className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {new Date(marker.createdAt).toLocaleDateString()}
                                            </Text>
                                            <Text className={`mt-2 ${getSeverityColor(marker.obstacleScore)}`}>
                                                {getSeverityText(marker.obstacleScore)} Severity
                                            </Text>
                                            {marker.description ? (
                                                <Text
                                                    key={`desc-${marker.id}`}
                                                    className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                                                    numberOfLines={2}
                                                >
                                                    {marker.description}
                                                </Text>
                                            ) : null}
                                            {/* Photo count indicator */}
                                            <View key={`photos-${marker.id}`} className="flex-row items-center mt-2">
                                                <Ionicons
                                                    key={`icon-${marker.id}`}
                                                    name={marker.images && marker.images.length > 0 ? "images-outline" : "image-outline"}
                                                    size={14}
                                                    color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                                                />
                                                <Text key={`count-${marker.id}`} className={`ml-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {marker.images && marker.images.length > 0
                                                        ? `${marker.images.length} photo${marker.images.length !== 1 ? 's' : ''}`
                                                        : 'No photos'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View className="flex-row">
                                            <TouchableOpacity
                                                key={`view-${marker.id}`}
                                                className="p-2"
                                                onPress={() => handleViewMarker(marker)}
                                            >
                                                <Ionicons
                                                    name="eye"
                                                    size={20}
                                                    color={isDark ? colors.primary : '#F1B24A'}
                                                />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                key={`edit-${marker.id}`}
                                                className="p-2 ml-1"
                                                onPress={() => handleEditMarker(marker)}
                                            >
                                                <Ionicons
                                                    name="pencil"
                                                    size={20}
                                                    color={isDark ? colors.secondary : '#7ED8C3'}
                                                />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                key={`delete-${marker.id}`}
                                                className="p-2 ml-1"
                                                onPress={() => handleDeleteMarker(marker.id)}
                                            >
                                                <Ionicons
                                                    name="trash"
                                                    size={20}
                                                    color={isDark ? '#ff6b6b' : '#dc3545'}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Marker details modal */}
            <MarkerDetailsModal
                visible={detailsModalVisible}
                onClose={() => setDetailsModalVisible(false)}
                marker={selectedMarker}
            />

            {/* Marker edit modal */}
            <AddMarkerModal
                visible={editModalVisible}
                onClose={handleEditModalClose}
                editingMarker={markerToEdit}
            />
        </SafeAreaView>
    );
} 