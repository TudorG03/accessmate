import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, FlatList, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';
import { searchPlaces, getPlaceDetails, PlacePrediction } from '@/services/places.service';
import { validateSearchQuery, sanitizeInput } from '@/utils/validation.utils';

// Custom debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

interface LocationSearchBarProps {
    onLocationSelected: (location: {
        name: string,
        address: string,
        coordinates: { latitude: number, longitude: number }
    }) => void;
    placeholder?: string;
    initialValue?: string;
}

export default function LocationSearchBar({
    onLocationSelected,
    placeholder = "Search for a location...",
    initialValue = ""
}: LocationSearchBarProps) {
    const { isDark } = useTheme();
    const [query, setQuery] = useState(initialValue);
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showPredictions, setShowPredictions] = useState(false);
    const [searchError, setSearchError] = useState('');

    // Debounced search function to avoid too many API calls
    const debouncedSearch = useCallback(
        debounce(async (searchQuery: string) => {
            if (searchQuery.trim().length < 2) {
                setPredictions([]);
                setShowPredictions(false);
                return;
            }

            setIsLoading(true);
            try {
                const results = await searchPlaces(searchQuery);
                setPredictions(results);
                setShowPredictions(true);
            } catch (error) {
                console.error('Error searching places:', error);
                setPredictions([]);
            } finally {
                setIsLoading(false);
            }
        }, 300),
        []
    );

    const handleTextChange = (text: string) => {
        // Sanitize input
        const sanitizedText = sanitizeInput(text);

        // Validate search query
        if (sanitizedText) {
            const validation = validateSearchQuery(sanitizedText);
            if (!validation.isValid) {
                setSearchError(validation.message || '');
                setPredictions([]);
                setShowPredictions(false);
                setQuery(sanitizedText);
                return;
            }
        }

        setSearchError('');
        setQuery(sanitizedText);
        debouncedSearch(sanitizedText);
    };

    const handlePredictionSelect = async (prediction: PlacePrediction) => {
        setIsLoading(true);
        setShowPredictions(false);
        setQuery(prediction.description);

        try {
            // Get detailed information about the selected place
            const placeDetails = await getPlaceDetails(prediction.place_id);

            // Extract the coordinates and other details
            const location = {
                name: placeDetails.name,
                address: placeDetails.formatted_address,
                coordinates: {
                    latitude: placeDetails.geometry.location.lat,
                    longitude: placeDetails.geometry.location.lng
                }
            };

            console.log('Selected location:', location);
            onLocationSelected(location);
        } catch (error) {
            console.error('Error getting place details:', error);
            // Fallback: use the prediction data if available
            onLocationSelected({
                name: prediction.structured_formatting.main_text,
                address: prediction.description,
                coordinates: { latitude: 0, longitude: 0 } // Will need to be handled by parent
            });
        } finally {
            setIsLoading(false);
        }
    };

    const clearSearch = () => {
        setQuery('');
        setPredictions([]);
        setShowPredictions(false);
        setSearchError('');
    };

    const renderPrediction = ({ item }: { item: PlacePrediction }) => (
        <TouchableOpacity
            onPress={() => handlePredictionSelect(item)}
            className={`p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
        >
            <View className="flex-row items-center">
                <Ionicons
                    name="location-outline"
                    size={20}
                    color="#F1B24A"
                    className="mr-3"
                />
                <View className="flex-1 ml-3">
                    <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
                        {item.structured_formatting.main_text}
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {item.structured_formatting.secondary_text}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderEmptyState = () => (
        <View className={`p-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <Text className={`text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No locations found. Try a different search term.
            </Text>
        </View>
    );

    return (
        <View className="relative">
            {/* Search Input */}
            <View className={`flex-row items-center rounded-xl border-2 px-4 py-3 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-white'
                }`}>
                <Ionicons
                    name="search"
                    size={20}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                />
                <TextInput
                    className={`flex-1 ml-3 text-base ${isDark ? 'text-white' : 'text-black'}`}
                    value={query}
                    onChangeText={handleTextChange}
                    placeholder={placeholder}
                    placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                    onFocus={() => {
                        if (predictions.length > 0) {
                            setShowPredictions(true);
                        }
                    }}
                />
                {isLoading && (
                    <ActivityIndicator size="small" color="#F1B24A" className="ml-2" />
                )}
                {query.length > 0 && !isLoading && (
                    <TouchableOpacity onPress={clearSearch} className="ml-2">
                        <Ionicons
                            name="close-circle"
                            size={20}
                            color={isDark ? "#9CA3AF" : "#6B7280"}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {/* Error Display */}
            {searchError && (
                <View className={`mt-2 p-3 rounded-lg border ${isDark ? 'border-red-600 bg-red-900/20' : 'border-red-300 bg-red-50'}`}>
                    <Text className={`text-sm text-center ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                        {searchError}
                    </Text>
                </View>
            )}

            {/* Predictions Dropdown */}
            {showPredictions && !searchError && (
                <View className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-lg z-50 max-h-60 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-white'
                    }`}>
                    {predictions.length > 0 ? (
                        <FlatList
                            data={predictions}
                            keyExtractor={(item) => item.place_id}
                            renderItem={renderPrediction}
                            showsVerticalScrollIndicator={false}
                            nestedScrollEnabled={true}
                        />
                    ) : query.length >= 2 && !isLoading ? (
                        renderEmptyState()
                    ) : null}
                </View>
            )}

            {/* Overlay to close predictions when tapping outside */}
            {showPredictions && (
                <TouchableOpacity
                    className="absolute inset-0 -z-10"
                    style={{
                        top: -1000,
                        bottom: -1000,
                        left: -1000,
                        right: -1000
                    }}
                    onPress={() => setShowPredictions(false)}
                    activeOpacity={1}
                />
            )}
        </View>
    );
} 