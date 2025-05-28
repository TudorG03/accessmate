import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';
import { Marker } from '@/types/marker.types';
import { getObstacleEmoji } from '@/stores/marker/marker.utils';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import { getAuthHeader } from '@/stores/auth/auth.utils';
import { ImageWithFallback } from '@/components/ImageWithFallback';

interface MarkerDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    marker: Marker | null;
}

const MarkerDetailsModal: React.FC<MarkerDetailsModalProps> = ({ visible, onClose, marker }) => {
    const { colors, isDark } = useTheme();
    const [creatorName, setCreatorName] = useState<string>('');
    const [isLoadingUser, setIsLoadingUser] = useState(false);

    useEffect(() => {
        if (marker && visible) {
            fetchCreatorInfo();
        }
    }, [marker, visible]);

    const fetchCreatorInfo = async () => {
        if (!marker) return;

        try {
            setIsLoadingUser(true);
            const headers = await getAuthHeader();
            const response = await axios.get(`${API_URL}/auth/user/${marker.userId}`, { headers });

            if (response.data && response.data.user) {
                setCreatorName(response.data.user.displayName || 'Unknown User');
            } else {
                setCreatorName('Unknown User');
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
            setCreatorName('Unknown User');
        } finally {
            setIsLoadingUser(false);
        }
    };

    if (!marker) return null;

    // Format the obstacle type for display
    const obstacleTypeFormatted = marker.obstacleType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());

    // Get emoji for the obstacle type
    const emoji = getObstacleEmoji(marker.obstacleType);

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    // Get severity level text
    const getSeverityText = (score: number) => {
        if (score >= 4) return 'High';
        if (score >= 2) return 'Medium';
        return 'Low';
    };

    // Get severity color
    const getSeverityColor = (score: number) => {
        if (score >= 4) return 'text-red-500';
        if (score >= 2) return 'text-orange-500';
        return 'text-green-500';
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-end bg-black bg-opacity-50"
            >
                <View className={`p-5 max-h-[90%] rounded-t-[20px] ${isDark ? 'bg-dark-card' : 'bg-white'}`}>
                    <View className={`flex-row justify-between items-center mb-5 pb-[10px] border-b ${isDark ? 'border-dark-border' : 'border-gray-200'}`}>
                        <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                            {emoji} {obstacleTypeFormatted}
                        </Text>
                        <TouchableOpacity className="p-[5px]" onPress={onClose}>
                            <Ionicons name="close" size={24} color={isDark ? colors.text : "#000"} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="max-h-[80%]">
                        {/* Severity */}
                        <View className="mb-4">
                            <Text className={`text-base font-medium mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                                Severity
                            </Text>
                            <View className="flex-row items-center">
                                <Text className={`font-bold text-base ${getSeverityColor(marker.obstacleScore)}`}>
                                    {getSeverityText(marker.obstacleScore)} ({marker.obstacleScore}/5)
                                </Text>
                            </View>
                        </View>

                        {/* Creator */}
                        <View className="mb-4">
                            <Text className={`text-base font-medium mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                                Creator
                            </Text>
                            {isLoadingUser ? (
                                <ActivityIndicator size="small" color={isDark ? '#F1B24A' : '#F1B24A'} />
                            ) : (
                                <View className="flex-row items-center">
                                    <Ionicons name="person" size={16} color={isDark ? '#F1B24A' : '#F1B24A'} />
                                    <Text className={`ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {creatorName}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Description */}
                        <View className="mb-4">
                            <Text className={`text-base font-medium mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                                Description
                            </Text>
                            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {marker.description || 'No description provided'}
                            </Text>
                        </View>

                        {/* Images */}
                        {marker.images && marker.images.length > 0 && (
                            <View className="mb-4">
                                <Text className={`text-base font-medium mb-2 ${isDark ? 'text-white' : 'text-black'}`}>
                                    Images
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {marker.images.map((imageUri, index) => (
                                        <View
                                            key={index}
                                            className={`mr-2 rounded-lg overflow-hidden border ${isDark ? 'border-dark-border' : 'border-gray-300'}`}
                                        >
                                            <ImageWithFallback
                                                uri={imageUri}
                                                style={{ width: 150, height: 150 }}
                                                resizeMode="cover"
                                                onError={(error) => {
                                                    console.log(`🖼️ Marker image load error:`, error);
                                                    console.log(`🖼️ Failed marker image URI: ${imageUri}`);
                                                    console.log(`🖼️ Image URI type: ${imageUri?.startsWith('data:') ? 'base64' : imageUri?.startsWith('file:') ? 'file' : imageUri?.startsWith('http') ? 'url' : 'unknown'}`);
                                                    console.log(`🖼️ Image URI length: ${imageUri?.length || 0}`);
                                                }}
                                                onLoad={() => {
                                                    console.log(`🖼️ Marker image loaded successfully: ${imageUri.substring(0, 50)}...`);
                                                }}
                                            />
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Location Info */}
                        <View className="mb-4">
                            <Text className={`text-base font-medium mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                                Location
                            </Text>
                            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Latitude: {marker.location.latitude.toFixed(6)}
                            </Text>
                            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Longitude: {marker.location.longitude.toFixed(6)}
                            </Text>
                        </View>

                        {/* Date Information */}
                        <View className="mb-2">
                            <Text className={`text-base font-medium mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                                Date Added
                            </Text>
                            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {formatDate(marker.createdAt)}
                            </Text>
                        </View>

                        {marker.createdAt !== marker.updatedAt && (
                            <View className="mb-2">
                                <Text className={`text-base font-medium mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                                    Last Updated
                                </Text>
                                <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {formatDate(marker.updatedAt)}
                                </Text>
                            </View>
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        className="bg-[#F1B24A] rounded-lg p-[15px] items-center mt-[10px]"
                        onPress={onClose}
                    >
                        <Text className="text-white font-bold text-base">Close</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default MarkerDetailsModal; 