import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    Alert,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ToastAndroid
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '@/stores/auth/hooks/useAuth';
import { useTheme } from '@/stores/theme/useTheme';

interface AccountInfoModalProps {
    visible: boolean;
    onClose: () => void;
}

const AccountInfoModal: React.FC<AccountInfoModalProps> = ({ visible, onClose }) => {
    const { user, updateUser, isLoading, error, clearError } = useAuth();
    const { colors, styles } = useTheme();

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        displayName: user?.displayName || '',
        password: '',
        retypePassword: '',
    });
    const [localLoading, setLocalLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showRetypePassword, setShowRetypePassword] = useState(false);

    // Update form data when user changes or modal opens
    useEffect(() => {
        if (visible && user) {
            setFormData({
                displayName: user.displayName || '',
                password: '',
                retypePassword: '',
            });
            setIsEditing(false);
            clearError();
        }
    }, [visible, user]);

    const handleSave = async () => {
        if (!user?.id) {
            Alert.alert('Error', 'User not found');
            return;
        }

        // Validate input
        if (!formData.displayName.trim()) {
            Alert.alert('Validation Error', 'Display name is required');
            return;
        }

        // If password is provided, validate it
        if (formData.password) {
            if (formData.password.length < 6) {
                Alert.alert('Validation Error', 'Password must be at least 6 characters long');
                return;
            }

            if (formData.password !== formData.retypePassword) {
                Alert.alert('Validation Error', 'Passwords do not match');
                return;
            }
        }

        try {
            setLocalLoading(true);
            const updateData: any = {
                displayName: formData.displayName.trim(),
            };

            // Only include password if it's being changed
            if (formData.password) {
                updateData.password = formData.password;
            }

            await updateUser(user.id, updateData);
            setIsEditing(false);
            setFormData(prev => ({ ...prev, password: '', retypePassword: '' }));

            const message = 'Your account information has been updated successfully';

            if (Platform.OS === "android") {
                ToastAndroid.show(message, ToastAndroid.SHORT);
            } else {
                Alert.alert('Success',);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update account information';
            Alert.alert('Update Error', errorMessage);
            console.error('Account update error:', err);
        } finally {
            setLocalLoading(false);
        }
    };

    const handleCancel = () => {
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                password: '',
                retypePassword: '',
            });
        }
        setIsEditing(false);
    };

    const handleClose = () => {
        if (isEditing) {
            Alert.alert(
                'Unsaved Changes',
                'You have unsaved changes. Are you sure you want to close?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Close',
                        style: 'destructive',
                        onPress: () => {
                            handleCancel();
                            onClose();
                        }
                    },
                ]
            );
        } else {
            onClose();
        }
    };

    const isProcessing = isLoading || localLoading;
    const hasChanges = formData.displayName !== user?.displayName || formData.password !== '';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <SafeAreaView style={[{ flex: 1 }, styles.background]}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header */}
                    <View
                        className="flex-row items-center justify-between p-4 border-b"
                        style={{ borderColor: colors.border }}
                    >
                        <Text className="text-lg font-semibold" style={styles.text}>
                            Account Information
                        </Text>
                        <TouchableOpacity onPress={handleClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 p-6">
                        {/* User Role Badge */}
                        <View className="mb-6">
                            <View
                                className="self-start px-3 py-1 rounded-full"
                                style={{ backgroundColor: colors.primary + '20' }}
                            >
                                <Text
                                    className="text-sm font-medium capitalize"
                                    style={{ color: colors.primary }}
                                >
                                    {user?.role || 'User'}
                                </Text>
                            </View>
                        </View>

                        {/* Form Fields */}
                        <View className="space-y-6">
                            {/* Email Field (Read-only) */}
                            <View className='my-10'>
                                <Text className="text-sm font-medium mb-2" style={styles.text}>
                                    Email Address
                                </Text>
                                <View
                                    className="border rounded-lg px-4 py-3"
                                    style={{
                                        borderColor: colors.border,
                                        backgroundColor: colors.surface
                                    }}
                                >
                                    <Text style={[styles.text, { fontSize: 16 }]}>
                                        {user?.email || 'No email provided'}
                                    </Text>
                                </View>
                            </View>

                            {/* Display Name Field */}
                            <View className='mb-10'>
                                <Text className="text-sm font-medium mb-2" style={styles.text}>
                                    Username
                                </Text>
                                <View
                                    className="border rounded-lg px-4 py-3"
                                    style={{
                                        borderColor: colors.border,
                                        backgroundColor: isEditing ? colors.background : colors.surface
                                    }}
                                >
                                    <TextInput
                                        value={formData.displayName}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, displayName: text }))}
                                        placeholder="Enter your username"
                                        placeholderTextColor={colors.secondaryText}
                                        style={[styles.text, { fontSize: 16 }]}
                                        editable={isEditing && !isProcessing}
                                        maxLength={50}
                                    />
                                </View>
                            </View>

                            {/* Password Field - Only show when editing */}
                            {isEditing && (
                                <View className='mb-10'>
                                    <Text className="text-sm font-medium mb-2" style={styles.text}>
                                        New Password (Optional)
                                    </Text>
                                    <View
                                        className="border rounded-lg px-4 py-3 flex-row items-center"
                                        style={{
                                            borderColor: colors.border,
                                            backgroundColor: colors.background
                                        }}
                                    >
                                        <TextInput
                                            value={formData.password}
                                            onChangeText={(text) => setFormData(prev => ({ ...prev, password: text }))}
                                            placeholder="Enter new password"
                                            placeholderTextColor={colors.secondaryText}
                                            style={[styles.text, { fontSize: 16, flex: 1 }]}
                                            secureTextEntry={!showPassword}
                                            editable={!isProcessing}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <TouchableOpacity
                                            onPress={() => setShowPassword(!showPassword)}
                                            className="ml-2"
                                        >
                                            <Ionicons
                                                name={showPassword ? "eye-off" : "eye"}
                                                size={20}
                                                color={colors.secondaryText}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    <Text className="text-xs mt-1" style={{ color: colors.secondaryText }}>
                                        Leave empty to keep current password
                                    </Text>
                                </View>
                            )}

                            {/* Retype Password Field - Only show when password is being changed */}
                            {isEditing && formData.password && (
                                <View>
                                    <Text className="text-sm font-medium mb-2" style={styles.text}>
                                        Retype New Password
                                    </Text>
                                    <View
                                        className="border rounded-lg px-4 py-3 flex-row items-center"
                                        style={{
                                            borderColor: colors.border,
                                            backgroundColor: colors.background
                                        }}
                                    >
                                        <TextInput
                                            value={formData.retypePassword}
                                            onChangeText={(text) => setFormData(prev => ({ ...prev, retypePassword: text }))}
                                            placeholder="Retype new password"
                                            placeholderTextColor={colors.secondaryText}
                                            style={[styles.text, { fontSize: 16, flex: 1 }]}
                                            secureTextEntry={!showRetypePassword}
                                            editable={!isProcessing}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <TouchableOpacity
                                            onPress={() => setShowRetypePassword(!showRetypePassword)}
                                            className="ml-2"
                                        >
                                            <Ionicons
                                                name={showRetypePassword ? "eye-off" : "eye"}
                                                size={20}
                                                color={colors.secondaryText}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    {formData.password && formData.retypePassword && formData.password !== formData.retypePassword && (
                                        <Text className="text-xs mt-1" style={{ color: '#EF4444' }}>
                                            Passwords do not match
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Member Since */}
                            {user?.createdAt && (
                                <View>
                                    <Text className="text-sm font-medium mb-2" style={styles.text}>
                                        Member Since
                                    </Text>
                                    <View
                                        className="border rounded-lg px-4 py-3"
                                        style={{
                                            borderColor: colors.border,
                                            backgroundColor: colors.surface
                                        }}
                                    >
                                        <Text style={styles.text}>
                                            {new Date(user.createdAt).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Error Display */}
                        {error && (
                            <View className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
                                <Text style={{ color: '#DC2626' }}>{error}</Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* Action Buttons */}
                    <View className="p-6 border-t" style={{ borderColor: colors.border }}>
                        {!isEditing ? (
                            <TouchableOpacity
                                className="py-4 rounded-lg flex-row justify-center items-center"
                                style={{ backgroundColor: colors.primary }}
                                onPress={() => setIsEditing(true)}
                                disabled={isProcessing}
                            >
                                <Ionicons name="pencil" size={16} color="white" style={{ marginRight: 8 }} />
                                <Text className="text-white font-semibold">Edit Information</Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="flex-row space-x-3">
                                <TouchableOpacity
                                    className="flex-1 py-4 rounded-lg border flex-row justify-center items-center"
                                    style={{ borderColor: colors.border, marginRight: 10 }}
                                    onPress={handleCancel}
                                    disabled={isProcessing}
                                >
                                    <Text style={[styles.text, { fontWeight: '500' }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="flex-1 py-4 rounded-lg flex-row justify-center items-center"
                                    style={{
                                        backgroundColor: hasChanges ? colors.primary : colors.border,
                                        opacity: isProcessing ? 0.7 : 1
                                    }}
                                    onPress={handleSave}
                                    disabled={!hasChanges || isProcessing}
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark" size={16} color="white" style={{ marginRight: 8 }} />
                                            <Text className="text-white font-semibold">Save Changes</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

export default AccountInfoModal; 