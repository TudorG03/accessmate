import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { AdminService, CreateUserRequest, UpdateUserRequest } from '@/services/admin.service';
import { User, UserRole } from '@/types/auth.types';
import { validateEmail, validatePassword, validateDisplayName, sanitizeInput } from '@/utils/validation.utils';

interface UserFormProps {
  user?: User | null; // If provided, this is edit mode
  onSuccess?: (user: User) => void;
  onCancel?: () => void;
}

export const UserFormComponent: React.FC<UserFormProps> = ({
  user,
  onSuccess,
  onCancel,
}) => {
  const isEditMode = !!user;

  const [formData, setFormData] = useState({
    email: user?.email || '',
    password: '',
    displayName: user?.displayName || '',
    role: user?.role || UserRole.USER,
    isActive: user?.isActive ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when user prop changes
  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        password: '',
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
      });
    }
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.message || '';
    }

    // Password validation (required for create, optional for edit)
    if (!isEditMode && !formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password) {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        newErrors.password = passwordValidation.message || '';
      }
    }

    // Display name validation
    const displayNameValidation = validateDisplayName(formData.displayName);
    if (!displayNameValidation.isValid) {
      newErrors.displayName = displayNameValidation.message || '';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      let response;

      if (isEditMode && user) {
        // Update existing user
        const updateData: UpdateUserRequest = {
          email: formData.email,
          displayName: formData.displayName,
          role: formData.role,
          isActive: formData.isActive,
        };

        // Only include password if it's provided
        if (formData.password) {
          updateData.password = formData.password;
        }

        response = await AdminService.updateUser(user.id, updateData);
      } else {
        // Create new user
        const createData: CreateUserRequest = {
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
          role: formData.role,
        };

        response = await AdminService.createUser(createData);
      }

      Alert.alert(
        'Success',
        `User ${isEditMode ? 'updated' : 'created'} successfully`,
        [{ text: 'OK', onPress: () => onSuccess?.(response.user) }]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || `Failed to ${isEditMode ? 'update' : 'create'} user`
      );
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    // Sanitize text inputs
    const sanitizedValue = typeof value === 'string' ? sanitizeInput(value) : value;
    setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const renderRolePicker = () => (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-2">Role</Text>
      <View className="flex-row flex-wrap">
        {Object.values(UserRole).map((role) => (
          <TouchableOpacity
            key={role}
            className={`mr-2 mb-2 px-4 py-2 rounded-full border ${formData.role === role
              ? 'bg-blue-500 border-blue-500'
              : 'bg-white border-gray-300'
              }`}
            onPress={() => updateFormData('role', role)}
          >
            <Text
              className={`text-sm font-medium ${formData.role === role ? 'text-white' : 'text-gray-700'
                }`}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <View className="bg-white rounded-lg shadow-sm p-6">
          <Text className="text-xl font-bold text-gray-900 mb-6">
            {isEditMode ? 'Edit User' : 'Create New User'}
          </Text>

          {/* Email Field */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Email *
            </Text>
            <TextInput
              className={`border rounded-lg px-4 py-3 text-gray-900 ${errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder="Enter email address"
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {errors.email && (
              <Text className="text-red-500 text-xs mt-1">{errors.email}</Text>
            )}
          </View>

          {/* Display Name Field */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Display Name *
            </Text>
            <TextInput
              className={`border rounded-lg px-4 py-3 text-gray-900 ${errors.displayName ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder="Enter display name"
              value={formData.displayName}
              onChangeText={(value) => updateFormData('displayName', value)}
              editable={!loading}
            />
            {errors.displayName && (
              <Text className="text-red-500 text-xs mt-1">{errors.displayName}</Text>
            )}
          </View>

          {/* Password Field */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Password {isEditMode ? '(leave blank to keep current)' : '*'}
            </Text>
            <TextInput
              className={`border rounded-lg px-4 py-3 text-gray-900 ${errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder={isEditMode ? 'Enter new password' : 'Enter password'}
              value={formData.password}
              onChangeText={(value) => updateFormData('password', value)}
              secureTextEntry
              editable={!loading}
            />
            {errors.password && (
              <Text className="text-red-500 text-xs mt-1">{errors.password}</Text>
            )}
          </View>

          {/* Role Picker */}
          {renderRolePicker()}

          {/* Active Status (only in edit mode) */}
          {isEditMode && (
            <View className="mb-6">
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-medium text-gray-700">
                  Active Status
                </Text>
                <Switch
                  value={formData.isActive}
                  onValueChange={(value) => updateFormData('isActive', value)}
                  disabled={loading}
                />
              </View>
              <Text className="text-xs text-gray-500 mt-1">
                Inactive users cannot log in to the application
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-gray-500 py-3 rounded-lg"
              onPress={onCancel}
              disabled={loading}
            >
              <Text className="text-white text-center font-medium">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg ${loading ? 'bg-gray-400' : 'bg-blue-500'
                }`}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-center font-medium">
                  {isEditMode ? 'Update User' : 'Create User'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}; 