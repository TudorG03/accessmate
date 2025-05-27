import {
    Marker,
    MarkerCreate,
    MarkerLocation,
    MarkerUpdate,
} from "@/types/marker.types";
import api from "@/services/api.service";

// Utility function to standardize API response handling
const processApiResponse = (response: any): Marker[] => {
    if (!response || !response.data) return [];

    // Extract markers from response based on structure
    const data = response.data.markers || response.data;
    return Array.isArray(data) ? data.map(formatMarker) : [];
};

// Format marker to ensure consistent properties
const formatMarker = (marker: any): Marker => {
    return {
        id: marker.id || marker._id || "",
        userId: marker.userId?.toString() || "",
        location: {
            latitude: Number(marker.location?.latitude) || 0,
            longitude: Number(marker.location?.longitude) || 0,
        },
        obstacleType: marker.obstacleType || "",
        obstacleScore: Number(marker.obstacleScore) || 1,
        notThere: Number(marker.notThere) || 0,
        description: marker.description || "",
        images: Array.isArray(marker.images) ? marker.images : [],
        createdAt: marker.createdAt || new Date().toISOString(),
        updatedAt: marker.updatedAt || new Date().toISOString(),
    };
};

export const MarkerService = {
    /**
     * Get all markers
     */
    async getMarkers(): Promise<Marker[]> {
        try {
            console.log("🔍 Fetching all markers from API...");
            const response = await api.get("/api/markers");
            console.log("🔍 API Response for getMarkers:", response);

            const markers = processApiResponse(response);
            console.log(`🔍 Found ${markers.length} formatted markers`);

            return markers;
        } catch (error) {
            console.error("🔍 Error fetching markers:", error);
            if (error.response) {
                console.error(
                    "🔍 Error response:",
                    error.response.status,
                    error.response.data,
                );
                throw new Error(
                    error.response.data.message || "Failed to fetch markers",
                );
            }
            throw error;
        }
    },

    /**
     * Get a marker by ID
     */
    async getMarkerById(id: string): Promise<Marker> {
        try {
            const response = await api.get(`/api/markers/${id}`);

            // Extract and format the marker
            const markerData = response.data.marker || response.data;
            return formatMarker(markerData);
        } catch (error) {
            if (error.response) {
                throw new Error(
                    error.response.data.message || "Failed to fetch marker",
                );
            }
            throw error;
        }
    },

    /**
     * Create a new marker
     */
    async createMarker(markerData: MarkerCreate): Promise<Marker> {
        try {
            console.log("🔍 Creating marker with data:", {
                obstacleType: markerData.obstacleType,
                obstacleScore: markerData.obstacleScore,
                notThere: markerData.notThere,
                location: markerData.location,
                hasDescription: !!markerData.description,
                imagesCount: markerData.images ? markerData.images.length : 0,
            });

            // Validate marker data before sending
            const validationErrors = validateMarkerData(markerData);
            if (validationErrors.length > 0) {
                throw new Error(
                    `Validation error: ${validationErrors.join(", ")}`,
                );
            }

            const response = await api.post("/api/markers", markerData);
            console.log("🔍 Marker creation response:", response.data);

            // Extract and format the marker from response
            const resultMarker = response.data.marker || response.data;
            return formatMarker(resultMarker);
        } catch (error) {
            console.error("🔍 Error creating marker:", error);

            if (error.response) {
                console.error(
                    "🔍 Server response:",
                    error.response.status,
                    error.response.data,
                );

                // Check if the error is due to validation
                if (error.response.status === 400) {
                    throw new Error(
                        error.response.data.message ||
                            "Invalid marker data. Please check all fields.",
                    );
                }

                // Check if the error is due to authentication
                if (error.response.status === 401) {
                    throw new Error(
                        "Authentication failed. Please log in again.",
                    );
                }

                throw new Error(
                    error.response.data.message || "Failed to create marker",
                );
            }

            // If there's no response, it might be a network error
            if (error.request) {
                throw new Error("Network error. Please check your connection.");
            }

            throw error;
        }
    },

    /**
     * Update a marker
     */
    async updateMarker(id: string, markerData: MarkerUpdate): Promise<Marker> {
        try {
            const response = await api.put(`/api/markers/${id}`, markerData);

            // Extract and format the updated marker
            const resultMarker = response.data.marker || response.data;
            return formatMarker(resultMarker);
        } catch (error) {
            if (error.response) {
                throw new Error(
                    error.response.data.message || "Failed to update marker",
                );
            }
            throw error;
        }
    },

    /**
     * Delete a marker
     */
    async deleteMarker(id: string): Promise<void> {
        try {
            await api.delete(`/api/markers/${id}`);
        } catch (error) {
            if (error.response) {
                throw new Error(
                    error.response.data.message || "Failed to delete marker",
                );
            }
            throw error;
        }
    },

    /**
     * Get markers near a location
     */
    async getMarkersNearLocation(
        location: MarkerLocation,
        radius: number,
    ): Promise<Marker[]> {
        try {
            console.log("📍 Requesting markers near:", { location, radius });
            const response = await api.get("/api/markers/nearby", {
                params: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    radius,
                },
            });

            console.log("📍 Raw API response:", response);

            // Use the standard processor for consistent handling
            const markers = processApiResponse(response);
            console.log(`📍 Processed ${markers.length} nearby markers`);

            return markers;
        } catch (error) {
            console.error("📍 Error fetching nearby markers:", error);
            if (error.response) {
                console.error(
                    "📍 Error response:",
                    error.response.status,
                    error.response.data,
                );
                throw new Error(
                    error.response.data.message ||
                        "Failed to fetch nearby markers",
                );
            }
            throw error;
        }
    },
};

// Utility function to validate marker data
function validateMarkerData(data: MarkerCreate): string[] {
    const errors: string[] = [];

    if (!data.obstacleType) {
        errors.push("Obstacle type is required");
    }

    if (!data.location) {
        errors.push("Location is required");
    } else {
        if (
            data.location.latitude === undefined ||
            data.location.latitude === null
        ) {
            errors.push("Latitude is required");
        } else if (
            data.location.latitude < -90 || data.location.latitude > 90
        ) {
            errors.push("Latitude must be between -90 and 90");
        }

        if (
            data.location.longitude === undefined ||
            data.location.longitude === null
        ) {
            errors.push("Longitude is required");
        } else if (
            data.location.longitude < -180 || data.location.longitude > 180
        ) {
            errors.push("Longitude must be between -180 and 180");
        }
    }

    return errors;
}
