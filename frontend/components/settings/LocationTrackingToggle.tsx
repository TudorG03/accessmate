import React from 'react';
import { View, Text, Switch, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocation } from '@/stores/location/hooks/useLocation';
import { useTheme } from '@/stores/theme/useTheme';

export const LocationTrackingToggle = () => {
    const { isTrackingEnabled, isInitializing, toggleTracking, retryTracking } = useLocation();
    const { colors, isDark } = useTheme();

    const handleToggle = async () => {
        await toggleTracking();
    };

    const handleRetry = async () => {
        await retryTracking();
    };

    return (
        <View style={[
            styles.container,
            { backgroundColor: isDark ? colors.card : '#f8f8f8' }
        ]}>
            <View style={styles.textContainer}>
                <Text style={[
                    styles.title,
                    { color: isDark ? '#ffffff' : '#000000' }
                ]}>
                    Location Tracking
                </Text>
                <Text style={[
                    styles.description,
                    { color: isDark ? colors.secondaryText : '#666666' }
                ]}>
                    Get notified about nearby accessibility obstacles
                </Text>
                {!isTrackingEnabled && !isInitializing && (
                    <Text style={[
                        styles.statusText,
                        { color: '#ff9800' }
                    ]}>
                        Tracking is currently disabled
                    </Text>
                )}
            </View>

            <View style={styles.controlsContainer}>
                {isInitializing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                    <>
                        <Switch
                            trackColor={{ false: '#767577', true: '#F1B24A' }}
                            thumbColor={isTrackingEnabled ? '#ffffff' : '#f4f3f4'}
                            ios_backgroundColor="#3e3e3e"
                            onValueChange={handleToggle}
                            value={isTrackingEnabled}
                        />
                        {!isTrackingEnabled && (
                            <TouchableOpacity
                                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                                onPress={handleRetry}
                            >
                                <Text style={styles.retryButtonText}>Retry</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        marginVertical: 8,
    },
    textContainer: {
        flex: 1,
        marginRight: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    retryButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 8,
    },
    retryButtonText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
    },
}); 