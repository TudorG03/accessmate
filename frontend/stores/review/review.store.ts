import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";
import { router } from "expo-router";
import { Alert } from "react-native";
import { useAuthStore } from "../auth/auth.store";
import { getUserId, isAuthenticated } from "../auth/auth.utils";
import { ReviewService } from "./review.service";

// Define the Review interface to match backend model
export interface Review {
    id: string;
    userId: string;
    placeId: string; // Google Places API ID
    location: {
        latitude: number;
        longitude: number;
    };
    locationName: string;
    accessibilityRating: number;
    description: string;
    images: string[];
    questions: {
        ramp: boolean | null;
        wideDoors: boolean | null;
        elevator: boolean | null;
        adaptedToilets: boolean | null;
    };
    createdAt: string;
    updatedAt: string;
}

// Define the data needed to create a review
export interface ReviewCreate {
    placeId: string; // Google Places API ID (required)
    location: {
        latitude: number;
        longitude: number;
    };
    locationName: string;
    accessibilityRating: number;
    description?: string;
    images?: string[];
    questions: {
        ramp: boolean | null;
        wideDoors: boolean | null;
        elevator: boolean | null;
        adaptedToilets: boolean | null;
    };
}

// Define the data needed to update a review
export interface ReviewUpdate {
    locationName?: string;
    accessibilityRating?: number;
    description?: string;
    images?: string[];
    questions?: {
        ramp?: boolean | null;
        wideDoors?: boolean | null;
        elevator?: boolean | null;
        adaptedToilets?: boolean | null;
    };
}

// Storage setup for persisting reviews
const storage = new MMKV({
    id: "reviews-storage",
});

// Functions to get and set items in MMKV storage
const mmkvStorage = {
    getItem: (name: string) => {
        const value = storage.getString(name);
        return value ? value : null;
    },
    setItem: (name: string, value: string) => {
        storage.set(name, value);
    },
    removeItem: (name: string) => {
        storage.delete(name);
    },
};

// Handle authentication errors
const handleAuthError = (error: unknown) => {
    // Check if it's an authentication error
    if (
        (error instanceof Error &&
            error.message.includes("Authentication failed")) ||
        (error instanceof Error && error.message.includes("401"))
    ) {
        // Clear auth state
        useAuthStore.getState().logout();

        // Show error and redirect
        Alert.alert(
            "Session Expired",
            "Your session has expired. Please log in again.",
            [
                {
                    text: "OK",
                    onPress: () => router.replace("/"),
                },
            ],
        );
        return true;
    }
    return false;
};

// Define the review store state
interface ReviewState {
    // Review data
    reviews: Review[];
    userReviews: Review[];
    locationReviews: Review[];
    placeReviews: Review[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchReviews: () => Promise<void>;
    fetchUserReviews: () => Promise<void>;
    fetchLocationReviews: (
        latitude: number,
        longitude: number,
    ) => Promise<void>;
    fetchPlaceReviews: (placeId: string) => Promise<void>;
    createReview: (review: ReviewCreate) => Promise<Review | null>;
    updateReview: (
        reviewId: string,
        review: ReviewUpdate,
    ) => Promise<Review | null>;
    deleteReview: (reviewId: string) => Promise<boolean>;
    clearError: () => void;
}

// Create the Zustand store with persistence
export const useReviewStore = create<ReviewState>()(
    persist(
        (set, get) => ({
            // State
            reviews: [],
            userReviews: [],
            locationReviews: [],
            placeReviews: [],
            isLoading: false,
            error: null,

            // Actions
            fetchReviews: async () => {
                try {
                    // Check if user is authenticated before making the API call
                    if (!(await isAuthenticated())) {
                        console.log(
                            "User not authenticated, skipping reviews fetch",
                        );
                        set({ reviews: [], isLoading: false });
                        return;
                    }

                    set({ isLoading: true, error: null });
                    const { reviews } = await ReviewService.getReviews();
                    set({
                        reviews: Array.isArray(reviews) ? reviews : [],
                        isLoading: false,
                    });
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to fetch reviews",
                        reviews: [], // Reset reviews on error
                    });
                }
            },

            fetchUserReviews: async () => {
                try {
                    // Check if user is authenticated before making the API call
                    if (!(await isAuthenticated())) {
                        console.log(
                            "User not authenticated, skipping user reviews fetch",
                        );
                        set({ userReviews: [], isLoading: false });
                        return;
                    }

                    set({ isLoading: true, error: null });
                    const userId = await getUserId();

                    if (!userId) {
                        console.log(
                            "No user ID available, skipping user reviews fetch",
                        );
                        set({ userReviews: [], isLoading: false });
                        return;
                    }

                    const { reviews: userReviews } = await ReviewService
                        .getUserReviews(userId);

                    // Debug: Log the fetched reviews data
                    console.log("🔍 Fetched user reviews:", {
                        count: userReviews?.length || 0,
                        reviews: userReviews?.map((review: any) => ({
                            id: review.id || review._id,
                            hasImages:
                                !!(review.images && review.images.length > 0),
                            imageCount: review.images?.length || 0,
                            firstImageType: review.images?.[0]
                                ? (review.images[0].startsWith("data:")
                                    ? "base64"
                                    : review.images[0].startsWith("file:")
                                    ? "file"
                                    : review.images[0].startsWith("http")
                                    ? "url"
                                    : "unknown")
                                : "none",
                        })) || [],
                    });

                    set({
                        userReviews: Array.isArray(userReviews)
                            ? userReviews
                            : [],
                        isLoading: false,
                    });
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to fetch user reviews",
                        userReviews: [], // Reset user reviews on error
                    });
                }
            },

