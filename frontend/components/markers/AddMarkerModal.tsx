import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
    Alert,
    KeyboardAvoidingView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useMarker } from '@/stores/marker/hooks/useMarker';
import { ObstacleType } from '@/types/marker.types';
import { getObstacleEmoji } from '@/stores/marker/marker.utils';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface AddMarkerModalProps {
    visible: boolean;
    onClose: () => void;
}

const AddMarkerModal: React.FC<AddMarkerModalProps> = ({ visible, onClose }) => {
    const { createMarkerAtCurrentLocation, isLoading, error } = useMarker();

    // Form state
    const [obstacleType, setObstacleType] = useState<ObstacleType>(ObstacleType.STAIRS);
    const [obstacleScore, setObstacleScore] = useState<number>(1);
    const [description, setDescription] = useState<string>('');
    const [images, setImages] = useState<string[]>([]);
    const [localError, setLocalError] = useState<string | null>(null);

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

            if (!description.trim()) {
                setLocalError('Please provide a description of the obstacle');
                return;
            }

            const marker = await createMarkerAtCurrentLocation({
                obstacleType,
                obstacleScore,
                description,
                images
            });

            if (marker) {
                resetForm();
                onClose();
                Alert.alert('Success', 'Obstacle marker added successfully!');
            } else {
                setLocalError('Failed to add marker. Please try again.');
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

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.centeredView}
            >
                <View style={styles.modalView}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Add Accessibility Obstacle</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.formContainer}>
                        {/* Obstacle Type Selector */}
                        <Text style={styles.label}>Obstacle Type</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={obstacleType}
                                onValueChange={(value) => setObstacleType(value as ObstacleType)}
                                style={styles.picker}
                            >
                                {obstacleOptions.map((option) => (
                                    <Picker.Item
                                        key={option.value}
                                        label={`${option.emoji} ${option.label}`}
                                        value={option.value}
                                    />
                                ))}
                            </Picker>
                        </View>

                        {/* Severity Selector */}
                        <Text style={styles.label}>Severity (1-5)</Text>
                        <View style={styles.severityContainer}>
                            {[1, 2, 3, 4, 5].map((score) => (
                                <TouchableOpacity
                                    key={score}
                                    style={[
                                        styles.severityButton,
                                        obstacleScore === score && styles.selectedSeverity,
                                        { backgroundColor: getScoreColor(score) }
                                    ]}
                                    onPress={() => setObstacleScore(score)}
                                >
                                    <Text style={styles.severityText}>{score}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Description */}
                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={styles.input}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Describe the obstacle in detail..."
                            multiline
                            numberOfLines={4}
                        />

                        {/* Image Selection */}
                        <Text style={styles.label}>Images (Optional)</Text>
                        <View style={styles.imageContainer}>
                            {images.map((uri, index) => (
                                <View key={index} style={styles.imagePreview}>
                                    <TouchableOpacity
                                        style={styles.removeImage}
                                        onPress={() => removeImage(index)}
                                    >
                                        <Ionicons name="close-circle" size={20} color="red" />
                                    </TouchableOpacity>
                                    <View style={styles.imageWrapper}>
                                        {/* You would use an Image component here in a real app */}
                                        <View style={styles.imagePlaceholder}>
                                            <Text style={styles.imageText}>Image {index + 1}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}

                            <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                                <Ionicons name="camera" size={24} color="#555" />
                                <Text style={styles.addImageText}>Add Image</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Error Display */}
                        {(localError || error) && (
                            <Text style={styles.errorText}>{localError || error}</Text>
                        )}
                    </ScrollView>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={styles.submitButton}
                        onPress={handleSubmit}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.submitText}>Add Obstacle Marker</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// Helper to get color based on score
const getScoreColor = (score: number): string => {
    if (score <= 2) return '#4caf50'; // Low severity - green
    if (score <= 4) return '#ff9800'; // Medium severity - orange
    return '#f44336'; // High severity - red
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
    },
    modalView: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 5,
    },
    formContainer: {
        maxHeight: '80%',
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
        fontWeight: '500',
        marginTop: 10,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginBottom: 15,
    },
    picker: {
        height: 50,
    },
    severityContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    severityButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ddd',
    },
    selectedSeverity: {
        borderWidth: 2,
        borderColor: '#000',
    },
    severityText: {
        color: 'white',
        fontWeight: 'bold',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        marginBottom: 15,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    imageContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 15,
    },
    imagePreview: {
        width: 100,
        height: 100,
        margin: 5,
        position: 'relative',
    },
    removeImage: {
        position: 'absolute',
        top: -5,
        right: -5,
        zIndex: 1,
        backgroundColor: 'white',
        borderRadius: 10,
    },
    imageWrapper: {
        width: '100%',
        height: '100%',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        overflow: 'hidden',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageText: {
        color: '#555',
    },
    addImageButton: {
        width: 100,
        height: 100,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        borderStyle: 'dashed',
        margin: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addImageText: {
        marginTop: 5,
        color: '#555',
    },
    errorText: {
        color: 'red',
        marginBottom: 15,
    },
    submitButton: {
        backgroundColor: '#F1B24A',
        borderRadius: 8,
        padding: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    submitText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default AddMarkerModal; 