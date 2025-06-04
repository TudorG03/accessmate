import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView, Image, Linking, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';
import { getPlaceDetails, getPlacePhoto } from '@/services/places.service';
import { useReview } from '@/stores/review';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import ReviewModal from './ReviewModal';

interface PlaceDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    onStartNavigation: (placeId: string) => void;
    placeId: string | null;
}

interface PhotoData {
    photo_reference: string;
    url: string;
}



export default function PlaceDetailsModal({
    visible,
    onClose,
    onStartNavigation,
    placeId
}: PlaceDetailsModalProps) {
    const [placeDetails, setPlaceDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [photos, setPhotos] = useState<PhotoData[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [failedPhotoIndexes, setFailedPhotoIndexes] = useState<Set<number>>(new Set());
    const [showAllHours, setShowAllHours] = useState(false);
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [showAllReviews, setShowAllReviews] = useState(false);

    const { isDark } = useTheme();
    const {
        locationReviews,
        fetchLocationReviews
    } = useReview();

    // Reset state when modal is hidden
    useEffect(() => {
        if (!visible) {
            setPlaceDetails(null);
            setError(null);
            setPhotos([]);
            setFailedPhotoIndexes(new Set());
            setShowAllHours(false);
        } else {
            console.log(`Modal becoming visible with placeId: ${placeId}`);
        }
    }, [visible]);

    // Fetch place details when placeId changes and modal is visible
    useEffect(() => {
        if (placeId && visible) {
            console.log(`Effect triggered to fetch details for placeId: ${placeId}`);
            fetchPlaceDetails();
        }
    }, [placeId, visible]);

    // Fetch photos when place details are loaded
    useEffect(() => {
        if (placeDetails?.photos?.length > 0) {
            fetchPlacePhotos();
        }
    }, [placeDetails]);



    // Add effect to fetch reviews when place details are loaded
    useEffect(() => {
        if (placeDetails?.geometry?.location) {
            const fetchReviews = async () => {
                try {
                    await fetchLocationReviews(
                        placeDetails.geometry.location.lat,
                        placeDetails.geometry.location.lng
                    );
                } catch (err) {
                    console.error('Error fetching reviews for location:', err);
                }
            };
            fetchReviews();
        }
    }, [placeDetails, fetchLocationReviews]);

    async function fetchPlaceDetails() {
        if (!placeId) {
            console.log("No place ID provided");
            setError("No place ID provided. Please try again.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log(`Fetching details for place ID: "${placeId}"`);
            const details = await getPlaceDetails(placeId);
            console.log('Place details fetched successfully');
            setPlaceDetails(details);
        } catch (err) {
            console.error('Error fetching place details:', err);
            setError('Failed to load place information. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    async function fetchPlacePhotos() {
        if (!placeDetails?.photos?.length) {
            console.log("No photos available in place details");
            return;
        }

        console.log(`Attempting to fetch ${placeDetails.photos.length} photos`);
        setLoadingPhotos(true);
        setFailedPhotoIndexes(new Set());

        try {
            // Only fetch up to 5 photos to avoid excessive API calls
            const photoPromises = placeDetails.photos
                .filter((photo: any) => photo && photo.photo_reference) // Ensure we have valid photo references
                .slice(0, 5)
                .map(async (photo: any, index: number) => {
                    console.log(`Processing photo reference ${index}: ${photo.photo_reference.substring(0, 30)}...`);
                    try {
                        // Check if photo reference is valid
                        if (!photo.photo_reference || photo.photo_reference.length < 5) {
                            console.warn(`Invalid photo reference: ${photo.photo_reference}`);
                            return null;
                        }

                        const url = await getPlacePhoto(photo.photo_reference, 400, 300);
                        console.log(`Got photo URL ${index}: ${url ? (url.length > 50 ? url.substring(0, 50) + '...' : url) : "Empty URL"}`);

                        // Only return entries with valid URLs
                        if (!url) {
                            console.warn(`Empty URL returned from getPlacePhoto for index ${index}`);
                            return null;
                        }

                        return {
                            photo_reference: photo.photo_reference,
                            url,
                            index
                        };
                    } catch (photoError) {
                        console.error(`Error fetching individual photo ${index}:`, photoError);
                        return null;
                    }
                });

            const photoResults = await Promise.all(photoPromises);
            const validPhotos = photoResults
                .filter(photo => photo !== null && photo.url)
                .map(photo => photo as { photo_reference: string, url: string, index: number });

            console.log(`Successfully loaded ${validPhotos.length} photos out of ${placeDetails.photos.length}`);
            setPhotos(validPhotos.map(({ photo_reference, url }) => ({ photo_reference, url })));
        } catch (err) {
            console.error('Error fetching place photos:', err);
        } finally {
            setLoadingPhotos(false);
        }
    }

    function handleNavigatePress() {
        if (placeId) {
            onStartNavigation(placeId);
            onClose();
        }
    }

    function handleImageError(index: number) {
        console.log(`Image loading error for index ${index}`);
        setFailedPhotoIndexes(prev => new Set([...prev, index]));
    }

    function handleWebsitePress() {
        if (placeDetails?.website) {
            Linking.openURL(placeDetails.website)
                .catch(err => console.error('Error opening website:', err));
        }
    }

    function handlePhonePress() {
        if (placeDetails?.formatted_phone_number) {
            Linking.openURL(`tel:${placeDetails.formatted_phone_number}`)
                .catch(err => console.error('Error opening phone:', err));
        }
    }

    function toggleShowAllHours() {
        setShowAllHours(!showAllHours);
    }

    // Function to render price level as dollar signs
    function renderPriceLevel(level: number) {
        if (!level && level !== 0) return null;

        const dollars = Array(4).fill('$').map((dollar, i) => (
            <Text
                key={i}
                style={{
                    color: i < level ? '#F1B24A' : isDark ? '#4a4a4a' : '#d1d1d1',
                    fontWeight: i < level ? 'bold' : 'normal'
                }}
            >
                $
            </Text>
        ));

        return (
            <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                {dollars}
            </View>
        );
    }

    // Function to render star rating
    function renderRating(rating: number) {
        if (!rating) return null;

        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

        return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {[...Array(fullStars)].map((_, i) => (
                    <Ionicons key={`full-${i}`} name="star" size={16} color="#F1B24A" />
                ))}
                {halfStar && <Ionicons name="star-half" size={16} color="#F1B24A" />}
                {[...Array(emptyStars)].map((_, i) => (
                    <Ionicons key={`empty-${i}`} name="star-outline" size={16} color="#F1B24A" />
                ))}
                <Text className={`ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {rating.toFixed(1)}
                </Text>
                {placeDetails.user_ratings_total > 0 && (
                    <Text className={`ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        ({placeDetails.user_ratings_total})
                    </Text>
                )}
            </View>
        );
    }

    function handleOpenReviewModal() {
        setReviewModalVisible(true);
    }

    function handleCloseReviewModal() {
        setReviewModalVisible(false);
    }

    function handleReviewSubmitted() {
        // Callback for when a review is successfully submitted
        // This will trigger a re-fetch of reviews in the parent component
    }

    // Add a function to calculate the overall accessibility score based on reviews
    function calculateAccessibilityScore(reviews: any[]): number {
        if (!reviews || reviews.length === 0) return 0;

        let totalScore = 0;
        let reviewCount = 0;

        // Calculate score for each review and sum them up
        reviews.forEach((review: any) => {
            let reviewScore = review.accessibilityRating;

            // If the review has an accessibilityScore, take the average
            if (review.accessibilityScore) {
                reviewScore = (reviewScore + review.accessibilityScore) / 2;
            }

            totalScore += reviewScore;
            reviewCount++;
        });

        // Return the average score rounded to the nearest 0.5
        return Math.round((totalScore / reviewCount) * 2) / 2;
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black bg-opacity-10">
                <View className={`rounded-t-3xl ${isDark ? 'bg-gray-900' : 'bg-white'} p-5 min-h-[50%] max-h-[75%]`}>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Place Details</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={isDark ? "white" : "black"} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View className="flex-1 justify-center items-center py-10">
                            <ActivityIndicator size="large" color="#F1B24A" />
                            <Text className={`mt-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                Loading place information...
                            </Text>
                        </View>
                    ) : error ? (
                        <View className="flex-1 justify-center items-center py-10">
                            <Ionicons name="alert-circle" size={48} color="red" />
                            <Text className="text-red-500 text-center mt-4">{error}</Text>
                        </View>
                    ) : placeDetails ? (
                        <ScrollView className="flex-1">
                            <View className="mb-5">
                                {/* Place name and address */}
                                <Text className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                    {placeDetails.name}
                                </Text>
                                <Text className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                                    {placeDetails.formatted_address}
                                </Text>

                                {/* Rating and price level */}
                                <View className="flex-row items-center mb-3">
                                    <Text className={`mr-2 font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                        Overall:
                                    </Text>
                                    {renderRating(placeDetails.rating)}
                                    {placeDetails.price_level !== undefined && renderPriceLevel(placeDetails.price_level)}
                                </View>

                                {/* Accessibility score */}
                                {locationReviews && locationReviews.length > 0 && (
                                    <View className="flex-row items-center mb-3">
                                        <Text className={`mr-2 font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                            Accessibility:
                                        </Text>
                                        <View className="flex-row">
                                            {[1, 2, 3, 4, 5].map((score) => {
                                                const accessibilityScore = calculateAccessibilityScore(locationReviews);
                                                const isHalf = accessibilityScore % 1 !== 0 && Math.ceil(accessibilityScore) === score;
                                                const isFull = score <= Math.floor(accessibilityScore);
                                                return (
                                                    <MaterialCommunityIcons
                                                        key={score}
                                                        name="wheelchair-accessibility"
                                                        size={20}
                                                        color={isFull ? '#F1B24A' : isHalf ? '#F1B24A' : isDark ? '#555' : '#ddd'}
                                                        style={isHalf ? { opacity: 0.5 } : {}}
                                                    />
                                                );
                                            })}
                                        </View>
                                        <Text className={`ml-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                            {calculateAccessibilityScore(locationReviews).toFixed(1)}
                                        </Text>
                                        <Text className={`ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            ({locationReviews.length})
                                        </Text>
                                    </View>
                                )}

                                {/* Place types */}
                                {placeDetails.types && placeDetails.types.length > 0 && (
                                    <View className="flex-row flex-wrap mb-3">
                                        {placeDetails.types.slice(0, 3).map((type: string, index: number) => (
                                            <View
                                                key={index}
                                                className={`mr-2 mb-1 px-2 py-1 rounded-md ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
                                            >
                                                <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                                    {type.replace(/_/g, ' ')}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Contact info */}
                                <View className="mb-4">
                                    {placeDetails.formatted_phone_number && (
                                        <TouchableOpacity
                                            className="flex-row items-center py-2"
                                            onPress={handlePhonePress}
                                        >
                                            <Ionicons name="call-outline" size={20} color={isDark ? "#F1B24A" : "#F1B24A"} />
                                            <Text className={`ml-2 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                                                {placeDetails.formatted_phone_number}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {placeDetails.website && (
                                        <TouchableOpacity
                                            className="flex-row items-center py-2"
                                            onPress={handleWebsitePress}
                                        >
                                            <Ionicons name="globe-outline" size={20} color={isDark ? "#F1B24A" : "#F1B24A"} />
                                            <Text
                                                className={`ml-2 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                                style={{ maxWidth: '90%' }}
                                            >
                                                {placeDetails.website.replace(/^https?:\/\//, '')}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Opening hours */}
                                {placeDetails.opening_hours && (
                                    <View className="mb-4">
                                        <View className="flex-row items-center">
                                            <Ionicons
                                                name="time-outline"
                                                size={20}
                                                color={isDark ? "#F1B24A" : "#F1B24A"}
                                            />
                                            <Text className={`ml-2 font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                                {placeDetails.opening_hours.open_now ? 'Open Now' : 'Closed Now'}
                                            </Text>
                                        </View>

                                        {placeDetails.opening_hours.weekday_text && placeDetails.opening_hours.weekday_text.length > 0 && (
                                            <View className="mt-1 ml-7">
                                                {(showAllHours ? placeDetails.opening_hours.weekday_text : placeDetails.opening_hours.weekday_text.slice(0, 2)).map((day: string, index: number) => (
                                                    <Text
                                                        key={index}
                                                        className={`${isDark ? 'text-gray-300' : 'text-gray-600'} py-1`}
                                                    >
                                                        {day}
                                                    </Text>
                                                ))}

                                                {placeDetails.opening_hours.weekday_text.length > 2 && (
                                                    <TouchableOpacity
                                                        onPress={toggleShowAllHours}
                                                        className="py-1"
                                                    >
                                                        <Text className={`${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                                                            {showAllHours ? 'Show less' : 'Show more'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Photos section */}
                                {placeDetails.photos && placeDetails.photos.length > 0 && (
                                    <View className="mt-4 mb-3">
                                        <Text className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>Photos</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {loadingPhotos ? (
                                                <View className="flex-row items-center justify-center">
                                                    <ActivityIndicator size="small" color="#F1B24A" />
                                                    <Text className={`ml-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        Loading photos...
                                                    </Text>
                                                </View>
                                            ) : photos.length > 0 ? (
                                                photos.map((photo, index) => (
                                                    !failedPhotoIndexes.has(index) && (
                                                        <View key={`photo-${index}`} className="mr-2">
                                                            <View className={`w-[200px] h-[150px] rounded-lg overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                                <Image
                                                                    source={{ uri: photo.url }}
                                                                    style={{ width: 200, height: 150 }}
                                                                    onError={(error) => {
                                                                        console.log(`🖼️ Image load error for photo ${index}:`, error);
                                                                        console.log(`🖼️ Failed URL: ${photo.url}`);
                                                                        handleImageError(index);
                                                                    }}
                                                                    onLoad={() => {
                                                                        console.log(`🖼️ Image loaded successfully for photo ${index}`);
                                                                    }}
                                                                    // Try to handle network issues with retries
                                                                    fadeDuration={300}
                                                                />
                                                            </View>
                                                        </View>
                                                    )
                                                ))
                                            ) : (
                                                <View className={`w-[200px] h-[150px] rounded-lg mr-2 flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                    <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>No photos available</Text>
                                                </View>
                                            )}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            {/* Reviews section */}
                            {locationReviews && locationReviews.length > 0 && (
                                <View className="mb-6">
                                    <Text className={`font-semibold text-lg mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                        Accessibility Reviews
                                    </Text>

                                    {/* Reviews list */}
                                    {(showAllReviews ? locationReviews : locationReviews.slice(0, 1)).map((review, index) => (
                                        <View key={review.id || index} className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                            <View className="flex-row items-center mb-2">
                                                <View className="flex-row">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <MaterialCommunityIcons
                                                            key={star}
                                                            name="wheelchair-accessibility"
                                                            size={18}
                                                            color={star <= review.accessibilityRating ? '#F1B24A' : isDark ? '#555' : '#ddd'}
                                                        />
                                                    ))}
                                                </View>
                                                <Text className={`ml-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {new Date(review.createdAt).toLocaleDateString()}
                                                </Text>
                                            </View>

                                            {/* User display name */}
                                            {(() => {
                                                // Handle the userId which might be a string ID or a populated user object
                                                const userInfo = review.userId as any;
                                                return userInfo && typeof userInfo === 'object' && userInfo.displayName ? (
                                                    <View className="flex-row items-center mb-2">
                                                        <Ionicons name="person-circle-outline" size={16} color={isDark ? '#F1B24A' : '#F1B24A'} />
                                                        <Text className={`ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium`}>
                                                            {userInfo.displayName}
                                                        </Text>
                                                    </View>
                                                ) : null;
                                            })()}

                                            {review.description && (
                                                <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                                                    {review.description}
                                                </Text>
                                            )}

                                            {/* Review photos */}
                                            {review.images && review.images.length > 0 && (
                                                <View className="mb-3">
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                        {review.images.map((imageUri, imgIndex) => (
                                                            <View key={imgIndex} className="mr-2 rounded-lg overflow-hidden" style={{
                                                                shadowColor: '#000',
                                                                shadowOffset: { width: 0, height: 2 },
                                                                shadowOpacity: 0.1,
                                                                shadowRadius: 2,
                                                                elevation: 2,
                                                            }}>
                                                                <ImageWithFallback
                                                                    uri={imageUri}
                                                                    style={{ width: 120, height: 90 }}
                                                                    resizeMode="cover"
                                                                />
                                                            </View>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            )}

                                            <View className="flex-row flex-wrap">
                                                {review.questions.ramp !== null && (
                                                    <View className={`mr-2 mb-1 px-2 py-1 rounded-md flex-row items-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                        <Ionicons name={review.questions.ramp ? "checkmark-circle" : "close-circle"} size={16} color={review.questions.ramp ? "green" : "red"} />
                                                        <Text className={`ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs`}>Ramp</Text>
                                                    </View>
                                                )}
                                                {review.questions.wideDoors !== null && (
                                                    <View className={`mr-2 mb-1 px-2 py-1 rounded-md flex-row items-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                        <Ionicons name={review.questions.wideDoors ? "checkmark-circle" : "close-circle"} size={16} color={review.questions.wideDoors ? "green" : "red"} />
                                                        <Text className={`ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs`}>Wide Doors</Text>
                                                    </View>
                                                )}
                                                {review.questions.elevator !== null && (
                                                    <View className={`mr-2 mb-1 px-2 py-1 rounded-md flex-row items-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                        <Ionicons name={review.questions.elevator ? "checkmark-circle" : "close-circle"} size={16} color={review.questions.elevator ? "green" : "red"} />
                                                        <Text className={`ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs`}>Elevator</Text>
                                                    </View>
                                                )}
                                                {review.questions.adaptedToilets !== null && (
                                                    <View className={`mr-2 mb-1 px-2 py-1 rounded-md flex-row items-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                        <Ionicons name={review.questions.adaptedToilets ? "checkmark-circle" : "close-circle"} size={16} color={review.questions.adaptedToilets ? "green" : "red"} />
                                                        <Text className={`ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs`}>Accessible Toilets</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    ))}

                                    {/* Show all reviews link */}
                                    {locationReviews.length > 1 && (
                                        <TouchableOpacity
                                            onPress={() => setShowAllReviews(!showAllReviews)}
                                            className="py-2"
                                        >
                                            <Text className={`${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                                                {showAllReviews ? 'Show less' : `Show all ${locationReviews.length} reviews`}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* Navigate and Review buttons */}
                            <View className="flex-row justify-between space-x-4 mt-2 mb-2">
                                <TouchableOpacity
                                    className="flex-1 bg-primary rounded-lg py-3 mr-5 items-center"
                                    onPress={handleOpenReviewModal}
                                >
                                    <Text className="text-white font-semibold">Leave a Review</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="flex-1 bg-[#F1B24A] rounded-lg py-3 items-center"
                                    onPress={handleNavigatePress}
                                >
                                    <Text className="text-white font-semibold">Navigate to this place</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    ) : (
                        <View className="flex-1 justify-center items-center py-10">
                            <Text className={`text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                No place information available
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Review Modal */}
            <ReviewModal
                visible={reviewModalVisible}
                onClose={handleCloseReviewModal}
                placeDetails={placeDetails}
                onReviewSubmitted={handleReviewSubmitted}
            />
        </Modal>
    );
} 