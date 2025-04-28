import React from 'react';
import { View, Text, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocationContext } from '@/components/LocationProvider';
import { useTheme } from '@/stores/theme/useTheme';

export const LocationTrackingToggle = () => {
    const { isTrackingEnabled, isInitializing, toggleTracking } = useLocationContext();
    const { colors, isDark } = useTheme();

    const handleToggle = async () => {
        await toggleTracking();
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
            </View>

            {isInitializing ? (
                <ActivityIndicator size="small" color={colors.primary} />
            ) : (
                <Switch
                    trackColor={{ false: '#767577', true: '#F1B24A' }}
                    thumbColor={isTrackingEnabled ? '#ffffff' : '#f4f3f4'}
                    ios_backgroundColor="#3e3e3e"
                    onValueChange={handleToggle}
                    value={isTrackingEnabled}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 8,
        marginVertical: 8,
    },
    textContainer: {
        flex: 1,
        paddingRight: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
    },
}); 