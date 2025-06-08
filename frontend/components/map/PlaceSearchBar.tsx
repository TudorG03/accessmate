import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';
import { searchPlaces, getPlaceDetails, PlacePrediction } from '@/services/places.service';
import { debounce } from 'lodash';
import { validateSearchQuery, sanitizeInput } from '@/utils/validation.utils';

interface PlaceSearchBarProps {
    onPlaceSelected: (place: { id: string, name: string, address: string }) => void;
    onLocationSelected: (location: { latitude: number, longitude: number }) => void;
    onPlaceInfoRequested: (placeId: string) => void;
}

export default function PlaceSearchBar({
    onPlaceSelected,
    onLocationSelected,
    onPlaceInfoRequested
}: PlaceSearchBarProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchError, setSearchError] = useState('');
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
        // Sanitize input
        const sanitizedText = sanitizeInput(text);

        // Validate search query
        if (sanitizedText) {
            const validation = validateSearchQuery(sanitizedText);
            if (!validation.isValid) {
                setSearchError(validation.message || '');
                setPredictions([]);
                setSearchQuery(sanitizedText);
                return;
            }
        }

        setSearchError('');
        setSearchQuery(sanitizedText);
        setIsLoading(true);
        debouncedSearch(sanitizedText);
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

    // Function to handle info button press
    const handleInfoPress = (placeId: string) => {
        onPlaceInfoRequested(placeId);
        // Keep the search results open
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
                            setSearchError('');
                        }}
                        style={styles.clearButton}
                    >
                        <Ionicons name="close" size={20} color={isDark ? colors.text : '#666'} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {searchError && (
                <View style={[styles.errorContainer, { backgroundColor }]}>
                    <Text style={styles.errorText}>{searchError}</Text>
                </View>
            )}

            {predictions.length > 0 && !searchError && (
                <FlatList
                    data={predictions}
                    keyExtractor={(item) => item.place_id}
                    style={[styles.predictionList, { backgroundColor }]}
                    renderItem={({ item }) => (
                        <View style={styles.predictionItem}>
                            <TouchableOpacity
                                style={styles.predictionContent}
                                onPress={() => handleSelectPlace(item)}
                            >
                                <Ionicons name="location" size={16} color="#F1B24A" style={styles.locationIcon} />
                                <View style={styles.predictionTextContainer}>
                                    <Text style={[styles.mainText, { color: textColor }]} numberOfLines={1}>
                                        {item.structured_formatting.main_text}
                                    </Text>
                                    <Text style={styles.secondaryText} numberOfLines={1}>
                                        {item.structured_formatting.secondary_text}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.infoButton}
                                onPress={() => handleInfoPress(item.place_id)}
                            >
                                <Ionicons name="information-circle" size={22} color="#F1B24A" />
                            </TouchableOpacity>
                        </View>
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
        maxHeight: 250,
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
        justifyContent: 'space-between',
    },
    predictionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    predictionTextContainer: {
        flex: 1,
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
    infoButton: {
        padding: 8,
        marginLeft: 8,
    },
    errorContainer: {
        marginTop: 5,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 14,
        textAlign: 'center',
    },
}); 