import React, { useEffect, useState, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, TextInput, ToastAndroid, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReview } from "@/stores/review";
import { useTheme } from "@/stores/theme/useTheme";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import useAuth from "@/stores/auth/hooks/useAuth";
import { router } from "expo-router";
import { Review } from "@/stores/review/review.store";
import * as ImagePicker from 'expo-image-picker';
import { ImageWithFallback } from "@/components/ImageWithFallback";

export default function MyReviewsScreen() {
  const { userReviews, isLoading, error, fetchUserReviews, deleteReview } = useReview();
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  useEffect(() => {
    loadUserReviews();
  }, []);

  const loadUserReviews = async () => {
    if (isAuthenticated) {
      fetchUserReviews();
    } else {
      // If not authenticated, redirect to login
      router.push("/login");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUserReviews();
    setRefreshing(false);
  };

  const handleDeleteReview = (reviewId: string) => {
    // Add additional logging to debug the issue
    console.log('Attempting to delete review with ID:', reviewId);

    // Check if the review ID is valid
    if (!reviewId) {
      console.error('Review ID is undefined or empty');
      Alert.alert(
        "Error",
        "Cannot delete review: Review ID is missing.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Delete Review",
      "Are you sure you want to delete this review? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              console.log('Confirming delete for review ID:', reviewId);
              const success = await deleteReview(reviewId);

              if (success) {
                console.log('Review deleted successfully');
                // Refresh the list after deletion
                loadUserReviews();
              } else {
                console.error('Delete operation returned false');
                Alert.alert(
                  "Error",
                  "Failed to delete the review. Please try again.",
                  [{ text: "OK" }]
                );
              }
            } catch (error) {
              console.error('Error deleting review:', error);
              Alert.alert(
                "Error",
                "An error occurred while deleting the review.",
                [{ text: "OK" }]
              );
            }
          }
        }
      ]
    );
  };

  // Handle edit review
  const handleEditReview = (review: Review) => {
    console.log('Editing review:', review);
    console.log('Review ID:', review.id);
    console.log('Review _id:', (review as any)._id); // Check if _id exists

    // Make a deep copy to avoid reference issues
    const reviewCopy = JSON.parse(JSON.stringify(review));

    // Ensure the ID is set correctly
    if (!reviewCopy.id && (reviewCopy as any)._id) {
      reviewCopy.id = (reviewCopy as any)._id;
    }

    setEditingReview(reviewCopy);
    setReviewModalVisible(true);
  };

  // Handle close review modal
  const handleCloseReviewModal = () => {
    setEditingReview(null);
    setReviewModalVisible(false);
  };

  // Extract unique location names for the filter
  const locationOptions = useMemo(() => {
    const uniqueLocations = new Set<string>();
    userReviews.forEach(review => {
      if (review.locationName) {
        uniqueLocations.add(review.locationName);
      }
    });
    return Array.from(uniqueLocations).sort();
  }, [userReviews]);

  // Filter reviews by selected location
  const filteredReviews = useMemo(() => {
    if (!selectedLocation) return userReviews;
    return userReviews.filter(review => review.locationName === selectedLocation);
  }, [userReviews, selectedLocation]);

  // Toggle filter modal
  const toggleFilterModal = () => {
    setIsFilterModalVisible(!isFilterModalVisible);
  };

  // Clear filter
  const clearFilter = () => {
    setSelectedLocation(null);
    setIsFilterModalVisible(false);
  };

  // Select location filter
  const selectLocation = (location: string) => {
    setSelectedLocation(location);
    setIsFilterModalVisible(false);
  };

  const renderReviewItem = ({ item }: { item: Review }) => {
    // Get the correct ID to use
    const reviewId = item.id || (item as any)._id;
    console.log('🔍 Rendering review item:', {
      id: reviewId,
      hasImages: !!(item.images && item.images.length > 0),
      imageCount: item.images?.length || 0,
      firstImageType: item.images?.[0] ? (item.images[0].startsWith('data:') ? 'base64' : item.images[0].startsWith('file:') ? 'file' : item.images[0].startsWith('http') ? 'url' : 'unknown') : 'none',
      firstImageLength: item.images?.[0]?.length || 0
    });

    if (!reviewId) {
      console.warn('Review without ID:', item);
    }

    return (
      <View
        className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        {/* Location name and date */}
        <View className="flex-row justify-between items-center mb-2">
          <Text className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-800'}`} numberOfLines={1}>
            {item.locationName}
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Rating */}
        <View className="flex-row items-center mb-2">
          <View className="flex-row">
            {[1, 2, 3, 4, 5].map((star) => (
              <MaterialCommunityIcons
                key={star}
                name="wheelchair-accessibility"
                size={18}
                color={star <= item.accessibilityRating ? '#F1B24A' : isDark ? '#555' : '#ddd'}
              />
            ))}
          </View>
        </View>

        {/* Description */}
        {item.description && (
          <Text
            className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}
            numberOfLines={2}
          >
            {item.description}
          </Text>
        )}

        {/* First image if available */}
        {item.images && item.images.length > 0 && (
          <View className="mb-3">
            <ImageWithFallback
              uri={item.images[0]}
              style={{ width: '100%', height: 150, borderRadius: 8 }}
              resizeMode="cover"
              onError={(error) => {
                console.log(`🖼️ Review image load error:`, error);
                console.log(`🖼️ Failed review image URI: ${item.images[0]}`);
                console.log(`🖼️ Image URI type: ${item.images[0]?.startsWith('data:') ? 'base64' : item.images[0]?.startsWith('file:') ? 'file' : item.images[0]?.startsWith('http') ? 'url' : 'unknown'}`);
                console.log(`🖼️ Image URI length: ${item.images[0]?.length || 0}`);
              }}
              onLoad={() => {
                console.log(`🖼️ Review image loaded successfully: ${item.images[0]?.substring(0, 50)}...`);
              }}
            />
            {item.images.length > 1 && (
              <View className="absolute bottom-2 right-2 bg-black bg-opacity-60 px-2 py-1 rounded-full">
                <Text className="text-white text-xs">+{item.images.length - 1}</Text>
              </View>
            )}
          </View>
        )}

        {/* Accessibility features */}
        <View className="flex-row flex-wrap mb-3">
          {item.questions.ramp !== null && (
            <View className={`mr-2 mb-1 px-2 py-1 rounded-md flex-row items-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <Ionicons name={item.questions.ramp ? "checkmark-circle" : "close-circle"} size={16} color={item.questions.ramp ? "green" : "red"} />
              <Text className={`ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs`}>Ramp</Text>
            </View>
          )}
          {item.questions.wideDoors !== null && (
            <View className={`mr-2 mb-1 px-2 py-1 rounded-md flex-row items-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <Ionicons name={item.questions.wideDoors ? "checkmark-circle" : "close-circle"} size={16} color={item.questions.wideDoors ? "green" : "red"} />
              <Text className={`ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs`}>Wide Doors</Text>
            </View>
          )}
          {item.questions.elevator !== null && (
            <View className={`mr-2 mb-1 px-2 py-1 rounded-md flex-row items-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <Ionicons name={item.questions.elevator ? "checkmark-circle" : "close-circle"} size={16} color={item.questions.elevator ? "green" : "red"} />
              <Text className={`ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs`}>Elevator</Text>
            </View>
          )}
          {item.questions.adaptedToilets !== null && (
            <View className={`mr-2 mb-1 px-2 py-1 rounded-md flex-row items-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <Ionicons name={item.questions.adaptedToilets ? "checkmark-circle" : "close-circle"} size={16} color={item.questions.adaptedToilets ? "green" : "red"} />
              <Text className={`ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs`}>Accessible Toilets</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View className="flex-row justify-end">
          <TouchableOpacity
            onPress={() => handleEditReview(item)}
            className="mr-3 p-2"
          >
            <Ionicons name="pencil" size={20} color={isDark ? "#F1B24A" : "#F1B24A"} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteReview(reviewId)}
            className="p-2"
          >
            <Ionicons name="trash-outline" size={20} color={isDark ? "#ff6b6b" : "#ff4040"} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Filter Modal Component
  const FilterModal = () => (
    <Modal
      visible={isFilterModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={toggleFilterModal}
    >
      <View className="flex-1 justify-end bg-black bg-opacity-50">
        <View className={`rounded-t-3xl ${isDark ? 'bg-gray-900' : 'bg-white'} p-5 max-h-[70%]`}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Filter by Location</Text>
            <TouchableOpacity onPress={toggleFilterModal}>
              <Ionicons name="close" size={24} color={isDark ? "white" : "black"} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className={`p-3 mb-2 border rounded-lg ${isDark ? 'border-gray-700' : 'border-gray-300'}`}
            onPress={clearFilter}
          >
            <View className="flex-row justify-between items-center">
              <Text className={`${isDark ? 'text-white' : 'text-gray-800'} font-medium`}>All Locations</Text>
              {!selectedLocation && <Ionicons name="checkmark" size={20} color="#F1B24A" />}
            </View>
          </TouchableOpacity>

          <ScrollView className="max-h-[400px]">
            {locationOptions.map((location, index) => (
              <TouchableOpacity
                key={`location-${location}-${index}`}
                className={`p-3 mb-2 border rounded-lg ${isDark ? 'border-gray-700' : 'border-gray-300'}`}
                onPress={() => selectLocation(location)}
              >
                <View className="flex-row justify-between items-center">
                  <Text className={`${isDark ? 'text-white' : 'text-gray-800'}`} numberOfLines={1}>
                    {location}
                  </Text>
                  {selectedLocation === location && <Ionicons name="checkmark" size={20} color="#F1B24A" />}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Review Edit Modal Component
  const ReviewEditModal = () => {
    const [reviewForm, setReviewForm] = useState({
      accessibilityRating: editingReview?.accessibilityRating || 0,
      description: editingReview?.description || '',
      images: editingReview?.images || [],
      questions: {
        ramp: editingReview?.questions.ramp,
        wideDoors: editingReview?.questions.wideDoors,
        elevator: editingReview?.questions.elevator,
        adaptedToilets: editingReview?.questions.adaptedToilets,
      }
    });
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const { updateReview } = useReview();

    // Initialize form when editing review changes
    useEffect(() => {
      if (editingReview) {
        setReviewForm({
          accessibilityRating: editingReview.accessibilityRating,
          description: editingReview.description || '',
          images: editingReview.images || [],
          questions: {
            ramp: editingReview.questions.ramp,
            wideDoors: editingReview.questions.wideDoors,
            elevator: editingReview.questions.elevator,
            adaptedToilets: editingReview.questions.adaptedToilets,
          }
        });
      }
    }, [editingReview]);

    async function handlePickReviewImage() {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setReviewError('Please grant permission to access your photos');
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
          console.log(`📸 Selected image - base64 available: ${!!selectedImage.base64}, uri: ${selectedImage.uri}`);

          if (selectedImage.base64) {
            // Create a data URL from the base64 data
            const dataUrl = `data:image/jpeg;base64,${selectedImage.base64}`;
            console.log(`📸 Created data URL (first 100 chars): ${dataUrl.substring(0, 100)}...`);
            setReviewForm((prev) => ({ ...prev, images: [...prev.images, dataUrl] }));
          } else if (selectedImage.uri) {
            // Fallback to URI if base64 is not available
            console.log(`📸 Using fallback URI: ${selectedImage.uri}`);
            setReviewForm((prev) => ({ ...prev, images: [...prev.images, selectedImage.uri] }));
          }
        }
      } catch (err) {
        setReviewError('Error selecting image');
      }
    }

    function handleRemoveReviewImage(index: number) {
      setReviewForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    }

    function handleReviewQuestionChange(key: string, value: boolean) {
      setReviewForm((prev) => ({ ...prev, questions: { ...prev.questions, [key]: value } }));
    }

    function handleReviewRatingChange(value: number) {
      setReviewForm((prev) => ({ ...prev, accessibilityRating: value }));
    }

    function handleReviewDescriptionChange(text: string) {
      setReviewForm((prev) => ({ ...prev, description: text }));
    }

    async function handleSubmitReview() {
      if (!editingReview) {
        setReviewError('Review ID is missing. Please try again.');
        return;
      }

      // Log the entire review object for debugging
      console.log('Current editing review:', JSON.stringify(editingReview));

      // Determine the correct ID to use
      const reviewId = editingReview.id || (editingReview as any)._id;

      // Check if ID exists and is valid
      if (!reviewId) {
        console.error('Review ID is undefined or empty');
        setReviewError('Review ID is missing. Please try again.');
        return;
      }

      try {
        setReviewLoading(true);
        setReviewError('');

        // For debugging
        console.log('Updating review with ID:', reviewId);

        // Validate required fields before submission
        if (!reviewForm.accessibilityRating) {
          setReviewError('Please provide an overall accessibility rating');
          setReviewLoading(false);
          return;
        }

        // Submit the updated review
        const result = await updateReview(reviewId, {
          accessibilityRating: reviewForm.accessibilityRating,
          description: reviewForm.description,
          images: reviewForm.images,
          questions: reviewForm.questions
        });

        if (result) {
          // Refresh the reviews list
          loadUserReviews();

          const message = "Your review has been successfully updated.";

          // Close modal and clear editing state for both platforms
          setReviewModalVisible(false);
          setEditingReview(null);

          if (Platform.OS == "android") {
            ToastAndroid.show(message, ToastAndroid.SHORT);
          } else {
            Alert.alert(
              "Review Updated",
              message,
              [{ text: "OK" }]
            );
          }
        }
      } catch (error: any) {
        console.error('Error updating review:', error);
        setReviewError(error instanceof Error ? error.message : 'Failed to update review. Please try again.');
      } finally {
        setReviewLoading(false);
      }
    }

    // Helper functions to check if a question is true or false
    const isQuestionTrue = (key: string) => {
      return reviewForm.questions[key as keyof typeof reviewForm.questions] === true;
    };

    const isQuestionFalse = (key: string) => {
      return reviewForm.questions[key as keyof typeof reviewForm.questions] === false;
    };

    return (
      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseReviewModal}
      >
        <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          <View className="flex-row items-center justify-between px-4 pt-8 pb-4">
            <Image
              source={isDark ? require('@/assets/images/logo-icon-white.png') : require('@/assets/images/logo-icon-black.png')}
              style={{ width: 32, height: 32, resizeMode: 'contain' }}
            />
            <View className="flex-1 items-center justify-center my-10">
              <Text className={`text-3xl font-bold text-center ${isDark ? 'text-white' : 'text-gray-800'} my-4`}>Edit <Text className="text-primary">AccessView</Text></Text>
            </View>
            <TouchableOpacity onPress={handleCloseReviewModal}>
              <Ionicons name="close" size={28} color={isDark ? 'white' : 'black'} />
            </TouchableOpacity>
          </View>
          <View className={`flex-1 rounded-t-3xl ${isDark ? 'bg-gray-800' : 'bg-white'} mx-2 pb-2`} style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}>
            <ScrollView className="flex-1 px-4 pb-40">
              {/* Accessibility Questions */}
              <View className="mb-8">
                <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Accessibility Questions</Text>
                <View className="space-y-4">
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base flex-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Is there a ramp at the entrance (if applicable)?</Text>
                    <View className="flex-row space-x-2 ml-4 min-w-[60px] justify-end">
                      <TouchableOpacity onPress={() => handleReviewQuestionChange('ramp', true)} className="rounded-full p-1 active:bg-primary/20">
                        <Ionicons name="checkmark" size={22} color={isQuestionTrue('ramp') ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleReviewQuestionChange('ramp', false)} className="rounded-full p-1 active:bg-primary/20">
                        <Ionicons name="close" size={22} color={isQuestionFalse('ramp') ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base flex-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Are the doors wide enough for a wheelchair?</Text>
                    <View className="flex-row space-x-2 ml-4 min-w-[60px] justify-end">
                      <TouchableOpacity onPress={() => handleReviewQuestionChange('wideDoors', true)} className="rounded-full p-1 active:bg-primary/20">
                        <Ionicons name="checkmark" size={22} color={isQuestionTrue('wideDoors') ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleReviewQuestionChange('wideDoors', false)} className="rounded-full p-1 active:bg-primary/20">
                        <Ionicons name="close" size={22} color={isQuestionFalse('wideDoors') ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base flex-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Is there a functional elevator to access all floors (if applicable)?</Text>
                    <View className="flex-row space-x-2 ml-4 min-w-[60px] justify-end">
                      <TouchableOpacity onPress={() => handleReviewQuestionChange('elevator', true)} className="rounded-full p-1 active:bg-primary/20">
                        <Ionicons name="checkmark" size={22} color={isQuestionTrue('elevator') ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleReviewQuestionChange('elevator', false)} className="rounded-full p-1 active:bg-primary/20">
                        <Ionicons name="close" size={22} color={isQuestionFalse('elevator') ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base flex-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Are there accessible toilets?</Text>
                    <View className="flex-row space-x-2 ml-4 min-w-[60px] justify-end">
                      <TouchableOpacity onPress={() => handleReviewQuestionChange('adaptedToilets', true)} className="rounded-full p-1 active:bg-primary/20">
                        <Ionicons name="checkmark" size={22} color={isQuestionTrue('adaptedToilets') ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleReviewQuestionChange('adaptedToilets', false)} className="rounded-full p-1 active:bg-primary/20">
                        <Ionicons name="close" size={22} color={isQuestionFalse('adaptedToilets') ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
              <View className="border-t border-gray-400/20 mb-8" />

              {/* Ratings */}
              <View className="mb-8">
                <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Rate overall experience accessibility-wise</Text>
                <View className="flex-row mb-3 space-x-2">
                  {[1, 2, 3, 4, 5].map((level) => {
                    let iconComponent = null;
                    if (level === 3) {
                      iconComponent = (
                        <MaterialCommunityIcons
                          key={`rating-icon-${level}`}
                          name="human-cane"
                          size={32}
                          color={reviewForm.accessibilityRating >= level ? '#F1B24A' : isDark ? '#555' : '#bbb'}
                        />
                      );
                    } else if (level === 4 || level === 5) {
                      iconComponent = (
                        <MaterialCommunityIcons
                          key={`rating-icon-${level}`}
                          name="wheelchair-accessibility"
                          size={32}
                          color={reviewForm.accessibilityRating >= level ? '#F1B24A' : isDark ? '#555' : '#bbb'}
                        />
                      );
                    } else {
                      iconComponent = (
                        <Ionicons
                          key={`rating-icon-${level}`}
                          name="accessibility"
                          size={32}
                          color={reviewForm.accessibilityRating >= level ? '#F1B24A' : isDark ? '#555' : '#bbb'}
                        />
                      );
                    }
                    return (
                      <TouchableOpacity key={`rating-level-${level}`} onPress={() => handleReviewRatingChange(level)} className="rounded-full p-1 active:bg-primary/20">
                        {iconComponent}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View className="border-t border-gray-400/20 mb-8" />

              {/* Add Photos */}
              <View className="mb-8">
                <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Add photos</Text>
                <View className={`flex-row flex-wrap items-center rounded-xl p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  {reviewForm.images.map((uri, idx) => (
                    <View key={`image-${uri.substring(uri.length - 20)}-${idx}`} className="w-[80px] h-[80px] m-1 relative rounded-lg overflow-hidden" style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2,
                    }}>
                      <TouchableOpacity
                        className="absolute top-[-8px] right-[-8px] z-10 bg-white rounded-full"
                        style={{
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 1,
                          elevation: 1,
                        }}
                        onPress={() => handleRemoveReviewImage(idx)}
                      >
                        <Ionicons name="close-circle" size={20} color="red" />
                      </TouchableOpacity>
                      <ImageWithFallback uri={uri} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>
                  ))}
                  <TouchableOpacity className={`w-[80px] h-[80px] border-2 border-dashed m-1 justify-center items-center rounded-lg ${isDark ? 'border-gray-500' : 'border-gray-300'} ${isDark ? 'bg-gray-800/50' : 'bg-white'} active:bg-primary/10`} onPress={handlePickReviewImage}>
                    <Ionicons name="camera" size={28} color={isDark ? '#bbb' : '#555'} />
                    <Text className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View className="border-t border-gray-400/20 mb-8" />

              {/* Description */}
              <View className="mb-8">
                <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Tell us your thoughts</Text>
                <View className={`rounded-xl border-2 ${isDark ? 'border-dark-border bg-dark-input' : 'border-gray-300 bg-white'}`} style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 1,
                  elevation: 1,
                }}>
                  <TextInput
                    className={`p-4 min-h-[60px] text-base ${isDark ? 'text-white' : 'text-black'}`}
                    value={reviewForm.description}
                    onChangeText={handleReviewDescriptionChange}
                    placeholder="Write here..."
                    placeholderTextColor={isDark ? '#bbb' : '#888'}
                    multiline
                  />
                </View>
              </View>

              {/* Error */}
              {reviewError ? <Text className="text-red-500 mb-2">{reviewError}</Text> : null}

              <TouchableOpacity
                className={`w-full rounded-xl py-4 items-center mt-4 mb-8 ${reviewLoading ? 'bg-gray-400' : 'bg-primary'} active:scale-95`}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 3,
                  elevation: 4,
                }}
                onPress={handleSubmitReview}
                disabled={reviewLoading}
              >
                <Text className="text-white font-semibold text-lg tracking-wide">{reviewLoading ? 'Updating...' : 'Update Review'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      <View className="flex-1 p-4">
        {/* Header with filter button */}
        <View className="flex-row justify-between items-center mb-6">
          <View className="flex-row items-center">
            <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>My Access</Text>
            <Text className={`text-2xl font-bold text-primary`}>Views</Text>
          </View>

          {userReviews.length > 0 && (
            <TouchableOpacity
              onPress={toggleFilterModal}
              className={`flex-row items-center px-3 py-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
            >
              <Text className={`mr-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                {selectedLocation ? 'Filtered' : 'Filter'}
              </Text>
              <Ionicons name="filter" size={18} color={isDark ? "#F1B24A" : "#F1B24A"} />
            </TouchableOpacity>
          )}
        </View>

        {/* Show selected filter if active */}
        {selectedLocation && (
          <View className="flex-row items-center mb-4">
            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mr-2`}>Showing reviews for:</Text>
            <View className={`flex-row items-center px-2 py-1 rounded-md ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
              <Text className={`${isDark ? 'text-white' : 'text-gray-800'} mr-2`}>{selectedLocation}</Text>
              <TouchableOpacity onPress={clearFilter}>
                <Ionicons name="close-circle" size={16} color={isDark ? "#ff6b6b" : "#ff4040"} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isLoading && !refreshing ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#F1B24A" />
            <Text className={`mt-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading your reviews...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center p-4">
            <Ionicons name="alert-circle" size={48} color="red" />
            <Text className="text-red-500 text-center mt-4">{error}</Text>
            <TouchableOpacity
              className="mt-4 bg-primary px-4 py-2 rounded-lg"
              onPress={loadUserReviews}
            >
              <Text className="text-white font-semibold">Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : userReviews.length === 0 ? (
          <View className="flex-1 justify-center items-center p-4">
            <MaterialCommunityIcons name="text-box-outline" size={64} color={isDark ? "#F1B24A" : "#F1B24A"} />
            <Text className={`text-xl font-semibold mt-4 text-center ${isDark ? 'text-white' : 'text-gray-800'}`}>
              No Reviews Yet
            </Text>
            <Text className={`mt-2 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Explore places and share your accessibility experiences.
            </Text>
            <TouchableOpacity
              className="mt-6 bg-primary px-6 py-3 rounded-lg"
              onPress={() => router.push("/(tabs)/")}
            >
              <Text className="text-white font-semibold">Explore Map</Text>
            </TouchableOpacity>
          </View>
        ) : filteredReviews.length === 0 ? (
          <View className="flex-1 justify-center items-center p-4">
            <Ionicons name="search" size={64} color={isDark ? "#F1B24A" : "#F1B24A"} />
            <Text className={`text-xl font-semibold mt-4 text-center ${isDark ? 'text-white' : 'text-gray-800'}`}>
              No Reviews Found
            </Text>
            <Text className={`mt-2 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              No reviews match your current filter.
            </Text>
            <TouchableOpacity
              className="mt-6 bg-primary px-6 py-3 rounded-lg"
              onPress={clearFilter}
            >
              <Text className="text-white font-semibold">Clear Filter</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredReviews}
            renderItem={renderReviewItem}
            keyExtractor={(item) => {
              // Ensure we have a stable, unique key
              if (item.id) return item.id;
              if ((item as any)._id) return (item as any)._id;
              // Fallback to a combination of unique properties
              return `review-${item.createdAt}-${item.locationName}-${JSON.stringify(item.location)}`;
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        )}

        {/* Filter Modal */}
        <FilterModal />

        {/* Review Edit Modal */}
        <ReviewEditModal />
      </View>
    </SafeAreaView>
  );
} 
