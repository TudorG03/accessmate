import React from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Animated,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';

interface ObstacleValidationModalProps {
    visible: boolean;
    onClose: () => void;
    obstacleType: string;
    markerCount: number;
    timeAgo?: string;
    onValidate: (stillExists: boolean | null) => void;
}

const ObstacleValidationModal: React.FC<ObstacleValidationModalProps> = ({
    visible,
    onClose,
    obstacleType,
    markerCount,
    timeAgo,
    onValidate,
}) => {
    const { colors, isDark } = useTheme();
    const { height } = useWindowDimensions();

    // Format the obstacle type name for display
    const obstacleTypeName = obstacleType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

    // Get emoji based on obstacle type
    const getObstacleEmoji = (type: string) => {
        switch (type.toLowerCase()) {
            case 'construction':
            case 'construction_work':
                return '🚧';
            case 'road_damage':
            case 'pothole':
                return '🕳️';
            case 'blocked_path':
            case 'barrier':
                return '🚫';
            case 'debris':
                return '🗑️';
            case 'flood':
            case 'water':
                return '🌊';
            case 'ice':
            case 'snow':
                return '❄️';
            case 'tree':
            case 'fallen_tree':
                return '🌳';
            case 'vehicle':
            case 'parked_car':
                return '🚗';
            default:
                return '⚠️';
        }
    };

    const emoji = getObstacleEmoji(obstacleType);

    const handleValidation = (response: boolean | null) => {
        onValidate(response);
        onClose();
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center bg-black bg-opacity-50 px-6">
                <Animated.View
                    className={`w-full max-w-sm rounded-3xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'
                        }`}
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8,
                    }}
                >
                    {/* Header */}
                    <View className="items-center mb-6">
                        <View className="w-16 h-16 rounded-full bg-orange-100 items-center justify-center mb-4">
                            <Text className="text-3xl">{emoji}</Text>
                        </View>

                        <Text className={`text-2xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-800'
                            }`}>
                            Validate Obstacle
                        </Text>

                        <Text className={`text-base text-center ${isDark ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                            Help us keep accessibility data accurate
                        </Text>
                    </View>

                    {/* Content */}
                    <View className="mb-6">
                        <Text className={`text-lg font-semibold text-center mb-3 ${isDark ? 'text-white' : 'text-gray-800'
                            }`}>
                            {obstacleTypeName}
                        </Text>

                        <Text className={`text-base text-center leading-6 ${isDark ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                            We detected {markerCount === 1 ? 'a' : markerCount} {obstacleTypeName.toLowerCase()}
                            {markerCount > 1 ? ' obstacles' : ' obstacle'} near your location
                            {timeAgo ? ` ${timeAgo}` : ''}.
                            {'\n\n'}
                            {markerCount === 1 ? 'Is this obstacle still there?' : 'Are these obstacles still there?'}
                        </Text>
                    </View>

                    {/* Action Buttons */}
                    <View className="space-y-3">
                        {/* Yes Button */}
                        <TouchableOpacity
                            onPress={() => handleValidation(true)}
                            className="bg-green-500 rounded-2xl py-4 px-6 flex-row items-center justify-center"
                            style={{
                                shadowColor: '#22c55e',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 4,
                                elevation: 4,
                                marginBottom: 10
                            }}
                        >
                            <Ionicons name="checkmark-circle" size={24} color="white" />
                            <Text className="text-white font-bold text-lg ml-2">
                                Yes, still there
                            </Text>
                        </TouchableOpacity>

                        {/* No Button */}
                        <TouchableOpacity
                            onPress={() => handleValidation(false)}
                            className="bg-red-500 rounded-2xl py-4 px-6 flex-row items-center justify-center"
                            style={{
                                shadowColor: '#ef4444',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 4,
                                elevation: 4,
                                marginBottom: 10
                            }}
                        >
                            <Ionicons name="close-circle" size={24} color="white" />
                            <Text className="text-white font-bold text-lg ml-2">
                                No, it's gone
                            </Text>
                        </TouchableOpacity>

                        {/* Not Sure Button */}
                        <TouchableOpacity
                            onPress={() => handleValidation(null)}
                            className={`border-2 rounded-2xl py-4 px-6 flex-row items-center justify-center ${isDark
                                    ? 'border-gray-600 bg-gray-700'
                                    : 'border-gray-300 bg-gray-50'
                                }`}
                        >
                            <Ionicons
                                name="help-circle"
                                size={24}
                                color={isDark ? '#9ca3af' : '#6b7280'}
                            />
                            <Text className={`font-semibold text-lg ml-2 ${isDark ? 'text-gray-300' : 'text-gray-600'
                                }`}>
                                Not sure
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Close Button */}
                    <TouchableOpacity
                        onPress={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-200 items-center justify-center"
                    >
                        <Ionicons
                            name="close"
                            size={18}
                            color={isDark ? '#374151' : '#6b7280'}
                        />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

export default ObstacleValidationModal; 