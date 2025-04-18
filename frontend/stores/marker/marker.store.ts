import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";
import { router } from "expo-router";
import { Alert } from "react-native";
import { MarkerService } from "./marker.service";
import {
    Marker,
    MarkerCreate,
    MarkerLocation,
    MarkerUpdate,
} from "@/types/marker.types";
import { getUserId } from "../auth/auth.utils";
import { useAuthStore } from "../auth/auth.store";

// Storage setup for persisting markers
const storage = new MMKV({
    id: "markers-storage",
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

// Define the marker store state
interface MarkerState {
    // Marker data
    markers: Marker[];
    userMarkers: Marker[];
    nearbyMarkers: Marker[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchMarkers: () => Promise<void>;
    fetchUserMarkers: () => Promise<void>;
    fetchNearbyMarkers: (
        location: MarkerLocation,
        radius?: number,
    ) => Promise<void>;
    createMarker: (marker: MarkerCreate) => Promise<Marker | null>;
    updateMarker: (
        markerId: string,
        marker: MarkerUpdate,
    ) => Promise<Marker | null>;
    deleteMarker: (markerId: string) => Promise<boolean>;
    clearError: () => void;
}

// Create the Zustand store with persistence
export const useMarkerStore = create<MarkerState>()(
    persist(
        (set, get) => ({
            // State
            markers: [],
            userMarkers: [],
            nearbyMarkers: [],
            isLoading: false,
            error: null,

            // Actions
            fetchMarkers: async () => {
                try {
                    set({ isLoading: true, error: null });
                    const markers = await MarkerService.getMarkers();
                    set({ markers, isLoading: false });
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to fetch markers",
                    });
                }
            },

            fetchUserMarkers: async () => {
                try {
                    set({ isLoading: true, error: null });
                    // First get all markers
                    const allMarkers = await MarkerService.getMarkers();

                    // Filter to get only the current user's markers
                    // This assumes we have some way to identify the current user ID
                    // You may need to adapt this based on your auth store implementation
                    const markers = get().markers;

                    // We'll do a local filter for now, but ideally the backend should provide this endpoint
                    const userId = await getUserId(); // This would come from your auth store
                    const userMarkers = allMarkers.filter((marker) =>
                        marker.userId === userId
                    );

                    set({ userMarkers, isLoading: false });
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to fetch user markers",
                    });
                }
            },

            fetchNearbyMarkers: async (
                location: MarkerLocation,
                radius = 300,
            ) => {
                try {
                    set({ isLoading: true, error: null });
                    const nearbyMarkers = await MarkerService.getMarkersNearby(
                        location,
                        radius,
                    );
                    set({ nearbyMarkers, isLoading: false });
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to fetch nearby markers",
                    });
                }
            },

            createMarker: async (markerData: MarkerCreate) => {
                try {
                    set({ isLoading: true, error: null });
                    const newMarker = await MarkerService.createMarker(
                        markerData,
                    );
                    set((state) => ({
                        markers: [...state.markers, newMarker],
                        userMarkers: [...state.userMarkers, newMarker],
                        isLoading: false,
                    }));
                    return newMarker;
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return null;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to create marker",
                    });
                    return null;
                }
            },

            updateMarker: async (
                markerId: string,
                markerData: MarkerUpdate,
            ) => {
                try {
                    set({ isLoading: true, error: null });
                    const updatedMarker = await MarkerService.updateMarker(
                        markerId,
                        markerData,
                    );

                    // Update the marker in all relevant lists
                    set((state) => ({
                        markers: state.markers.map((m) =>
                            m.id === markerId ? updatedMarker : m
                        ),
                        userMarkers: state.userMarkers.map((m) =>
                            m.id === markerId ? updatedMarker : m
                        ),
                        nearbyMarkers: state.nearbyMarkers.map((m) =>
                            m.id === markerId ? updatedMarker : m
                        ),
                        isLoading: false,
                    }));

                    return updatedMarker;
                } catch (error) {
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return null;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to update marker",
                    });
                    return null;
                }
            },

            deleteMarker: async (markerId: string) => {
                try {
                    set({ isLoading: true, error: null });
                    await MarkerService.deleteMarker(markerId);

                    // Remove the marker from all lists
                    set((state) => ({
                        markers: state.markers.filter((m) => m.id !== markerId),
                        userMarkers: state.userMarkers.filter((m) =>
                            m.id !== markerId
                        ),
                        nearbyMarkers: state.nearbyMarkers.filter((m) =>
                            m.id !== markerId
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
                            : "Failed to delete marker",
                    });
                    return false;
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: "markers-storage",
            storage: createJSONStorage(() => mmkvStorage),
        },
    ),
);
