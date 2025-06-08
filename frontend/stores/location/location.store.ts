import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";
import { MarkerLocation } from "@/types/marker.types";

const storage = new MMKV({
    id: "location-storage",
});

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

const DEFAULT_CHECK_RADIUS = 100; // meters

const DEFAULT_LOCATION: MarkerLocation = {
    latitude: 44.461555,
    longitude: 26.073303,
};

interface LocationState {
    currentLocation: MarkerLocation | null;
    lastLocationUpdateTime: Date | null;
    isTrackingEnabled: boolean;
    obstacleCheckRadius: number;
    processedTimestamps: Record<string, number>; // Only store timestamps, derive array when needed

    setCurrentLocation: (location: MarkerLocation) => void;
    setLastLocationUpdateTime: (time: Date) => void;
    setIsTrackingEnabled: (enabled: boolean) => void;
    setObstacleCheckRadius: (radius: number) => void;
    addProcessedMarker: (markerId: string) => void;
    addProcessedMarkers: (markerIds: string[]) => void;
    removeProcessedMarkers: (markerIds: string[]) => void;
    clearExpiredProcessedMarkers: () => void;
    resetProcessedMarkers: () => void;
    getProcessedMarkerIds: () => string[]; // Get list of processed marker IDs
    isMarkerInCooldown: (markerId: string) => boolean; // Check if specific marker is in cooldown

    getLastKnownLocation: () => MarkerLocation; // Gets current location or default
    getPersistedLocation: () => MarkerLocation | null; // Gets only persisted location, null if none
    hasValidPersistedLocation: () => boolean; // Checks if we have a real persisted location
    clearPersistedLocation: () => void; // Clear the persisted location for testing
}

export const useLocationStore = create<LocationState>()(
    persist(
        (set, get) => ({
            currentLocation: null,
            lastLocationUpdateTime: null,
            isTrackingEnabled: true,
            obstacleCheckRadius: DEFAULT_CHECK_RADIUS,
            processedTimestamps: {},

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

            addProcessedMarkers: (markerIds) => {
                const now = Date.now();
                const currentTimestamps = { ...get().processedTimestamps };

                markerIds.forEach((id) => {
                    currentTimestamps[id] = now;
                });

                set({
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
                    processedTimestamps: currentTimestamps,
                });
            },

            // Clear expired processed markers based on 10-minute cooldown
            clearExpiredProcessedMarkers: () => {
                try {
                    const now = Date.now();
                    const cooldownPeriod = 10 * 60 * 1000; // 10 minutes in milliseconds
                    const timestamps = get().processedTimestamps;

                    if (!timestamps) {
                        return; // No timestamps to clear
                    }

                    const currentTimestamps = { ...timestamps };
                    const expiredMarkerIds: string[] = [];

                    // Find expired markers
                    Object.entries(currentTimestamps).forEach(
                        ([markerId, timestamp]) => {
                            if (now - timestamp >= cooldownPeriod) {
                                expiredMarkerIds.push(markerId);
                                delete currentTimestamps[markerId];
                            }
                        },
                    );

                    // Update state only if there are expired markers
                    if (expiredMarkerIds.length > 0) {
                        console.log(
                            `🕒 Clearing ${expiredMarkerIds.length} expired markers from cooldown`,
                        );
                        set({
                            processedTimestamps: currentTimestamps,
                        });
                    }
                } catch (error) {
                    console.error("❌ Error clearing expired markers:", error);
                }
            },

            // Reset all processed markers
            resetProcessedMarkers: () =>
                set({
                    processedTimestamps: {},
                }),

            // Add a single marker to the processed list
            addProcessedMarker: (markerId) => {
                const now = Date.now();
                const currentTimestamps = { ...get().processedTimestamps };
                currentTimestamps[markerId] = now;

                set({
                    processedTimestamps: currentTimestamps,
                });
            },

            // Get list of processed marker IDs (without triggering cleanup)
            getProcessedMarkerIds: () => {
                try {
                    const timestamps = get().processedTimestamps;
                    return timestamps ? Object.keys(timestamps) : [];
                } catch (error) {
                    console.error(
                        "❌ Error getting processed marker IDs:",
                        error,
                    );
                    return [];
                }
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

            // Check if specific marker is in cooldown
            isMarkerInCooldown: (markerId: string) => {
                try {
                    const currentTimestamps = get().processedTimestamps;
                    if (!currentTimestamps) {
                        return false; // No timestamps available, not in cooldown
                    }

                    const timestamp = currentTimestamps[markerId];

                    if (!timestamp) {
                        return false; // Not processed, so not in cooldown
                    }

                    const now = Date.now();
                    const cooldownPeriod = 10 * 60 * 1000; // 10 minutes in milliseconds

                    return (now - timestamp) < cooldownPeriod;
                } catch (error) {
                    console.error("❌ Error checking marker cooldown:", error);
                    return false; // Default to not in cooldown on error
                }
            },
        }),
        {
            name: "location-storage",
            storage: createJSONStorage(() => mmkvStorage),
            // Only persist these specific parts of the state
            partialize: (state) => ({
                isTrackingEnabled: state.isTrackingEnabled,
                obstacleCheckRadius: state.obstacleCheckRadius,
                processedTimestamps: state.processedTimestamps,
                currentLocation: state.currentLocation,
                lastLocationUpdateTime: state.lastLocationUpdateTime,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Migration: Handle old data format that might have processedMarkers array
                    if (
                        (state as any).processedMarkers &&
                        Array.isArray((state as any).processedMarkers)
                    ) {
                        console.log(
                            "📍 Location Store: Migrating old processedMarkers format",
                        );
                        // Convert old processedMarkers array to timestamps if needed
                        const now = Date.now();
                        const migratedTimestamps: Record<string, number> = {};
                        (state as any).processedMarkers.forEach(
                            (markerId: string) => {
                                migratedTimestamps[markerId] = now;
                            },
                        );
                        state.processedTimestamps = {
                            ...state.processedTimestamps,
                            ...migratedTimestamps,
                        };
                        // Remove the old property
                        delete (state as any).processedMarkers;
                    }

                    // Ensure processedTimestamps exists
                    if (!state.processedTimestamps) {
                        state.processedTimestamps = {};
                    }

                    console.log("📍 Location Store: Rehydrated from storage:", {
                        currentLocation: state.currentLocation,
                        lastLocationUpdateTime: state.lastLocationUpdateTime,
                        isTrackingEnabled: state.isTrackingEnabled,
                        processedTimestampsCount:
                            Object.keys(state.processedTimestamps).length,
                    });
                } else {
                    console.log("📍 Location Store: No state to rehydrate");
                }
            },
        },
    ),
);
