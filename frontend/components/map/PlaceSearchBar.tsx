import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';
import { searchPlaces, getPlaceDetails, PlacePrediction } from '@/services/places.service';
import { debounce } from 'lodash';

interface PlaceSearchBarProps {
    onPlaceSelected: (place: { id: string, name: string, address: string }) => void;
    onLocationSelected: (location: { latitude: number, longitude: number }) => void;
}

export default function PlaceSearchBar({ onPlaceSelected, onLocationSelected }: PlaceSearchBarProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { isDark, colors } = useTheme();

    // Debounced search function to avoid too many API calls
    const debouncedSearch = useCallback(
        debounce(async (text: string) => {
            if (!text.trim()) {
                setPredictions([]);
                setIsLoading(false);
                return;
            }

            try {
                const results = await searchPlaces(text);
                setPredictions(results);
            } catch (error) {
                console.error('Error searching places:', error);
            } finally {
                setIsLoading(false);
            }
        }, 500),
        []
    );

    // Function to search for places
    const handleSearchInput = (text: string) => {
        setSearchQuery(text);
        setIsLoading(true);
        debouncedSearch(text);
    };

    // Function to get place details and coordinates
    const handleSelectPlace = async (prediction: PlacePrediction) => {
        try {
            setIsLoading(true);

            // Get place details including coordinates
            const details = await getPlaceDetails(prediction.place_id);

            // Prepare location object
            const location = {
                latitude: details.geometry.location.lat,
                longitude: details.geometry.location.lng
            };

            // Notify the parent components
            onPlaceSelected({
                id: prediction.place_id,
                name: prediction.structured_formatting.main_text,
                address: prediction.structured_formatting.secondary_text,
            });

            onLocationSelected(location);

            // Clear the search
            setSearchQuery('');
            setPredictions([]);
        } catch (error) {
            console.error('Error fetching place details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Style based on theme
    const backgroundColor = isDark ? colors.card : '#fff';
    const textColor = isDark ? colors.text : '#000';
    const placeholderColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

    return (
        <View style={[styles.container, { backgroundColor: 'transparent' }]}>
            <View style={[styles.searchBar, { backgroundColor }]}>
                <Ionicons
                    name="search"
                    size={20}
                    color={isDark ? colors.text : '#666'}
                    style={styles.searchIcon}
                />
                <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="Search for a place..."
                    placeholderTextColor={placeholderColor}
                    value={searchQuery}
                    onChangeText={handleSearchInput}
                />
                {isLoading ? (
                    <ActivityIndicator size="small" color="#F1B24A" style={styles.loadingIcon} />
                ) : searchQuery ? (
                    <TouchableOpacity
                        onPress={() => {
                            setSearchQuery('');
                            setPredictions([]);
                        }}
                        style={styles.clearButton}
                    >
                        <Ionicons name="close" size={20} color={isDark ? colors.text : '#666'} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {predictions.length > 0 && (
                <FlatList
                    data={predictions}
                    keyExtractor={(item) => item.place_id}
                    style={[styles.predictionList, { backgroundColor }]}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.predictionItem}
                            onPress={() => handleSelectPlace(item)}
                        >
                            <Ionicons name="location" size={16} color="#F1B24A" style={styles.locationIcon} />
                            <View>
                                <Text style={[styles.mainText, { color: textColor }]}>
                                    {item.structured_formatting.main_text}
                                </Text>
                                <Text style={styles.secondaryText}>
                                    {item.structured_formatting.secondary_text}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        zIndex: 1,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    searchIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        height: 45,
        fontSize: 16,
    },
    loadingIcon: {
        marginLeft: 8,
    },
    clearButton: {
        padding: 8,
    },
    predictionList: {
        marginTop: 5,
        borderRadius: 8,
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    predictionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    locationIcon: {
        marginRight: 12,
    },
    mainText: {
        fontSize: 16,
        fontWeight: '500',
    },
    secondaryText: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
}); 