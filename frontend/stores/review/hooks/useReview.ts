import { useCallback, useState } from "react";
import { useReviewStore } from "../review.store";
import { Review, ReviewCreate, ReviewUpdate } from "../review.store";
import * as Location from "expo-location";

/**
 * Custom hook for working with reviews
 */
export const useReview = () => {
    const {
        reviews,
        userReviews,
        locationReviews,
        isLoading,
        error,
        fetchReviews,
        fetchUserReviews,
        fetchLocationReviews,
        createReview,
        updateReview,
        deleteReview,
        clearError,
    } = useReviewStore();

    // Local state for tracking fetch results
    const [lastFetchedReviews, setLastFetchedReviews] = useState<Review[]>([]);

    /**
     * Creates a review for the current location
     */
    const createReviewAtCurrentLocation = useCallback(
        async (
            reviewData: Omit<ReviewCreate, "location"> & {
                placeId?: string | null;
            },
        ) => {
            try {
                console.log("📝 Starting review creation at current location");

                // Request location permissions if needed
                const { status } = await Location
                    .requestForegroundPermissionsAsync();

                console.log("📝 Location permission status:", status);

                if (status !== "granted") {
                    console.error("📝 Location permission not granted");
                    throw new Error("Location permission not granted");
                }

                // Attempt to get current location with timeout handling
                let currentLocation = null;
                try {
                    console.log("📝 Getting current location with timeout");

                    // Create a promise that rejects after 10 seconds
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(
                            () =>
                                reject(new Error("Location request timed out")),
                            10000,
                        );
                    });

                    // Race the location request against the timeout
                    const locationPromise = Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });

                    currentLocation = await Promise.race([
                        locationPromise,
                        timeoutPromise,
                    ]);
                    console.log("📝 Got current location:", currentLocation);
                } catch (locationError) {
                    console.error(
                        "📝 Error getting current location:",
                        locationError,
                    );

                    // Fallback to last known location
                    console.log(
                        "📝 Attempting to get last known location as fallback",
                    );
                    const lastLocation = await Location
                        .getLastKnownPositionAsync();

                    if (!lastLocation) {
                        console.error("📝 No last known location available");
                        throw new Error(
                            "Could not determine your location. Please try again in an open area.",
                        );
                    }

                    console.log("📝 Using last known location:", lastLocation);
                    currentLocation = lastLocation;
                }

                if (!currentLocation || !currentLocation.coords) {
                    console.error("📝 Location is null or missing coordinates");
                    throw new Error(
                        "Could not determine your location coordinates.",
                    );
                }

                // Create the review with current location
                const { placeId, ...rest } = reviewData;
                const fullReviewData: ReviewCreate = {
                    ...rest,
                    location: {
                        latitude: currentLocation.coords.latitude,
                        longitude: currentLocation.coords.longitude,
                    },
                };

                console.log(
                    "📝 Submitting review with location:",
                    fullReviewData.location,
                );

                const newReview = await createReview(fullReviewData);
                console.log("📝 Review creation result:", newReview);

                if (newReview) {
                    // Refresh the reviews lists
                    console.log(
                        "📝 Refreshing reviews after successful creation",
                    );
                    await fetchReviews();
                    await fetchUserReviews();
                }

                return newReview;
            } catch (error) {
                console.error(
                    "📝 Error creating review at current location:",
                    error,
                );
                // Rethrow the error so it can be handled by the caller
                throw error;
            }
        },
        [createReview, fetchReviews, fetchUserReviews],
    );

    /**
     * Fetches reviews for a specific location
     */
    const findReviewsForLocation = useCallback(
        async (latitude: number, longitude: number) => {
            try {
                await fetchLocationReviews(latitude, longitude);
                setLastFetchedReviews(locationReviews);
                return locationReviews;
            } catch (error) {
                console.error("Error finding location reviews:", error);
                setLastFetchedReviews([]);
                return [];
            }
        },
        [fetchLocationReviews, locationReviews],
    );

    /**
     * Prepares data for a new review based on place details
     */
    const prepareReviewFromPlaceDetails = useCallback(
        (placeDetails: any): Partial<ReviewCreate> => {
            if (!placeDetails) return {};

            return {
                locationName: placeDetails.name || "",
                location: placeDetails.geometry?.location
                    ? {
                        latitude: placeDetails.geometry.location.lat,
                        longitude: placeDetails.geometry.location.lng,
                    }
                    : undefined,
            };
        },
        [],
    );

    return {
        // State
        reviews: Array.isArray(reviews) ? reviews : [],
        userReviews: Array.isArray(userReviews) ? userReviews : [],
        locationReviews: Array.isArray(locationReviews) ? locationReviews : [],
        lastFetchedReviews: Array.isArray(lastFetchedReviews)
            ? lastFetchedReviews
            : [],
        isLoading,
        error,

        // Core actions
        fetchReviews,
        fetchUserReviews,
        fetchLocationReviews,
        createReview,
        updateReview,
        deleteReview,
        clearError,

        // Helper functions
        createReviewAtCurrentLocation,
        findReviewsForLocation,
        prepareReviewFromPlaceDetails,
    };
};
