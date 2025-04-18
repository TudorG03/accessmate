import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
    Alert,
    KeyboardAvoidingView,
    Image
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useMarker } from '@/stores/marker/hooks/useMarker';
import { Marker, ObstacleType } from '@/types/marker.types';
import { getObstacleEmoji } from '@/stores/marker/marker.utils';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';

interface AddMarkerModalProps {
    visible: boolean;
    onClose: () => void;
    editingMarker?: Marker | null;
}

const AddMarkerModal: React.FC<AddMarkerModalProps> = ({ visible, onClose, editingMarker }) => {
    const { createMarkerAtCurrentLocation, updateMarker, isLoading, error } = useMarker();
    const { colors, isDark } = useTheme();
    const isEditing = !!editingMarker;

    // Form state
    const [obstacleType, setObstacleType] = useState<ObstacleType>(ObstacleType.STAIRS);
    const [obstacleScore, setObstacleScore] = useState<number>(1);
    const [description, setDescription] = useState<string>('');
    const [images, setImages] = useState<string[]>([]);
    const [localError, setLocalError] = useState<string | null>(null);

    // Set form values when editing an existing marker
    useEffect(() => {
        if (editingMarker && visible) {
            setObstacleType(editingMarker.obstacleType as ObstacleType);
            setObstacleScore(editingMarker.obstacleScore);
            setDescription(editingMarker.description || '');
            setImages(editingMarker.images || []);
        } else if (!editingMarker && visible) {
            // Reset form when opening for a new marker
            resetForm();
        }
    }, [editingMarker, visible]);

    // Helper to get obstacle type options
    const obstacleOptions = Object.values(ObstacleType).map(type => ({
        value: type,
        label: type.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
        emoji: getObstacleEmoji(type)
    }));

    // Reset form state
    const resetForm = () => {
        setObstacleType(ObstacleType.STAIRS);
        setObstacleScore(1);
        setDescription('');
        setImages([]);
        setLocalError(null);
    };

    // Handle form submission
    const handleSubmit = async () => {
        try {
            setLocalError(null);

            let result: Marker | null = null;

            if (isEditing && editingMarker) {
                // Update existing marker
                result = await updateMarker(editingMarker.id, {
                    obstacleType,
                    obstacleScore,
                    description,
                    images
                });

                if (result) {
                    resetForm();
                    onClose();
                    Alert.alert('Success', 'Obstacle marker updated successfully!');
                } else {
                    setLocalError('Failed to update marker. Please try again.');
                }
            } else {
                // Create new marker
                result = await createMarkerAtCurrentLocation({
                    obstacleType,
                    obstacleScore,
                    description,
                    images
                });

                if (result) {
                    resetForm();
                    onClose();
                    Alert.alert('Success', 'Obstacle marker added successfully!');
                } else {
                    setLocalError('Failed to add marker. Please try again.');
                }
            }
        } catch (err) {
            setLocalError(err instanceof Error ? err.message : 'An unexpected error occurred');
        }
    };

    // Handle image picking
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please grant permission to access your photos');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedImage = result.assets[0];
                if (selectedImage.uri) {
                    // For simplicity, we're just storing the uri, but in a real app you'd upload this
                    // and store the returned URL
                    setImages([...images, selectedImage.uri]);
                }
            }
        } catch (err) {
            setLocalError('Error selecting image');
        }
    };

    // Remove selected image
    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    // Helper to get color based on score
    const getScoreColor = (score: number): string => {
        if (score <= 2) return 'bg-green-500'; // Low severity - green
        if (score <= 4) return 'bg-orange-500'; // Medium severity - orange
        return 'bg-red-500'; // High severity - red
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
                            {isEditing ? 'Edit Obstacle' : 'Add Accessibility Obstacle'}
                        </Text>
                        <TouchableOpacity className="p-[5px]" onPress={onClose}>
                            <Ionicons name="close" size={24} color={isDark ? colors.text : "#000"} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="max-h-[80%]">
                        {/* Obstacle Type Selector */}
                        <Text className={`text-base font-medium mt-[10px] mb-[5px] ${isDark ? 'text-white' : 'text-black'}`}>Obstacle Type</Text>
                        <View className={`border rounded-lg mb-[15px] ${isDark ? 'border-dark-border bg-dark-input' : 'border-gray-300 bg-white'}`}>
                            <Picker
                                selectedValue={obstacleType}
                                onValueChange={(value) => setObstacleType(value as ObstacleType)}
                                className="h-[50px]"
                                dropdownIconColor={isDark ? '#ffffff' : undefined}
                                style={{
                                    color: isDark ? '#ffffff' : '#000000',
                                    backgroundColor: isDark ? colors.input : undefined
                                }}
                                itemStyle={{
                                    color: isDark ? '#ffffff' : '#000000',
                                    backgroundColor: isDark ? colors.card : undefined
                                }}
                            >
                                {obstacleOptions.map((option) => (
                                    <Picker.Item
                                        key={option.value}
                                        label={`${option.emoji} ${option.label}`}
                                        value={option.value}
                                        color={'#000000'}
                                    />
                                ))}
                            </Picker>
                        </View>

                        {/* Severity Selector */}
                        <Text className={`text-base font-medium mt-[10px] mb-[5px] ${isDark ? 'text-white' : 'text-black'}`}>Severity (1-5)</Text>
                        <View className="flex-row justify-between mb-[15px]">
                            {[1, 2, 3, 4, 5].map((score) => (
                                <TouchableOpacity
                                    key={`severity-${score}`}
                                    className={`w-[40px] h-[40px] rounded-full justify-center items-center ${getScoreColor(score)} ${obstacleScore === score ? 'border-2 border-white' : ''}`}
                                    onPress={() => setObstacleScore(score)}
                                >
                                    <Text className="text-white font-bold">{score}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Description */}
                        <Text className={`text-base font-medium mt-[10px] mb-[5px] ${isDark ? 'text-white' : 'text-black'}`}>Description (Optional)</Text>
                        <TextInput
                            className={`border rounded-lg p-[10px] mb-[15px] min-h-[100px] text-top ${isDark ? 'border-dark-border bg-dark-input text-white' : 'border-gray-300 bg-white text-black'}`}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Describe the obstacle in detail..."
                            placeholderTextColor={isDark ? colors.secondaryText : '#888'}
                            multiline
                            numberOfLines={4}
                        />

                        {/* Image Selection */}
                        <Text className={`text-base font-medium mt-[10px] mb-[5px] ${isDark ? 'text-white' : 'text-black'}`}>Images (Optional)</Text>
                        <View className="flex-row flex-wrap mb-[15px]">
                            {images.map((uri, index) => (
                                <View key={`image-${index}-${uri.substring(uri.lastIndexOf('/') + 1, uri.length)}`} className="w-[100px] h-[100px] m-[5px] relative">
                                    <TouchableOpacity
                                        className="absolute top-[-5px] right-[-5px] z-10 bg-white rounded-full"
                                        onPress={() => removeImage(index)}
                                    >
                                        <Ionicons name="close-circle" size={20} color="red" />
                                    </TouchableOpacity>
                                    <View className={`w-full h-full border rounded-lg overflow-hidden ${isDark ? 'border-dark-border' : 'border-gray-300'}`}>
                                        <Image
                                            source={{ uri }}
                                            className="w-full h-full"
                                            resizeMode="cover"
                                        />
                                    </View>
                                </View>
                            ))}

                            <TouchableOpacity
                                className={`w-[100px] h-[100px] border border-dashed m-[5px] justify-center items-center rounded-lg ${isDark ? 'border-gray-500' : 'border-gray-300'}`}
                                onPress={pickImage}
                            >
                                <Ionicons name="camera" size={24} color={isDark ? colors.secondaryText : "#555"} />
                                <Text className={`mt-[5px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Add Image</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Error Display */}
                        {(localError || error) && (
                            <Text className="text-red-500 mb-[15px]">{localError || error}</Text>
                        )}
                    </ScrollView>

                    {/* Submit Button */}
                    <TouchableOpacity
                        className="bg-[#F1B24A] rounded-lg p-[15px] items-center mt-[10px]"
                        onPress={handleSubmit}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text className="text-white font-bold text-base">
                                {isEditing ? 'Save Changes' : 'Add Obstacle Marker'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default AddMarkerModal; 