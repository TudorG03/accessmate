import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ModeratorService, ModeratorReview } from '@/services/moderator.service';

interface ReviewListProps {
  onReviewSelect?: (review: ModeratorReview) => void;
  onReviewEdit?: (review: ModeratorReview) => void;
  onReviewDelete?: (review: ModeratorReview) => void;
  refreshTrigger?: number;
}

export const ReviewListComponent: React.FC<ReviewListProps> = ({
  onReviewSelect,
  onReviewEdit,
  onReviewDelete,
  refreshTrigger = 0,
}) => {
  const [reviews, setReviews] = useState<ModeratorReview[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<ModeratorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRating, setSelectedRating] = useState<number | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  // Load reviews on mount and when refreshTrigger changes
  useEffect(() => {
    loadReviews();
  }, [refreshTrigger]);

  // Filter reviews when search query or rating filter changes
  useEffect(() => {
    filterReviews();
  }, [reviews, searchQuery, selectedRating]);

  const loadReviews = async () => {
    try {
      setError(null);
      const response = await ModeratorService.getAllReviews();
      setReviews(response.reviews || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load reviews');
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  const filterReviews = () => {
    let filtered = reviews;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (review) =>
          review.locationName.toLowerCase().includes(query) ||
          review.description.toLowerCase().includes(query) ||
          review.userId.displayName.toLowerCase().includes(query) ||
          review.userId.email.toLowerCase().includes(query)
      );
    }

    // Filter by rating
    if (selectedRating !== 'all') {
      filtered = filtered.filter((review) => 
        Math.floor(review.accessibilityRating) === selectedRating
      );
    }

    // Sort by creation date (newest first)
    filtered = filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    setFilteredReviews(filtered);
  };

  const handleDeleteReview = (review: ModeratorReview) => {
    Alert.alert(
      'Delete Review',
      `Are you sure you want to delete the review for "${review.locationName}" by ${review.userId.displayName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onReviewDelete?.(review),
        },
      ]
    );
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-600';
    if (rating >= 3) return 'text-yellow-600';
    if (rating >= 2) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRatingIcon = (rating: number) => {
    if (rating >= 4) return 'star';
    if (rating >= 3) return 'star-half';
    return 'star-outline';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderAccessibilityQuestions = (questions: ModeratorReview['questions']) => {
    const icons = {
      ramp: 'wheelchair-accessibility',
      wideDoors: 'door-open',
      elevator: 'elevator',
      adaptedToilets: 'human-male-female',
    };
    
    const labels = {
      ramp: 'Ramp',
      wideDoors: 'Wide Doors',
      elevator: 'Elevator',
      adaptedToilets: 'Accessible Toilets',
    };

    // Filter out null values before mapping to avoid key issues
    const validQuestions = Object.entries(questions).filter(([_, value]) => value !== null);

    return (
      <View className="flex-row flex-wrap mt-2">
        {validQuestions.map(([key, value]) => (
          <View 
            key={key} 
            className={`flex-row items-center mr-3 mb-1 px-2 py-1 rounded-full ${
              value ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <MaterialCommunityIcons 
              name={icons[key as keyof typeof icons] as any} 
              size={12} 
              color={value ? '#15803d' : '#dc2626'} 
            />
            <Text className={`text-xs ml-1 ${value ? 'text-green-800' : 'text-red-800'}`}>
              {labels[key as keyof typeof labels]}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderReviewItem = ({ item: review }: { item: ModeratorReview }) => (
    <TouchableOpacity
      className="bg-white rounded-lg shadow-sm p-4 mb-3 border border-gray-200"
      onPress={() => onReviewSelect?.(review)}
    >
      {/* Header with location and rating */}
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>
            {review.locationName}
          </Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-sm text-gray-600">By: </Text>
            <Text className="text-sm font-medium text-gray-800">
              {review.userId.displayName}
            </Text>
          </View>
        </View>
        
        <View className="flex-row items-center">
          <Ionicons 
            name={getRatingIcon(review.accessibilityRating)} 
            size={16} 
            color="#F59E0B" 
          />
          <Text className={`ml-1 font-bold ${getRatingColor(review.accessibilityRating)}`}>
            {review.accessibilityRating.toFixed(1)}
          </Text>
        </View>
      </View>

      {/* Description */}
      {review.description && (
        <Text className="text-sm text-gray-700 mb-2" numberOfLines={2}>
          {review.description}
        </Text>
      )}

      {/* Accessibility Questions */}
      {renderAccessibilityQuestions(review.questions)}

      {/* Images indicator */}
      {review.images && review.images.length > 0 && (
        <View className="flex-row items-center mt-2">
          <Ionicons name="images" size={14} color="#6B7280" />
          <Text className="text-xs text-gray-500 ml-1">
            {review.images.length} image{review.images.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Footer with date and actions */}
      <View className="flex-row justify-between items-center mt-3 pt-2 border-t border-gray-100">
        <View>
          <Text className="text-xs text-gray-500">
            {formatDate(review.createdAt)}
          </Text>
          <Text className="text-xs text-gray-400">
            {review.userId.email}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <TouchableOpacity
            className="bg-blue-500 px-3 py-1 rounded"
            onPress={() => onReviewEdit?.(review)}
          >
            <Text className="text-white text-xs font-medium">Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-red-500 px-3 py-1 rounded"
            onPress={() => handleDeleteReview(review)}
          >
            <Text className="text-white text-xs font-medium">Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRatingFilter = () => (
    <View className="flex-row mb-4">
      {(['all', 1, 2, 3, 4, 5] as const).map((rating) => (
        <TouchableOpacity
          key={rating}
          className={`mr-2 px-3 py-2 rounded-full flex-row items-center ${
            selectedRating === rating
              ? 'bg-blue-500'
              : 'bg-gray-200'
          }`}
          onPress={() => setSelectedRating(rating)}
        >
          {rating !== 'all' && (
            <Ionicons 
              name="star" 
              size={12} 
              color={selectedRating === rating ? 'white' : '#6B7280'} 
            />
          )}
          <Text
            className={`text-xs font-medium ml-1 ${
              selectedRating === rating ? 'text-white' : 'text-gray-700'
            }`}
          >
            {rating === 'all' ? 'All' : `${rating}★`}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-2 text-gray-600">Loading reviews...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-red-600 text-center mb-4">{error}</Text>
        <TouchableOpacity
          className="bg-blue-500 px-4 py-2 rounded"
          onPress={loadReviews}
        >
          <Text className="text-white font-medium">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Search Bar */}
      <View className="mb-4">
        <TextInput
          className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          placeholder="Search by location, description, or user..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Rating Filter */}
      {renderRatingFilter()}

      {/* Stats */}
      <View className="mb-4">
        <Text className="text-sm text-gray-600">
          Showing {filteredReviews.length} of {reviews.length} reviews
        </Text>
      </View>

      {/* Review List */}
      <FlatList
        data={filteredReviews}
        renderItem={renderReviewItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="py-8 text-center">
            <Text className="text-gray-500 text-center">
              {searchQuery || selectedRating !== 'all'
                ? 'No reviews match your filters'
                : 'No reviews found'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}; 