            fetchLocationReviews: async (latitude, longitude) => {
                try {
                    // Check if user is authenticated before making the API call
                    if (!(await isAuthenticated())) {
                        console.log(
                            "User not authenticated, skipping location reviews fetch",
                        );
                        set({ locationReviews: [], isLoading: false });
                        return;
                    }

                    set({ isLoading: true, error: null });
                    const { reviews: locationReviews } = await ReviewService
                        .getLocationReviews(latitude, longitude);
                    set({
                        locationReviews: Array.isArray(locationReviews)
                            ? locationReviews
                            : [],
                        isLoading: false,
                    });
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to fetch location reviews",
                        locationReviews: [], // Reset location reviews on error
                    });
                }
            },

            fetchPlaceReviews: async (placeId) => {
                try {
                    // Check if user is authenticated before making the API call
                    if (!(await isAuthenticated())) {
                        console.log(
                            "User not authenticated, skipping place reviews fetch",
                        );
                        set({ placeReviews: [], isLoading: false });
                        return;
                    }

                    set({ isLoading: true, error: null });
                    const { reviews: placeReviews } = await ReviewService
                        .getPlaceReviews(placeId);
                    set({
                        placeReviews: Array.isArray(placeReviews)
                            ? placeReviews
                            : [],
                        isLoading: false,
                    });
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to fetch place reviews",
                        placeReviews: [], // Reset place reviews on error
                    });
                }
            },

            createReview: async (review) => {
                try {
                    // Check if user is authenticated before making the API call
                    if (!(await isAuthenticated())) {
                        console.log(
                            "User not authenticated, skipping review creation",
                        );
                        set({ error: "Authentication required" });
                        return null;
                    }

                    set({ isLoading: true, error: null });
                    const { review: newReview } = await ReviewService
                        .createReview(review);

                    // Update state with new review
                    set((state) => ({
                        reviews: [...state.reviews, newReview],
                        userReviews: [...state.userReviews, newReview],
                        isLoading: false,
                    }));

                    return newReview;
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return null;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to create review",
                    });
                    return null;
                }
            },

            updateReview: async (reviewId, review) => {
                try {
                    // Check if user is authenticated before making the API call
                    if (!(await isAuthenticated())) {
                        console.log(
                            "User not authenticated, skipping review update",
                        );
                        set({ error: "Authentication required" });
                        return null;
                    }

                    set({ isLoading: true, error: null });
                    const { review: updatedReview } = await ReviewService
                        .updateReview(reviewId, review);

                    // Update state with the updated review
                    set((state) => ({
                        reviews: state.reviews.map((r) =>
                            r.id === reviewId ? updatedReview : r
                        ),
                        userReviews: state.userReviews.map((r) =>
                            r.id === reviewId ? updatedReview : r
                        ),
                        locationReviews: state.locationReviews.map((r) =>
                            r.id === reviewId ? updatedReview : r
                        ),
                        placeReviews: state.placeReviews.map((r) =>
                            r.id === reviewId ? updatedReview : r
                        ),
                        isLoading: false,
                    }));

                    return updatedReview;
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return null;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to update review",
                    });
                    return null;
                }
            },

            deleteReview: async (reviewId) => {
                try {
                    // Check if user is authenticated before making the API call
                    if (!(await isAuthenticated())) {
                        console.log(
                            "User not authenticated, skipping review deletion",
                        );
                        set({ error: "Authentication required" });
                        return false;
                    }

                    set({ isLoading: true, error: null });
                    await ReviewService.deleteReview(reviewId);

                    // Remove the deleted review from state
                    set((state) => ({
                        reviews: state.reviews.filter((r) => r.id !== reviewId),
                        userReviews: state.userReviews.filter((r) =>
                            r.id !== reviewId
                        ),
                        locationReviews: state.locationReviews.filter((r) =>
                            r.id !== reviewId
                        ),
                        placeReviews: state.placeReviews.filter((r) =>
                            r.id !== reviewId
                        ),
                        isLoading: false,
                    }));

                    return true;
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return false;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to delete review",
                    });
                    return false;
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: "review-storage",
            storage: createJSONStorage(() => mmkvStorage),
            partialize: (state) => ({
                reviews: state.reviews,
                userReviews: state.userReviews,
                placeReviews: state.placeReviews,
            }),
        },
    ),
);
