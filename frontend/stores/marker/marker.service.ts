import axios from "axios";
import { getAuthHeader } from "../auth/auth.utils";
import { API_URL } from "@/constants/api";
import {
    Marker,
    MarkerCreate,
    MarkerLocation,
    MarkerUpdate,
} from "@/types/marker.types";

/**
 * Service for marker-related API calls
 */
export const MarkerService = {
    /**
     * Fetch all markers from the backend
     */
    async getMarkers(): Promise<Marker[]> {
        try {
            const headers = await getAuthHeader();
            const response = await axios.get(`${API_URL}/api/markings`, {
                headers,
            });
            return response.data.markers;
        } catch (error) {
            console.error("Error fetching markers:", error);
            throw error;
        }
    },

    /**
     * Fetch markers within a specific radius of a location
     */
    async getMarkersNearby(
        location: MarkerLocation,
        radiusInMeters: number = 300,
    ): Promise<Marker[]> {
        try {
            const headers = await getAuthHeader();
            const response = await axios.get(`${API_URL}/api/markings/nearby`, {
                headers,
                params: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    radius: radiusInMeters,
                },
            });
            return response.data.markers;
        } catch (error) {
            console.error("Error fetching nearby markers:", error);
            throw error;
        }
    },

    /**
     * Create a new marker
     */
    async createMarker(markerData: MarkerCreate): Promise<Marker> {
        try {
            const headers = await getAuthHeader();
            const response = await axios.post(
                `${API_URL}/api/markings`,
                markerData,
                { headers },
            );
            return response.data.marker;
        } catch (error) {
            console.error("Error creating marker:", error);
            throw error;
        }
    },

    /**
     * Update an existing marker
     */
    async updateMarker(
        markerId: string,
        markerData: MarkerUpdate,
    ): Promise<Marker> {
        try {
            const headers = await getAuthHeader();
            const response = await axios.put(
                `${API_URL}/api/markings/${markerId}`,
                markerData,
                { headers },
            );
            return response.data.marker;
        } catch (error) {
            console.error("Error updating marker:", error);
            throw error;
        }
    },

    /**
     * Delete a marker
     */
    async deleteMarker(markerId: string): Promise<void> {
        try {
            const headers = await getAuthHeader();
            await axios.delete(`${API_URL}/api/markings/${markerId}`, {
                headers,
            });
        } catch (error) {
            console.error("Error deleting marker:", error);
            throw error;
        }
    },
};
