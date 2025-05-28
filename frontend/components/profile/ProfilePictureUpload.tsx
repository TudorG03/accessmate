import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import useProfilePicture from '@/stores/auth/hooks/useProfilePicture';
import { useTheme } from '@/stores/theme/useTheme';
import { validateProfilePicture, createProfilePictureDataUrl } from '@/utils/profilePicture.utils';

interface ProfilePictureUploadProps {
    size?: number;
    showUploadButton?: boolean;
    showDeleteButton?: boolean;
    onUploadSuccess?: () => void;
    onDeleteSuccess?: () => void;
    onError?: (error: string) => void;
}

const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
    size = 120,
    showUploadButton = true,
    showDeleteButton = true,
    onUploadSuccess,
    onDeleteSuccess,
    onError,
}) => {
    const { isDark } = useTheme();
    const {
        user,
        profilePicture,
        hasProfilePicture,
        uploadPicture,
        deletePicture,
        isLoading,
        error,
    } = useProfilePicture();

    const [localLoading, setLocalLoading] = useState(false);

    const colors = {
        primary: isDark ? '#007AFF' : '#007AFF',
        background: isDark ? '#1C1C1E' : '#FFFFFF',
        surface: isDark ? '#2C2C2E' : '#F2F2F7',
        text: isDark ? '#FFFFFF' : '#000000',
        secondaryText: isDark ? '#8E8E93' : '#6D6D80',
        border: isDark ? '#38383A' : '#C6C6C8',
        danger: '#FF3B30',
    };

    const pickImage = async () => {
        try {
            setLocalLoading(true);

            // Request permissions
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Required',
                    'Please grant permission to access your photos to upload a profile picture.'
                );
                return;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedImage = result.assets[0];

                if (selectedImage.base64) {
                    const dataUrl = createProfilePictureDataUrl(selectedImage.base64);

                    // Validate the image
                    const validation = validateProfilePicture(dataUrl);
                    if (!validation.isValid) {
                        Alert.alert('Invalid Image', validation.message || 'Please select a valid image');
                        onError?.(validation.message || 'Invalid image');
                        return;
                    }

                    // Upload the image
                    await uploadPicture(dataUrl);
                    onUploadSuccess?.();
                } else {
                    throw new Error('Failed to process the selected image');
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to upload profile picture';
            Alert.alert('Upload Error', errorMessage);
            onError?.(errorMessage);
            console.error('Profile picture upload error:', err);
        } finally {
            setLocalLoading(false);
        }
    };

    const handleDeletePicture = () => {
        Alert.alert(
            'Delete Profile Picture',
            'Are you sure you want to delete your profile picture?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLocalLoading(true);
                            await deletePicture();
                            onDeleteSuccess?.();
                        } catch (err) {
                            const errorMessage = err instanceof Error ? err.message : 'Failed to delete profile picture';
                            Alert.alert('Delete Error', errorMessage);
                            onError?.(errorMessage);
                            console.error('Profile picture delete error:', err);
                        } finally {
                            setLocalLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const isProcessing = isLoading || localLoading;

    return (
        <View style={styles.container}>
            {/* Profile Picture Display */}
            <View style={[styles.pictureContainer, { width: size, height: size }]}>
                {hasProfilePicture && profilePicture ? (
                    <Image
                        source={{ uri: profilePicture }}
                        style={[styles.profileImage, { width: size, height: size }]}
                        resizeMode="cover"
                    />
                ) : (
                    <View
                        style={[
                            styles.placeholderContainer,
                            {
                                width: size,
                                height: size,
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <Ionicons
                            name="person"
                            size={size * 0.4}
                            color={colors.secondaryText}
                        />
                    </View>
                )}

                {/* Loading Overlay */}
                {isProcessing && (
                    <View style={[styles.loadingOverlay, { width: size, height: size }]}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                )}
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonsContainer}>
                {showUploadButton && (
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.primary }]}
                        onPress={pickImage}
                        disabled={isProcessing}
                    >
                        <Ionicons name="camera" size={16} color="white" />
                        <Text style={styles.buttonText}>
                            {hasProfilePicture ? 'Change' : 'Upload'}
                        </Text>
                    </TouchableOpacity>
                )}

                {showDeleteButton && hasProfilePicture && (
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.danger }]}
                        onPress={handleDeletePicture}
                        disabled={isProcessing}
                    >
                        <Ionicons name="trash" size={16} color="white" />
                        <Text style={styles.buttonText}>Delete</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Error Display */}
            {error && (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                    {error}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    pictureContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    profileImage: {
        borderRadius: 60,
    },
    placeholderContainer: {
        borderRadius: 60,
        borderWidth: 2,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        borderRadius: 60,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 8,
    },
    buttonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    errorText: {
        marginTop: 8,
        fontSize: 12,
        textAlign: 'center',
    },
});

export default ProfilePictureUpload; 