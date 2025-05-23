import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";
import { MarkerLocation } from "@/types/marker.types";

// Storage setup
const storage = new MMKV({
    id: "location-storage",
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

// Define constants
const DEFAULT_CHECK_RADIUS = 100; // meters

// Default location to use when no location is available
const DEFAULT_LOCATION: MarkerLocation = {
    latitude: 44.461555, 
    longitude: 26.073303,
};

// Define the location store state
interface LocationState {
    // Location data
    currentLocation: MarkerLocation | null;
    lastLocationUpdateTime: Date | null;
    isTrackingEnabled: boolean;
    obstacleCheckRadius: number;
    processedMarkers: string[]; // IDs of markers that have been processed
    processedTimestamps: Record<string, number>; // Timestamps for each processed marker

    // Actions
    setCurrentLocation: (location: MarkerLocation) => void;
    setLastLocationUpdateTime: (time: Date) => void;
    setIsTrackingEnabled: (enabled: boolean) => void;
    setObstacleCheckRadius: (radius: number) => void;
    addProcessedMarker: (markerId: string) => void; // Single marker version
    addProcessedMarkers: (markerIds: string[]) => void;
    removeProcessedMarkers: (markerIds: string[]) => void;
    clearExpiredProcessedMarkers: () => void;
    resetProcessedMarkers: () => void;
    getProcessedMarkerIds: () => string[]; // Get list of processed marker IDs

    // Updated actions
    getLastKnownLocation: () => MarkerLocation; // Gets current location or default
    getPersistedLocation: () => MarkerLocation | null; // Gets only persisted location, null if none
    hasValidPersistedLocation: () => boolean; // Checks if we have a real persisted location
    clearPersistedLocation: () => void; // Clear the persisted location for testing
}

// Create the Zustand store with persistence
export const useLocationStore = create<LocationState>()(
    persist(
        (set, get) => ({
            // State
            currentLocation: null,
            lastLocationUpdateTime: null,
            isTrackingEnabled: true,
            obstacleCheckRadius: DEFAULT_CHECK_RADIUS,
            processedMarkers: [],
            processedTimestamps: {},

            // Actions
            setCurrentLocation: (location) => {
                console.log(
                    "📍 Location Store: Setting current location:",
                    location,
                );
                set({ currentLocation: location });
            },

            setLastLocationUpdateTime: (time) => {
                console.log(
                    "📍 Location Store: Setting last update time:",
                    time,
                );
                set({ lastLocationUpdateTime: time });
            },

            setIsTrackingEnabled: (enabled) =>
                set({ isTrackingEnabled: enabled }),

            setObstacleCheckRadius: (radius) =>
                set({ obstacleCheckRadius: radius }),

            // Add marker IDs to the processed list with current timestamp
            addProcessedMarkers: (markerIds) => {
                const now = Date.now();
                const currentTimestamps = { ...get().processedTimestamps };

                // Add timestamp for each marker
                markerIds.forEach((id) => {
                    currentTimestamps[id] = now;
                });

                set({
                    processedMarkers: [
                        ...new Set([...get().processedMarkers, ...markerIds]),
                    ],
                    processedTimestamps: currentTimestamps,
                });
            },

            // Remove marker IDs from the processed list
            removeProcessedMarkers: (markerIds) => {
                const currentTimestamps = { ...get().processedTimestamps };

                // Remove timestamps for each marker
                markerIds.forEach((id) => {
                    delete currentTimestamps[id];
                });

                set({
                    processedMarkers: get().processedMarkers.filter((id) =>
                        !markerIds.includes(id)
                    ),
                    processedTimestamps: currentTimestamps,
                });
            },

            // Clear expired processed markers - now just resets all markers
            clearExpiredProcessedMarkers: () => {
                // Simply reset all processed markers
                set({
                    processedMarkers: [],
                    processedTimestamps: {},
                });
            },

            // Reset all processed markers
            resetProcessedMarkers: () =>
                set({
                    processedMarkers: [],
                    processedTimestamps: {},
                }),

            // Add a single marker to the processed list
            addProcessedMarker: (markerId) => {
                const now = Date.now();
                const currentTimestamps = { ...get().processedTimestamps };
                currentTimestamps[markerId] = now;

                set({
                    processedMarkers: [
                        ...new Set([...get().processedMarkers, markerId]),
                    ],
                    processedTimestamps: currentTimestamps,
                });
            },

            // Get list of processed marker IDs
            getProcessedMarkerIds: () => {
                return get().processedMarkers;
            },

            // Get last known location or default
            getLastKnownLocation: () => {
                return get().currentLocation || DEFAULT_LOCATION;
            },

            // Get only persisted location, null if none exists
            getPersistedLocation: () => {
                const currentLocation = get().currentLocation;

                // Check if this is a valid persisted location (not the default)
                if (
                    currentLocation &&
                    !(Math.abs(
                                currentLocation.latitude -
                                    DEFAULT_LOCATION.latitude,
                            ) < 0.000001 &&
                        Math.abs(
                                currentLocation.longitude -
                                    DEFAULT_LOCATION.longitude,
                            ) < 0.000001)
                ) {
                    return currentLocation;
                }

                return null;
            },

            // Check if we have a valid persisted location
            hasValidPersistedLocation: () => {
                const currentLocation = get().currentLocation;
                return currentLocation !== null &&
                    !(Math.abs(
                                currentLocation.latitude -
                                    DEFAULT_LOCATION.latitude,
                            ) < 0.000001 &&
                        Math.abs(
                                currentLocation.longitude -
                                    DEFAULT_LOCATION.longitude,
                            ) < 0.000001);
            },

            // Clear the persisted location for testing
            clearPersistedLocation: () => {
                set({ currentLocation: null });
            },
        }),
        {
            name: "location-storage",
            storage: createJSONStorage(() => mmkvStorage),
            // Only persist these specific parts of the state
            partialize: (state) => ({
                isTrackingEnabled: state.isTrackingEnabled,
                obstacleCheckRadius: state.obstacleCheckRadius,
                processedMarkers: state.processedMarkers,
                processedTimestamps: state.processedTimestamps,
                currentLocation: state.currentLocation,
                lastLocationUpdateTime: state.lastLocationUpdateTime,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    console.log("📍 Location Store: Rehydrated from storage:", {
                        currentLocation: state.currentLocation,
                        lastLocationUpdateTime: state.lastLocationUpdateTime,
                        isTrackingEnabled: state.isTrackingEnabled,
                    });
                } else {
                    console.log("📍 Location Store: No state to rehydrate");
                }
            },
        },
    ),
);
