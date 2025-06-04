import api from "@/services/api.service";
import { Review, ReviewCreate, ReviewUpdate } from "./review.store";
import axios, { AxiosError } from "axios";

// Interface for API error responses
interface ApiErrorResponse {
    message?: string;
}

/**
 * Service for review-related API calls
 */
export const ReviewService = {
    /**
     * Get all reviews
     */
    async getReviews(): Promise<{ reviews: Review[] }> {
        try {
            const response = await api.get("/api/reviews");
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<ApiErrorResponse>;
                const errorMessage = axiosError.response?.data?.message ||
                    "Failed to fetch reviews";

                if (axiosError.response?.status === 401) {
                    throw new Error(`Authentication Error: ${errorMessage}`);
                } else if (
                    axiosError.response?.status &&
                    axiosError.response.status >= 500
                ) {
                    throw new Error(`Server Error: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Get reviews for a specific user
     */
    async getUserReviews(userId: string): Promise<{ reviews: Review[] }> {
        try {
            const response = await api.get(`/api/reviews/user/${userId}`);
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<ApiErrorResponse>;
                const errorMessage = axiosError.response?.data?.message ||
                    "Failed to fetch user reviews";

                if (axiosError.response?.status === 401) {
                    throw new Error(`Authentication Error: ${errorMessage}`);
                } else if (axiosError.response?.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (
                    axiosError.response?.status &&
                    axiosError.response.status >= 500
                ) {
                    throw new Error(`Server Error: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Get reviews for a specific location
     */
    async getLocationReviews(
        latitude: number,
        longitude: number,
    ): Promise<{ reviews: Review[] }> {
        try {
            const response = await api.get(
                `/api/reviews/location?lat=${latitude}&lng=${longitude}`,
            );
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<ApiErrorResponse>;
                const errorMessage = axiosError.response?.data?.message ||
                    "Failed to fetch location reviews";

                if (axiosError.response?.status === 401) {
                    throw new Error(`Authentication Error: ${errorMessage}`);
                } else if (
                    axiosError.response?.status &&
                    axiosError.response.status >= 500
                ) {
                    throw new Error(`Server Error: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Get reviews for a specific place using Google Places API ID
     */
    async getPlaceReviews(placeId: string): Promise<{ reviews: Review[] }> {
        try {
            const response = await api.get(`/api/reviews/place/${placeId}`);
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<ApiErrorResponse>;
                const errorMessage = axiosError.response?.data?.message ||
                    "Failed to fetch place reviews";

                if (axiosError.response?.status === 401) {
                    throw new Error(`Authentication Error: ${errorMessage}`);
                } else if (
                    axiosError.response?.status &&
                    axiosError.response.status >= 500
                ) {
                    throw new Error(`Server Error: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Create a new review
     */
    async createReview(
        review: ReviewCreate,
    ): Promise<{ review: Review; message: string }> {
        try {
            const response = await api.post("/api/reviews", review);
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<ApiErrorResponse>;
                const errorMessage = axiosError.response?.data?.message ||
                    "Failed to create review";

                if (axiosError.response?.status === 400) {
                    throw new Error(`Validation Error: ${errorMessage}`);
                } else if (axiosError.response?.status === 401) {
                    throw new Error(`Authentication Error: ${errorMessage}`);
                } else if (
                    axiosError.response?.status &&
                    axiosError.response.status >= 500
                ) {
                    throw new Error(`Server Error: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Update an existing review
     */
    async updateReview(
        reviewId: string,
        review: ReviewUpdate,
    ): Promise<{ review: Review; message: string }> {
        try {
            const response = await api.put(`/api/reviews/${reviewId}`, review);
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<ApiErrorResponse>;
                const errorMessage = axiosError.response?.data?.message ||
                    "Failed to update review";

                if (axiosError.response?.status === 400) {
                    throw new Error(`Validation Error: ${errorMessage}`);
                } else if (axiosError.response?.status === 401) {
                    throw new Error(`Authentication Error: ${errorMessage}`);
                } else if (axiosError.response?.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (axiosError.response?.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                } else if (
                    axiosError.response?.status &&
                    axiosError.response.status >= 500
                ) {
                    throw new Error(`Server Error: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Delete a review
     */
    async deleteReview(reviewId: string): Promise<{ message: string }> {
        try {
            const response = await api.delete(`/api/reviews/${reviewId}`);
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<ApiErrorResponse>;
                const errorMessage = axiosError.response?.data?.message ||
                    "Failed to delete review";

                if (axiosError.response?.status === 401) {
                    throw new Error(`Authentication Error: ${errorMessage}`);
                } else if (axiosError.response?.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (axiosError.response?.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                } else if (
                    axiosError.response?.status &&
                    axiosError.response.status >= 500
                ) {
                    throw new Error(`Server Error: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },
};
