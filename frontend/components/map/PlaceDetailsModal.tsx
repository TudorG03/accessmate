import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView, Image, Linking, StyleSheet, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';
import { getPlaceDetails, getPlacePhoto } from '@/services/places.service';
import * as ImagePicker from 'expo-image-picker';

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

interface ReviewFormState {
    accessibilityRating: number;
    description: string;
    images: string[];
    questions: {
        ramp: boolean | null;
        wideDoors: boolean | null;
        elevator: boolean | null;
        adaptedToilets: boolean | null;
    };
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
    const [reviewForm, setReviewForm] = useState<ReviewFormState>({
        accessibilityRating: 0,
        description: '',
        images: [],
        questions: {
            ramp: null,
            wideDoors: null,
            elevator: null,
            adaptedToilets: null,
        },
    });
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewError, setReviewError] = useState('');

    const { isDark } = useTheme();

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
                .filter(photo => photo && photo.photo_reference) // Ensure we have valid photo references
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
                <Text className={`ml-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>
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
        setReviewForm({
            accessibilityRating: 0,
            description: '',
            images: [],
            questions: {
                ramp: null,
                wideDoors: null,
                elevator: null,
                adaptedToilets: null,
            },
        });
        setReviewError('');
    }
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
                if (selectedImage.uri) {
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
        setReviewLoading(true);
        setReviewError('');
        // TODO: Implement review submission logic (API call)
        setTimeout(() => {
            setReviewLoading(false);
            setReviewModalVisible(false);
        }, 1000);
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
                                    {renderRating(placeDetails.rating)}
                                    {placeDetails.price_level !== undefined && renderPriceLevel(placeDetails.price_level)}
                                </View>

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
                                                                    onError={() => handleImageError(index)}
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
                            <Text className={`text-3xl font-bold text-center ${isDark ? 'text-white' : 'text-gray-800'} my-4`}>Write an <Text className="text-primary">AccessView</Text></Text>
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
                                                <Ionicons name="checkmark" size={22} color={reviewForm.questions.ramp === true ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleReviewQuestionChange('ramp', false)} className="rounded-full p-1 active:bg-primary/20">
                                                <Ionicons name="close" size={22} color={reviewForm.questions.ramp === false ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center justify-between">
                                        <Text className={`text-base flex-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Are the doors wide enough for a wheelchair?</Text>
                                        <View className="flex-row space-x-2 ml-4 min-w-[60px] justify-end">
                                            <TouchableOpacity onPress={() => handleReviewQuestionChange('wideDoors', true)} className="rounded-full p-1 active:bg-primary/20">
                                                <Ionicons name="checkmark" size={22} color={reviewForm.questions.wideDoors === true ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleReviewQuestionChange('wideDoors', false)} className="rounded-full p-1 active:bg-primary/20">
                                                <Ionicons name="close" size={22} color={reviewForm.questions.wideDoors === false ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center justify-between">
                                        <Text className={`text-base flex-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Is there a functional elevator to access all floors (if applicable)?</Text>
                                        <View className="flex-row space-x-2 ml-4 min-w-[60px] justify-end">
                                            <TouchableOpacity onPress={() => handleReviewQuestionChange('elevator', true)} className="rounded-full p-1 active:bg-primary/20">
                                                <Ionicons name="checkmark" size={22} color={reviewForm.questions.elevator === true ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleReviewQuestionChange('elevator', false)} className="rounded-full p-1 active:bg-primary/20">
                                                <Ionicons name="close" size={22} color={reviewForm.questions.elevator === false ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center justify-between">
                                        <Text className={`text-base flex-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Are there accessible toilets?</Text>
                                        <View className="flex-row space-x-2 ml-4 min-w-[60px] justify-end">
                                            <TouchableOpacity onPress={() => handleReviewQuestionChange('adaptedToilets', true)} className="rounded-full p-1 active:bg-primary/20">
                                                <Ionicons name="checkmark" size={22} color={reviewForm.questions.adaptedToilets === true ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleReviewQuestionChange('adaptedToilets', false)} className="rounded-full p-1 active:bg-primary/20">
                                                <Ionicons name="close" size={22} color={reviewForm.questions.adaptedToilets === false ? '#F1B24A' : isDark ? '#555' : '#bbb'} />
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
                                                    name="human-cane"
                                                    size={32}
                                                    color={reviewForm.accessibilityRating >= level ? '#F1B24A' : isDark ? '#555' : '#bbb'}
                                                />
                                            );
                                        } else if (level === 4 || level === 5) {
                                            iconComponent = (
                                                <MaterialCommunityIcons
                                                    name="wheelchair-accessibility"
                                                    size={32}
                                                    color={reviewForm.accessibilityRating >= level ? '#F1B24A' : isDark ? '#555' : '#bbb'}
                                                />
                                            );
                                        } else {
                                            iconComponent = (
                                                <Ionicons
                                                    name="accessibility"
                                                    size={32}
                                                    color={reviewForm.accessibilityRating >= level ? '#F1B24A' : isDark ? '#555' : '#bbb'}
                                                />
                                            );
                                        }
                                        return (
                                            <TouchableOpacity key={level} onPress={() => handleReviewRatingChange(level)} className="rounded-full p-1 active:bg-primary/20">
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
                                        <View key={uri} className="w-[80px] h-[80px] m-1 relative rounded-lg overflow-hidden" style={{
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
                                            <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
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
                                <Text className="text-white font-semibold text-lg tracking-wide">{reviewLoading ? 'Submitting...' : 'Submit'}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
} 