import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ReviewListComponent } from '@/components/moderator/ReviewListComponent';
import { ReviewFormComponent } from '@/components/moderator/ReviewFormComponent';
import { ModeratorService, ModeratorReview } from '@/services/moderator.service';
import { UserRole } from '@/types/auth.types';

type ViewMode = 'list' | 'edit';

export default function ModeratorReviewsScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedReview, setSelectedReview] = useState<ModeratorReview | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleReviewSelect = (review: ModeratorReview) => {
    setSelectedReview(review);
    setViewMode('edit');
  };

  const handleReviewEdit = (review: ModeratorReview) => {
    setSelectedReview(review);
    setViewMode('edit');
  };

  const handleReviewDelete = async (review: ModeratorReview) => {
    try {
      await ModeratorService.deleteReview(review._id);
      Alert.alert(
        'Success',
        'Review deleted successfully',
        [{ text: 'OK' }]
      );
      
      // Refresh the list
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to delete review'
      );
    }
  };

  const handleEditSuccess = (updatedReview: ModeratorReview) => {
    setViewMode('list');
    setSelectedReview(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEditCancel = () => {
    setViewMode('list');
    setSelectedReview(null);
  };

  const renderHeader = () => (
    <View className="flex-row items-center justify-between mb-6">
      {viewMode === 'list' ? (
        <>
          <View>
            <Text className="text-2xl font-bold text-gray-900">Review Management</Text>
            <Text className="text-gray-600">Moderate user reviews</Text>
          </View>
        </>
      ) : (
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            className="mr-4 p-2"
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-gray-900">Edit Review</Text>
            <Text className="text-gray-600">
              {selectedReview?.locationName}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    switch (viewMode) {
      case 'edit':
        return (
          <ReviewFormComponent
            review={selectedReview}
            onSuccess={handleEditSuccess}
            onCancel={handleEditCancel}
          />
        );
      
      case 'list':
      default:
        return (
          <ReviewListComponent
            onReviewSelect={handleReviewSelect}
            onReviewEdit={handleReviewEdit}
            onReviewDelete={handleReviewDelete}
            refreshTrigger={refreshTrigger}
          />
        );
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MODERATOR]}>
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 p-4">
          {renderHeader()}
          {renderContent()}
        </View>
      </SafeAreaView>
    </ProtectedRoute>
  );
} 