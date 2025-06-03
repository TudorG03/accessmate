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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ModeratorService, ModeratorReview, UpdateReviewRequest } from '@/services/moderator.service';

interface ReviewFormProps {
  review?: ModeratorReview | null; // Review to edit
  onSuccess?: (review: ModeratorReview) => void;
  onCancel?: () => void;
}

export const ReviewFormComponent: React.FC<ReviewFormProps> = ({
  review,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    locationName: review?.locationName || '',
    accessibilityRating: review?.accessibilityRating || 3,
    description: review?.description || '',
    questions: {
      ramp: review?.questions.ramp ?? null,
      wideDoors: review?.questions.wideDoors ?? null,
      elevator: review?.questions.elevator ?? null,
      adaptedToilets: review?.questions.adaptedToilets ?? null,
    },
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when review prop changes
  useEffect(() => {
    if (review) {
      setFormData({
        locationName: review.locationName,
        accessibilityRating: review.accessibilityRating,
        description: review.description,
        questions: {
          ramp: review.questions.ramp,
          wideDoors: review.questions.wideDoors,
          elevator: review.questions.elevator,
          adaptedToilets: review.questions.adaptedToilets,
        },
      });
    }
  }, [review]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Location name validation
    if (!formData.locationName.trim()) {
      newErrors.locationName = 'Location name is required';
    } else if (formData.locationName.length < 2) {
      newErrors.locationName = 'Location name must be at least 2 characters long';
    }

    // Rating validation
    if (formData.accessibilityRating < 1 || formData.accessibilityRating > 5) {
      newErrors.accessibilityRating = 'Rating must be between 1 and 5';
    }

    // Description validation (optional but if provided, should be meaningful)
    if (formData.description && formData.description.length < 10) {
      newErrors.description = 'Description should be at least 10 characters if provided';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !review) {
      return;
    }

    setLoading(true);
    try {
      const updateData: UpdateReviewRequest = {
        locationName: formData.locationName,
        accessibilityRating: formData.accessibilityRating,
        description: formData.description,
        questions: formData.questions,
      };
      
      const response = await ModeratorService.updateReview(review._id, updateData);

      Alert.alert(
        'Success',
        'Review updated successfully',
        [{ text: 'OK', onPress: () => onSuccess?.(response.review) }]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to update review'
      );
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const updateQuestionData = (question: string, value: boolean | null) => {
    setFormData(prev => ({
      ...prev,
      questions: {
        ...prev.questions,
        [question]: value,
      }
    }));
  };

  const renderRatingPicker = () => (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-2">Accessibility Rating *</Text>
      <View className="flex-row justify-between">
        {[1, 2, 3, 4, 5].map((rating) => (
          <TouchableOpacity
            key={rating}
            className={`flex-1 mx-1 py-3 rounded-lg border ${
              formData.accessibilityRating === rating
                ? 'bg-blue-500 border-blue-500'
                : 'bg-white border-gray-300'
            }`}
            onPress={() => updateFormData('accessibilityRating', rating)}
          >
            <View className="items-center">
              <Ionicons 
                name="star" 
                size={20} 
                color={formData.accessibilityRating === rating ? 'white' : '#F59E0B'} 
              />
              <Text
                className={`text-sm font-medium mt-1 ${
                  formData.accessibilityRating === rating ? 'text-white' : 'text-gray-700'
                }`}
              >
                {rating}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      {errors.accessibilityRating && (
        <Text className="text-red-500 text-xs mt-1">{errors.accessibilityRating}</Text>
      )}
    </View>
  );

  const renderAccessibilityQuestions = () => {
    const questions = [
      { key: 'ramp', label: 'Wheelchair Ramp Available', icon: 'wheelchair-accessibility' },
      { key: 'wideDoors', label: 'Wide Doors/Entrances', icon: 'door-open' },
      { key: 'elevator', label: 'Elevator Access', icon: 'elevator' },
      { key: 'adaptedToilets', label: 'Accessible Toilets', icon: 'human-male-female' },
    ];

    return (
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-3">Accessibility Features</Text>
        {questions.map(({ key, label, icon }) => (
          <View key={key} className="mb-3 p-3 bg-gray-50 rounded-lg">
            <View className="flex-row items-center mb-2">
              <MaterialCommunityIcons name={icon as any} size={20} color="#6B7280" />
              <Text className="text-sm font-medium text-gray-700 ml-2 flex-1">
                {label}
              </Text>
            </View>
            
            <View className="flex-row justify-center">
              {[
                { value: true, label: 'Yes', color: 'bg-green-500' },
                { value: false, label: 'No', color: 'bg-red-500' },
                { value: null, label: 'Unknown', color: 'bg-gray-500' },
              ].map(({ value, label: optionLabel, color }) => (
                <TouchableOpacity
                  key={String(value)}
                  className={`flex-1 mx-1 py-2 rounded ${
                    formData.questions[key as keyof typeof formData.questions] === value
                      ? color
                      : 'bg-gray-200'
                  }`}
                  onPress={() => updateQuestionData(key, value)}
                >
                  <Text
                    className={`text-center text-sm font-medium ${
                      formData.questions[key as keyof typeof formData.questions] === value
                        ? 'text-white'
                        : 'text-gray-700'
                    }`}
                  >
                    {optionLabel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (!review) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-500">No review selected for editing</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <View className="bg-white rounded-lg shadow-sm p-6">
          <Text className="text-xl font-bold text-gray-900 mb-2">
            Edit Review
          </Text>
          
          {/* Review Info */}
          <View className="bg-blue-50 p-3 rounded-lg mb-6">
            <Text className="text-sm font-medium text-blue-800">Review by:</Text>
            <Text className="text-sm text-blue-700">{review.userId.displayName} ({review.userId.email})</Text>
            <Text className="text-xs text-blue-600 mt-1">
              Created: {new Date(review.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {/* Location Name Field */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Location Name *
            </Text>
            <TextInput
              className={`border rounded-lg px-4 py-3 text-gray-900 ${
                errors.locationName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter location name"
              value={formData.locationName}
              onChangeText={(value) => updateFormData('locationName', value)}
              editable={!loading}
            />
            {errors.locationName && (
              <Text className="text-red-500 text-xs mt-1">{errors.locationName}</Text>
            )}
          </View>

          {/* Description Field */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Description
            </Text>
            <TextInput
              className={`border rounded-lg px-4 py-3 text-gray-900 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter review description"
              value={formData.description}
              onChangeText={(value) => updateFormData('description', value)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!loading}
            />
            {errors.description && (
              <Text className="text-red-500 text-xs mt-1">{errors.description}</Text>
            )}
          </View>

          {/* Rating Picker */}
          {renderRatingPicker()}

          {/* Accessibility Questions */}
          {renderAccessibilityQuestions()}

          {/* Review Images (Read-only) */}
          {review.images && review.images.length > 0 && (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Attached Images ({review.images.length})
              </Text>
              <View className="bg-gray-50 p-3 rounded-lg">
                <View className="flex-row items-center">
                  <Ionicons name="images" size={20} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-2">
                    {review.images.length} image{review.images.length !== 1 ? 's' : ''} attached
                  </Text>
                </View>
                <Text className="text-xs text-gray-500 mt-1">
                  Image editing not available in moderator tools
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3 mt-6">
            <TouchableOpacity
              className="flex-1 bg-gray-500 py-3 rounded-lg"
              onPress={onCancel}
              disabled={loading}
            >
              <Text className="text-white text-center font-medium">Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg ${
                loading ? 'bg-gray-400' : 'bg-blue-500'
              }`}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-center font-medium">
                  Update Review
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}; 