import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';
import DirectionCard from './DirectionCard';
import * as Location from 'expo-location';

interface DirectionStep {
    instructions: string;
    distance: string;
    duration: string;
    startLocation: { latitude: number; longitude: number };
    endLocation: { latitude: number; longitude: number };
}

interface DirectionsPanelProps {
    steps: DirectionStep[];
    visible: boolean;
    onClose: () => void;
    currentLocation: { latitude: number; longitude: number } | null;
}

export default function DirectionsPanel({
    steps,
    visible,
    onClose,
    currentLocation
}: DirectionsPanelProps) {
    const { isDark } = useTheme();
    const [activeStepIndex, setActiveStepIndex] = useState(0);

    // Find the closest step to the current location
    useEffect(() => {
        if (!currentLocation || !steps.length) return;

        // Calculate distances to start points of each step
        const distances = steps.map((step, index) => {
            const distance = calculateDistance(
                currentLocation.latitude,
                currentLocation.longitude,
                step.startLocation.latitude,
                step.startLocation.longitude
            );
            return { index, distance };
        });

        // Sort by distance and get the closest
        distances.sort((a, b) => a.distance - b.distance);

        // Only update if we're close to the next step
        const closestIndex = distances[0].index;
        if (closestIndex > activeStepIndex) {
            setActiveStepIndex(closestIndex);
        }
    }, [currentLocation, steps]);

    if (!visible || !steps.length) return null;

    // Only show the active step and the next one
    const currentStep = steps[activeStepIndex];
    const nextStep = activeStepIndex < steps.length - 1 ? steps[activeStepIndex + 1] : null;

    return (
        <View
            className={`absolute left-2.5 right-2.5 top-24 rounded-xl shadow-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            style={{ maxHeight: 300 }}
        >
            <View className="flex-row justify-between items-center p-4 border-b border-gray-700">
                <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    Directions
                </Text>
                <TouchableOpacity onPress={onClose}>
                    <Ionicons name="close" size={24} color={isDark ? "#ffffff" : "#333333"} />
                </TouchableOpacity>
            </View>

            <ScrollView className="p-2">
                <DirectionCard
                    instruction={currentStep.instructions}
                    distance={currentStep.distance}
                    duration={currentStep.duration}
                    stepIndex={activeStepIndex}
                    totalSteps={steps.length}
                />

                {nextStep && (
                    <View className={`items-center my-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <Ionicons name="arrow-down" size={20} color={isDark ? "#888888" : "#999999"} />
                        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Then</Text>
                    </View>
                )}

                {nextStep && (
                    <DirectionCard
                        instruction={nextStep.instructions}
                        distance={nextStep.distance}
                        duration={nextStep.duration}
                        stepIndex={activeStepIndex + 1}
                        totalSteps={steps.length}
                    />
                )}

                {activeStepIndex < steps.length - 2 && (
                    <View className="items-center mt-4">
                        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {steps.length - activeStepIndex - 2} more steps to destination
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
} 