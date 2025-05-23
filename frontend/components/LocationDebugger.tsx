import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useLocationStore } from '@/stores/location/location.store';
import { useTheme } from '@/stores/theme/useTheme';
import { getCurrentLocation } from '@/services/location.service';

export const LocationDebugger: React.FC = () => {
    const {
        currentLocation,
        lastLocationUpdateTime,
        getLastKnownLocation,
        getPersistedLocation,
        hasValidPersistedLocation,
        setCurrentLocation,
        clearPersistedLocation
    } = useLocationStore();

    const { colors, isDark } = useTheme();

    const handleGetCurrentLocation = async () => {
        try {
            const location = await getCurrentLocation();
            if (location) {
                Alert.alert('Success', `Got location: ${location.coords.latitude}, ${location.coords.longitude}`);
            } else {
                Alert.alert('Error', 'Could not get location');
            }
        } catch (error) {
            Alert.alert('Error', `Failed to get location: ${error}`);
        }
    };

    const handleSetTestLocation = () => {
        const testLocation = {
            latitude: 37.7749, // San Francisco
            longitude: -122.4194
        };
        setCurrentLocation(testLocation);
        Alert.alert('Test Location Set', `Set location to: ${testLocation.latitude}, ${testLocation.longitude}`);
    };

    const handleClearLocation = () => {
        clearPersistedLocation();
        Alert.alert('Location Cleared', 'Persisted location has been cleared');
    };

    const handleCheckPersistence = () => {
        const hasValid = hasValidPersistedLocation();
        const persisted = getPersistedLocation();
        const lastKnown = getLastKnownLocation();

        Alert.alert('Location Status',
            `Has Valid Persisted: ${hasValid}\n` +
            `Persisted Location: ${persisted ? `${persisted.latitude}, ${persisted.longitude}` : 'None'}\n` +
            `Last Known: ${lastKnown.latitude}, ${lastKnown.longitude}\n` +
            `Current Location: ${currentLocation ? `${currentLocation.latitude}, ${currentLocation.longitude}` : 'None'}`
        );
    };

    return (
        <View style={{ padding: 16, backgroundColor: colors.card, margin: 16, borderRadius: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: colors.text }}>
                Location Debugger
            </Text>

            <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.text, marginBottom: 8 }}>
                    Current Location: {currentLocation ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}` : 'None'}
                </Text>
                <Text style={{ color: colors.text, marginBottom: 8 }}>
                    Last Update: {lastLocationUpdateTime ? new Date(lastLocationUpdateTime).toLocaleString() : 'Never'}
                </Text>
                <Text style={{ color: colors.text, marginBottom: 8 }}>
                    Has Valid Persisted: {hasValidPersistedLocation() ? 'Yes' : 'No'}
                </Text>
            </View>

            <TouchableOpacity
                style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 6, marginBottom: 8 }}
                onPress={handleGetCurrentLocation}
            >
                <Text style={{ color: 'white', textAlign: 'center' }}>Get Current Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={{ backgroundColor: '#34C759', padding: 12, borderRadius: 6, marginBottom: 8 }}
                onPress={handleSetTestLocation}
            >
                <Text style={{ color: 'white', textAlign: 'center' }}>Set Test Location (SF)</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={{ backgroundColor: '#FF9500', padding: 12, borderRadius: 6, marginBottom: 8 }}
                onPress={handleCheckPersistence}
            >
                <Text style={{ color: 'white', textAlign: 'center' }}>Check Persistence Status</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={{ backgroundColor: '#FF3B30', padding: 12, borderRadius: 6 }}
                onPress={handleClearLocation}
            >
                <Text style={{ color: 'white', textAlign: 'center' }}>Clear Persisted Location</Text>
            </TouchableOpacity>
        </View>
    );
}; 