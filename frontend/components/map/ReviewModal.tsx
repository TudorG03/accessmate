import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Image, TextInput, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/stores/theme/useTheme';
import * as ImagePicker from 'expo-image-picker';
import { useReview } from '@/stores/review';

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
    locationName: string;
    location: {
        latitude: number;
        longitude: number;
    };
}

interface ReviewModalProps {
    visible: boolean;
    onClose: () => void;
    placeDetails: any;
    onReviewSubmitted: () => void;
}

export default function ReviewModal({
    visible,
    onClose,
    placeDetails,
    onReviewSubmitted
}: ReviewModalProps) {
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
        locationName: '',
        location: {
            latitude: 0,
            longitude: 0
        }
    });
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewError, setReviewError] = useState('');

    const { isDark } = useTheme();
    const {
        createReview,
        error: reviewStoreError,
        clearError,
        fetchLocationReviews
    } = useReview();

    // Reset form when modal opens with new place details
    React.useEffect(() => {
        if (placeDetails && visible) {
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
                locationName: placeDetails.name || '',
                location: {
                    latitude: placeDetails.geometry?.location.lat || 0,
                    longitude: placeDetails.geometry?.location.lng || 0
                }
            });
        }
    }, [placeDetails, visible]);

    function handleCloseReviewModal() {
        onClose();
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
            locationName: '',
            location: {
                latitude: 0,
                longitude: 0
            }
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
                console.log(`📸 Place review image - base64 available: ${!!selectedImage.base64}, uri: ${selectedImage.uri}`);

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
        try {
            setReviewLoading(true);
            setReviewError('');

            if (!placeDetails) {
                setReviewError('Unable to determine location. Please try again.');
                setReviewLoading(false);
                return;
            }

            // Create the review data from the form
            const reviewData = {
                placeId: placeDetails.place_id, // Include Google Places API ID
                accessibilityRating: reviewForm.accessibilityRating,
                description: reviewForm.description,
                images: reviewForm.images,
                questions: reviewForm.questions,
                locationName: placeDetails.name,
                location: {
                    latitude: placeDetails.geometry.location.lat,
                    longitude: placeDetails.geometry.location.lng
                }
            };

            // Validate required fields before submission
            if (!reviewData.accessibilityRating) {
                setReviewError('Please provide an overall accessibility rating');
                setReviewLoading(false);
                return;
            }

            // Submit the review
            const result = await createReview(reviewData);

            if (result) {
                // Fetch the updated reviews for this location
                await fetchLocationReviews(
                    placeDetails.geometry.location.lat,
                    placeDetails.geometry.location.lng
                );

                // Show success feedback and close modal
                Alert.alert(
                    "Review Submitted",
                    "Thank you for your review! Your contribution helps make places more accessible for everyone.",
                    [{ text: "OK", onPress: () => {
                        handleCloseReviewModal();
                        onReviewSubmitted();
                    }}]
                );
            } else if (reviewStoreError) {
                // If there was an error from the store, show it
                setReviewError(reviewStoreError);
                clearError(); // Clear the store error
            }
        } catch (error) {
            console.error('Error submitting review:', error);
            setReviewError(error instanceof Error ? error.message : 'Failed to submit review. Please try again.');
        } finally {
            setReviewLoading(false);
        }
    }

    return (
        <Modal
            visible={visible}
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
    );
} 