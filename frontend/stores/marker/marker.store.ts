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
import { getUserId, isAuthenticated } from "../auth/auth.utils";
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
            isLoading: false,
            error: null,

            // Actions
            fetchMarkers: async () => {
                try {
                    // Check if user is authenticated before making the API call
                    if (!await isAuthenticated()) {
                        console.log(
                            "User not authenticated, skipping marker fetch",
                        );
                        set({ markers: [], userMarkers: [], isLoading: false });
                        return;
                    }

                    set({ isLoading: true, error: null });
                    const markers = await MarkerService.getMarkers();
                    // Ensure markers is always an array
                    set({
                        markers: Array.isArray(markers) ? markers : [],
                        userMarkers: [],
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
                            : "Failed to fetch markers",
                        markers: [], // Reset markers on error
                        userMarkers: [], // Reset userMarkers on error
                    });
                }
            },

            fetchUserMarkers: async () => {
                try {
                    // Check if user is authenticated before making the API call
                    if (!await isAuthenticated()) {
                        console.log(
                            "User not authenticated, skipping user marker fetch",
                        );
                        set({ markers: [], userMarkers: [], isLoading: false });
                        return;
                    }

                    set({ isLoading: true, error: null });
                    console.log("👤 Fetching user markers...");
                    const allMarkers = await MarkerService.getMarkers();
                    const userId = await getUserId();
                    console.log("👤 Current userId:", userId);
                    console.log(
                        "👤 All markers count:",
                        Array.isArray(allMarkers) ? allMarkers.length : 0,
                    );

                    // Ensure arrays and filter
                    const markers = Array.isArray(allMarkers) ? allMarkers : [];

                    // Fix user ID comparison by ensuring both are strings
                    const userMarkers = markers.filter((marker) => {
                        const markerUserId = marker.userId?.toString();
                        const currentUserId = userId?.toString();
                        console.log(
                            `👤 Comparing marker userId: ${markerUserId} with current userId: ${currentUserId}`,
                        );
                        return markerUserId === currentUserId;
                    });

                    console.log(
                        "👤 Filtered userMarkers count:",
                        userMarkers.length,
                    );
                    if (userMarkers.length > 0) {
                        console.log("👤 First user marker:", userMarkers[0]);
                    } else {
                        console.log("👤 No user markers found after filtering");
                    }

                    set({ markers, userMarkers, isLoading: false });
                } catch (error) {
                    console.error("👤 Error in fetchUserMarkers:", error);
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to fetch user markers",
                        markers: [], // Reset markers on error
                        userMarkers: [], // Reset userMarkers on error
                    });
                }
            },

            fetchNearbyMarkers: async (
                location: MarkerLocation,
                radius = 300,
            ) => {
                try {
                    // Check if user is authenticated before making the API call
                    if (!await isAuthenticated()) {
                        console.log(
                            "User not authenticated, skipping nearby marker fetch",
                        );
                        set({ markers: [], isLoading: false });
                        return;
                    }

                    set({ isLoading: true, error: null });
                    console.log("🏪 Fetching nearby markers:", {
                        location,
                        radius,
                    });

                    const nearbyMarkers = await MarkerService
                        .getMarkersNearLocation(
                            location,
                            radius,
                        );

                    console.log(
                        `🏪 Received ${
                            Array.isArray(nearbyMarkers)
                                ? nearbyMarkers.length
                                : 0
                        } markers from service`,
                    );

                    if (Array.isArray(nearbyMarkers)) {
                        console.log(
                            "🏪 First marker (if available):",
                            nearbyMarkers.length > 0
                                ? nearbyMarkers[0]
                                : "No markers",
                        );

                        // Check if markers have proper location data
                        const validMarkers = nearbyMarkers.filter((marker) =>
                            marker &&
                            marker.location &&
                            marker.location.latitude != null &&
                            marker.location.longitude != null
                        );

                        console.log(
                            `🏪 Found ${validMarkers.length} valid markers with location data`,
                        );

                        set({
                            markers: validMarkers,
                            isLoading: false,
                        });
                    } else {
                        console.log(
                            "🏪 nearbyMarkers is not an array:",
                            nearbyMarkers,
                        );
                        set({
                            markers: [],
                            isLoading: false,
                        });
                    }
                } catch (error) {
                    console.error("🏪 Error in fetchNearbyMarkers:", error);
                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return;
                    }

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to fetch nearby markers",
                        markers: [], // Reset markers on error
                    });
                }
            },

            createMarker: async (markerData: MarkerCreate) => {
                try {
                    set({ isLoading: true, error: null });
                    console.log("🏪 Creating marker in store:", {
                        obstacleType: markerData.obstacleType,
                        location: markerData.location
                            ? `[${markerData.location.latitude}, ${markerData.location.longitude}]`
                            : "missing",
                        hasDescription: !!markerData.description,
                    });

                    // Generate a temporary ID for optimistic updates
                    const tempId = `temp-${Date.now()}`;

                    // Create optimistic marker for immediate UI update
                    const optimisticMarker: Marker = {
                        id: tempId,
                        userId: await getUserId(),
                        obstacleType: markerData.obstacleType,
                        obstacleScore: markerData.obstacleScore || 1,
                        location: markerData.location,
                        description: markerData.description || "",
                        images: markerData.images || [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };

                    // Add optimistic marker to state
                    const currentMarkers = [...get().markers, optimisticMarker];
                    const currentUserMarkers = [
                        ...get().userMarkers,
                        optimisticMarker,
                    ];

                    // Update state with optimistic marker
                    set({
                        markers: currentMarkers,
                        userMarkers: currentUserMarkers,
                    });

                    console.log(
                        "🏪 Added optimistic marker to state",
                        optimisticMarker,
                    );

                    // Make the actual API call
                    const newMarker = await MarkerService.createMarker(
                        markerData,
                    );

                    console.log(
                        "🏪 Backend response for marker creation:",
                        newMarker
                            ? `Success - ID: ${newMarker.id}`
                            : "No data returned",
                    );

                    if (newMarker) {
                        console.log(
                            "🏪 Replacing optimistic marker with real marker",
                        );

                        // Replace the optimistic marker with the real one
                        const updatedMarkers = get().markers.map((m) =>
                            m.id === tempId ? newMarker : m
                        );

                        const updatedUserMarkers = get().userMarkers.map((m) =>
                            m.id === tempId ? newMarker : m
                        );

                        set({
                            markers: updatedMarkers,
                            userMarkers: updatedUserMarkers,
                            isLoading: false,
                        });

                        return newMarker;
                    }

                    console.log("🏪 No marker data returned from backend");

                    // Remove optimistic marker if backend call failed
                    const fallbackMarkers = get().markers.filter((m) =>
                        m.id !== tempId
                    );
                    const fallbackUserMarkers = get().userMarkers.filter((m) =>
                        m.id !== tempId
                    );

                    set({
                        isLoading: false,
                        error: "No data returned from server",
                        markers: fallbackMarkers,
                        userMarkers: fallbackUserMarkers,
                    });

                    return null;
                } catch (error) {
                    console.error("🏪 Error in createMarker:", error);

                    // Remove optimistic marker on error
                    const tempId = `temp-${Date.now()}`;
                    const fallbackMarkers = get().markers.filter((m) =>
                        !m.id.startsWith("temp-")
                    );
                    const fallbackUserMarkers = get().userMarkers.filter((m) =>
                        !m.id.startsWith("temp-")
                    );

                    if (handleAuthError(error)) {
                        set({
                            isLoading: false,
                            markers: fallbackMarkers,
                            userMarkers: fallbackUserMarkers,
                        });
                        return null;
                    }

                    // Create a descriptive error message
                    let errorMessage = "Failed to create marker";

                    if (error instanceof Error) {
                        errorMessage = error.message;
                    } else if (typeof error === "object" && error !== null) {
                        // Try to extract more information from the error object
                        const errorObj = error as any;
                        if (errorObj.response?.data?.message) {
                            errorMessage = errorObj.response.data.message;
                        } else if (errorObj.message) {
                            errorMessage = errorObj.message;
                        }
                    }

                    console.error("🏪 Error message:", errorMessage);

                    set({
                        isLoading: false,
                        error: errorMessage,
                        markers: fallbackMarkers,
                        userMarkers: fallbackUserMarkers,
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

                    // Get current marker to create optimistic update
                    const currentMarker = get().markers.find((m) =>
                        m.id === markerId
                    );
                    if (!currentMarker) {
                        throw new Error("Marker not found");
                    }

                    // Create optimistic update
                    const optimisticMarker: Marker = {
                        ...currentMarker,
                        ...markerData,
                        location: markerData.location || currentMarker.location,
                        updatedAt: new Date().toISOString(),
                    };

                    // Update state optimistically
                    const updatedMarkers = get().markers.map((m) =>
                        m.id === markerId ? optimisticMarker : m
                    );

                    const updatedUserMarkers = get().userMarkers.map((m) =>
                        m.id === markerId ? optimisticMarker : m
                    );

                    set({
                        markers: updatedMarkers,
                        userMarkers: updatedUserMarkers,
                    });

                    // Make the actual API call
                    const updatedMarker = await MarkerService.updateMarker(
                        markerId,
                        markerData,
                    );

                    if (updatedMarker) {
                        // Replace optimistic marker with real updated marker
                        const finalMarkers = get().markers.map((m) =>
                            m.id === markerId ? updatedMarker : m
                        );

                        const finalUserMarkers = get().userMarkers.map((m) =>
                            m.id === markerId ? updatedMarker : m
                        );

                        set({
                            markers: finalMarkers,
                            userMarkers: finalUserMarkers,
                            isLoading: false,
                        });

                        return updatedMarker;
                    }

                    // Rollback if update failed
                    const fallbackMarkers = get().markers.map((m) =>
                        m.id === markerId ? currentMarker : m
                    );

                    const fallbackUserMarkers = get().userMarkers.map((m) =>
                        m.id === markerId ? currentMarker : m
                    );

                    set({
                        isLoading: false,
                        error: "Failed to update marker on the server",
                        markers: fallbackMarkers,
                        userMarkers: fallbackUserMarkers,
                    });

                    return null;
                } catch (error) {
                    console.error("🏪 Error in updateMarker:", error);

                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return null;
                    }

                    // Rollback optimistic update
                    const currentMarkers = [...get().markers];
                    const currentUserMarkers = [...get().userMarkers];

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to update marker",
                        markers: currentMarkers,
                        userMarkers: currentUserMarkers,
                    });
                    return null;
                }
            },

            deleteMarker: async (markerId: string) => {
                try {
                    set({ isLoading: true, error: null });

                    // Store current markers for potential rollback
                    const originalMarkers = [...get().markers];
                    const originalUserMarkers = [...get().userMarkers];

                    // Optimistically remove marker from state
                    const updatedMarkers = get().markers.filter((m) =>
                        m.id !== markerId
                    );
                    const updatedUserMarkers = get().userMarkers.filter((m) =>
                        m.id !== markerId
                    );

                    set({
                        markers: updatedMarkers,
                        userMarkers: updatedUserMarkers,
                    });

                    // Make the actual API call
                    await MarkerService.deleteMarker(markerId);

                    // Deletion succeeded, keep the updated state
                    set({ isLoading: false });
                    return true;
                } catch (error) {
                    console.error("🏪 Error in deleteMarker:", error);

                    if (handleAuthError(error)) {
                        set({ isLoading: false });
                        return false;
                    }

                    // Restore original markers if delete failed
                    const originalMarkers = [...get().markers];
                    const originalUserMarkers = [...get().userMarkers];

                    set({
                        isLoading: false,
                        error: error instanceof Error
                            ? error.message
                            : "Failed to delete marker",
                        markers: originalMarkers,
                        userMarkers: originalUserMarkers,
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
