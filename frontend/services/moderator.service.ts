import api from "@/services/api.service";

// Review interfaces - extended from existing review types
export interface ModeratorReview {
    _id: string;
    userId: {
        _id: string;
        displayName: string;
        email: string;
    };
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
    accessibilityScore: number;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateReviewRequest {
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

export interface ReviewsResponse {
    message: string;
    reviews: ModeratorReview[];
    total?: number;
    page?: number;
    limit?: number;
}

export interface ReviewResponse {
    message: string;
    review: ModeratorReview;
}

export interface ReviewStatsResponse {
    message: string;
    stats: {
        total: number;
        byRating: Record<string, number>;
        recentCount: number;
        topLocations: Array<{
            locationName: string;
            count: number;
        }>;
    };
}

/**
 * Service for moderator review management API calls
 */
export const ModeratorService = {
    /**
     * Get all reviews (moderator/admin only)
     */
    async getAllReviews(): Promise<ReviewsResponse> {
        try {
            const response = await api.get("/api/reviews/");
            return response.data;
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to fetch reviews";
                
                if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (error.response.status === 401) {
                    throw new Error(`Authentication Error: ${errorMessage}`);
                }
                
                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Get reviews by user ID (moderator oversight)
     */
    async getUserReviews(userId: string): Promise<ReviewsResponse> {
        try {
            const response = await api.get(`/api/reviews/user/${userId}`);
            return response.data;
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to fetch user reviews";
                
                if (error.response.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                } else if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                }
                
                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Update review (moderator operation)
     */
    async updateReview(reviewId: string, reviewData: UpdateReviewRequest): Promise<ReviewResponse> {
        try {
            const response = await api.put(`/api/reviews/${reviewId}`, reviewData);
            return response.data;
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to update review";
                
                if (error.response.status === 400) {
                    throw new Error(`Validation Error: ${errorMessage}`);
                } else if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (error.response.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                }
                
                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Delete review (moderator only)
     */
    async deleteReview(reviewId: string): Promise<{ message: string }> {
        try {
            const response = await api.delete(`/api/reviews/${reviewId}`);
            return response.data;
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to delete review";
                
                if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (error.response.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                }
                
                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Get review statistics for moderator dashboard
     */
    async getReviewStats(): Promise<ReviewStatsResponse> {
        try {
            // Since there's no dedicated stats endpoint, we'll get all reviews and compute stats
            const response = await this.getAllReviews();
            const reviews = response.reviews;
            
            // Compute basic statistics
            const total = reviews.length;
            const byRating: Record<string, number> = {};
            const locationCounts: Record<string, number> = {};
            
            // Calculate rating distribution and location counts
            reviews.forEach(review => {
                const rating = Math.floor(review.accessibilityRating);
                byRating[rating] = (byRating[rating] || 0) + 1;
                
                if (review.locationName) {
                    locationCounts[review.locationName] = (locationCounts[review.locationName] || 0) + 1;
                }
            });
            
            // Get top locations
            const topLocations = Object.entries(locationCounts)
                .map(([locationName, count]) => ({ locationName, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            
            // Count recent reviews (last 7 days)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const recentCount = reviews.filter(review => 
                new Date(review.createdAt) > weekAgo
            ).length;
            
            return {
                message: "Review statistics retrieved successfully",
                stats: {
                    total,
                    byRating,
                    recentCount,
                    topLocations,
                }
            };
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to fetch review statistics";
                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Search reviews by criteria
     */
    async searchReviews(searchParams: {
        query?: string;
        minRating?: number;
        maxRating?: number;
        location?: string;
        userId?: string;
        fromDate?: string;
        toDate?: string;
    }): Promise<ReviewsResponse> {
        try {
            // Get all reviews first (since backend doesn't have search endpoint)
            const response = await this.getAllReviews();
            let filteredReviews = response.reviews;
            
            // Apply client-side filtering
            if (searchParams.query) {
                const query = searchParams.query.toLowerCase();
                filteredReviews = filteredReviews.filter(review =>
                    review.locationName.toLowerCase().includes(query) ||
                    review.description.toLowerCase().includes(query) ||
                    review.userId.displayName.toLowerCase().includes(query) ||
                    review.userId.email.toLowerCase().includes(query)
                );
            }
            
            if (searchParams.minRating !== undefined) {
                filteredReviews = filteredReviews.filter(review =>
                    review.accessibilityRating >= searchParams.minRating!
                );
            }
            
            if (searchParams.maxRating !== undefined) {
                filteredReviews = filteredReviews.filter(review =>
                    review.accessibilityRating <= searchParams.maxRating!
                );
            }
            
            if (searchParams.location) {
                filteredReviews = filteredReviews.filter(review =>
                    review.locationName.toLowerCase().includes(searchParams.location!.toLowerCase())
                );
            }
            
            if (searchParams.userId) {
                filteredReviews = filteredReviews.filter(review =>
                    review.userId._id === searchParams.userId
                );
            }
            
            if (searchParams.fromDate) {
                const fromDate = new Date(searchParams.fromDate);
                filteredReviews = filteredReviews.filter(review =>
                    new Date(review.createdAt) >= fromDate
                );
            }
            
            if (searchParams.toDate) {
                const toDate = new Date(searchParams.toDate);
                filteredReviews = filteredReviews.filter(review =>
                    new Date(review.createdAt) <= toDate
                );
            }
            
            return {
                message: "Reviews filtered successfully",
                reviews: filteredReviews,
                total: filteredReviews.length,
            };
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to search reviews";
                throw new Error(errorMessage);
            }
            throw error;
        }
    }
}; 