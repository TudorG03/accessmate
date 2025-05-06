import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';
import useAuth from '@/stores/auth/hooks/useAuth';
import { formatDistance } from '@/utils/distanceUtils';

interface DirectionCardProps {
    instruction: string;
    distance: string;
    duration: string;
    stepIndex: number;
    totalSteps: number;
    isActive?: boolean;
}

export default function DirectionCard({
    instruction,
    distance,
    duration,
    stepIndex,
    totalSteps,
    isActive = false
}: DirectionCardProps) {
    const { isDark } = useTheme();
    const { user } = useAuth();

    // Helper function to convert distance string to kilometers number
    const parseDistance = (distanceStr: string): number => {
        try {
            // Extract numeric part and convert to number
            const match = distanceStr.match(/(\d+(\.\d+)?)/);
            if (match) {
                const value = parseFloat(match[0]);
                // Convert to kilometers if in miles (Google returns miles in US regions)
                if (distanceStr.toLowerCase().includes('mi')) {
                    return value * 1.60934; // miles to km
                }
                // Already in kilometers
                if (distanceStr.toLowerCase().includes('km')) {
                    return value;
                }
                // Convert feet to kilometers
                if (distanceStr.toLowerCase().includes('ft')) {
                    return value * 0.3048 / 1000; // feet to km
                }
                // Convert to kilometers if in meters
                if (distanceStr.toLowerCase().includes('m') && !distanceStr.toLowerCase().includes('km')) {
                    return value / 1000; // meters to km
                }
                // Default: assume meters
                return value / 1000;
            }
        } catch (error) {
            console.error('Error parsing distance', error);
        }
        return 0;
    };

    // Clean up the HTML instruction
    const cleanInstruction = instruction
        .replace(/<div.*?>/g, '')
        .replace(/<\/div>/g, '')
        .replace(/<b>/g, '')
        .replace(/<\/b>/g, '');

    // Format distance according to user preference
    const parsedDistance = parseDistance(distance);
    const formattedDistance = formatDistance(parsedDistance, user?.preferences?.preferedUnit);

    // Helper function to determine which icon to use based on instruction text
    const getDirectionIcon = (instruction: string) => {
        const lowerInst = instruction.toLowerCase();

        if (lowerInst.includes('right')) return 'arrow-forward';
        if (lowerInst.includes('left')) return 'arrow-back';
        if (lowerInst.includes('u-turn')) return 'refresh';
        if (lowerInst.includes('continue') || lowerInst.includes('head')) return 'arrow-up';
        if (lowerInst.includes('destination') || lowerInst.includes('arrive')) return 'flag';

        // Default
        return 'navigate';
    };

    return (
        <View className={`rounded-xl p-4 shadow-md mb-2 ${isActive
            ? (isDark
                ? 'bg-[#F1B24A] border-2 border-yellow-100'
                : 'bg-yellow-100 border-2 border-yellow-400')
            : isDark
                ? 'bg-gray-800'
                : 'bg-white'
            }`}>
            <View className="flex-row items-center">
                <View className={`w-12 h-12 rounded-full items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <Ionicons
                        name={getDirectionIcon(instruction)}
                        size={24}
                        color="#F1B24A"
                    />
                </View>
                <View className="flex-1 ml-4">
                    <View className="flex-row justify-between items-center mb-1">
                        <Text className={`text-xs ${isDark ? 'text-gray-800' : 'text-gray-600'}`}>
                            Step {stepIndex + 1} of {totalSteps}
                        </Text>
                        <Text className={`text-xs font-medium ${isActive
                            ? isDark
                                ? 'text-white font-bold'
                                : 'text-yellow-800 font-bold'
                            : isDark
                                ? 'text-gray-300'
                                : 'text-gray-600'
                            }`}>
                            {formattedDistance} • {duration}
                        </Text>
                    </View>
                    <Text className={isActive
                        ? isDark
                            ? 'font-bold text-white'
                            : 'font-bold text-yellow-900'
                        : isDark
                            ? 'text-white'
                            : 'text-gray-800'}>
                        {cleanInstruction}
                    </Text>
                </View>
            </View>
        </View>
    );
} 