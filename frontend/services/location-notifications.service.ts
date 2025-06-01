import * as Notifications from "expo-notifications";
import { useLocationStore } from "@/stores/location/location.store";
import { MarkerLocation } from "@/types/marker.types";
import { registerCleanupFunction } from "./cleanup.service";

// Types for location-based notifications
export interface LocationNotificationConfig {
    id: string;
    title: string;
    body: string;
    triggerRadius: number; // meters
    targetLocation: MarkerLocation;
    categoryId?: string;
    data?: Record<string, any>;
}

export interface ActiveLocationTrigger {
    config: LocationNotificationConfig;
    isActive: boolean;
    lastTriggered?: Date;
}

// Service class for managing location-based notifications
class LocationNotificationService {
    private static instance: LocationNotificationService;
    private activeTriggers: Map<string, ActiveLocationTrigger> = new Map();
    private currentLocation: MarkerLocation | null = null;
    private isMonitoring: boolean = false;
    private locationUnsubscribe: (() => void) | null = null;

    /**
     * Initialize the location notification service
     */
    public async initialize(): Promise<boolean> {
        try {
            console.log("🔔 LocationNotificationService: Initializing...");

            // Set up notification categories if needed
            await this.setupNotificationCategories();

            // Start monitoring location changes
            this.startLocationMonitoring();

            // Register cleanup function
            registerCleanupFunction(() => this.cleanup());
            
            console.log(
                "✅ LocationNotificationService: Initialized successfully",
            );
            return true;
        } catch (error) {
            console.error(
                "❌ LocationNotificationService: Initialization failed:",
                error,
            );
            return false;
        }
    }

    /**
     * Add a location-based notification trigger
     */
    public addLocationTrigger(config: LocationNotificationConfig): void {
        console.log(
            `🔔 Adding location trigger: ${config.id} at ${config.targetLocation.latitude}, ${config.targetLocation.longitude}`,
        );

        this.activeTriggers.set(config.id, {
            config,
            isActive: true,
            lastTriggered: undefined,
        });

        // Check immediately if user is already in range
        if (this.currentLocation) {
            this.checkLocationTriggers(this.currentLocation);
        }
    }

    /**
     * Remove a location-based notification trigger
     */
    public removeLocationTrigger(triggerId: string): void {
        console.log(`🔔 Removing location trigger: ${triggerId}`);
        this.activeTriggers.delete(triggerId);
    }

    /**
     * Remove all location triggers
     */
    public clearAllTriggers(): void {
        console.log("🔔 Clearing all location triggers");
        this.activeTriggers.clear();
    }

    /**
     * Get all active triggers
     */
    public getActiveTriggers(): ActiveLocationTrigger[] {
        return Array.from(this.activeTriggers.values());
    }

    /**
     * Update a trigger's active status
     */
    public setTriggerActive(triggerId: string, isActive: boolean): void {
        const trigger = this.activeTriggers.get(triggerId);
        if (trigger) {
            trigger.isActive = isActive;
            console.log(
                `🔔 Location trigger ${triggerId} set to ${
                    isActive ? "active" : "inactive"
                }`,
            );
        }
    }

    /**
     * Start monitoring location changes for notifications
     */
    private startLocationMonitoring(): void {
        if (this.isMonitoring) {
            console.log("🔔 Location monitoring already active");
            return;
        }

        console.log("🔔 Starting location monitoring for notifications...");
        this.isMonitoring = true;

        // Subscribe to location store changes
        this.locationUnsubscribe = useLocationStore.subscribe(
            (state) => {
                const newLocation = state.currentLocation;
                if (newLocation) {
                    this.onLocationUpdate(newLocation);
                }
            }
        );

        console.log("🔔 Location monitoring started with subscription stored");
    }

    /**
     * Stop monitoring location changes for notifications
     */
    private stopLocationMonitoring(): void {
        console.log("🔔 Stopping location monitoring for notifications...");
        this.isMonitoring = false;

        // Clean up the location subscription
        if (this.locationUnsubscribe) {
            this.locationUnsubscribe();
            this.locationUnsubscribe = null;
            console.log("🧹 Location subscription cleaned up");
        }
    }

    /**
     * Clean up all resources
     */
    public cleanup(): void {
        console.log("🔔 Cleaning up LocationNotificationService...");
        this.clearAllTriggers();
        this.stopLocationMonitoring();
    }

    /**
     * Handle location updates
     */
    private onLocationUpdate(newLocation: MarkerLocation): void {
        console.log(
            `🔔 Location update received: ${newLocation.latitude}, ${newLocation.longitude}`,
        );
        this.currentLocation = newLocation;
        this.checkLocationTriggers(newLocation);
    }

    /**
     * Check all triggers against current location
     */
    private checkLocationTriggers(currentLocation: MarkerLocation): void {
        for (const [triggerId, trigger] of this.activeTriggers) {
            if (!trigger.isActive) continue;

            const distance = this.calculateDistance(
                currentLocation,
                trigger.config.targetLocation,
            );

            if (distance <= trigger.config.triggerRadius) {
                // Check if we should trigger (avoid spam)
                if (this.shouldTriggerNotification(trigger)) {
                    this.triggerNotification(trigger);
                }
            }
        }
    }

    /**
     * Check if notification should be triggered (debouncing logic)
     */
    private shouldTriggerNotification(trigger: ActiveLocationTrigger): boolean {
        const now = new Date();
        const lastTriggered = trigger.lastTriggered;

        // If never triggered, allow it
        if (!lastTriggered) return true;

        // Minimum 5 minutes between same trigger
        const minInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
        return (now.getTime() - lastTriggered.getTime()) > minInterval;
    }

    /**
     * Trigger a notification
     */
    private async triggerNotification(
        trigger: ActiveLocationTrigger,
    ): Promise<void> {
        try {
            console.log(
                `🔔 Triggering location notification: ${trigger.config.id}`,
            );

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: trigger.config.title,
                    body: trigger.config.body,
                    categoryIdentifier: trigger.config.categoryId,
                    data: {
                        type: "location-based",
                        triggerId: trigger.config.id,
                        ...trigger.config.data,
                    },
                },
                trigger: null, // Immediate trigger
            });

            // Update last triggered time
            trigger.lastTriggered = new Date();

            console.log(
                `✅ Location notification sent: ${trigger.config.title}`,
            );
        } catch (error) {
            console.error(
                `❌ Failed to send location notification ${trigger.config.id}:`,
                error,
            );
        }
    }

    /**
     * Calculate distance between two locations (Haversine formula)
     */
    private calculateDistance(
        loc1: MarkerLocation,
        loc2: MarkerLocation,
    ): number {
        const R = 6371000; // Earth's radius in meters
        const dLat = this.deg2rad(loc2.latitude - loc1.latitude);
        const dLon = this.deg2rad(loc2.longitude - loc1.longitude);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(loc1.latitude)) *
                Math.cos(this.deg2rad(loc2.latitude)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c; // Distance in meters

        return distance;
    }

    /**
     * Convert degrees to radians
     */
    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    /**
     * Set up notification categories for location-based notifications
     */
    private async setupNotificationCategories(): Promise<void> {
        try {
            await Notifications.setNotificationCategoryAsync("location-based", [
                {
                    identifier: "view-details",
                    buttonTitle: "View Details",
                    options: {
                        opensAppToForeground: true,
                    },
                },
                {
                    identifier: "dismiss",
                    buttonTitle: "Dismiss",
                    options: {
                        isDestructive: true,
                    },
                },
            ]);

            console.log("✅ Location notification categories set up");
        } catch (error) {
            console.error(
                "❌ Failed to set up notification categories:",
                error,
            );
        }
    }
}

// Export singleton instance
export const locationNotificationService = new LocationNotificationService();

// Convenience functions for easy usage
export const initializeLocationNotifications = () =>
    locationNotificationService.initialize();

export const addLocationNotification = (config: LocationNotificationConfig) =>
    locationNotificationService.addLocationTrigger(config);

export const removeLocationNotification = (id: string) =>
    locationNotificationService.removeLocationTrigger(id);

export const clearAllLocationNotifications = () =>
    locationNotificationService.clearAllTriggers();

// Example usage configurations
export const createObstacleNotification = (
    obstacleLocation: MarkerLocation,
    obstacleType: string,
): LocationNotificationConfig => ({
    id: `obstacle-${Date.now()}`,
    title: "Accessibility Alert",
    body: `${obstacleType} detected nearby. Please be cautious.`,
    triggerRadius: 50, // 50 meters
    targetLocation: obstacleLocation,
    categoryId: "location-based",
    data: {
        type: "obstacle",
        obstacleType,
    },
});

export const createDestinationNotification = (
    destinationLocation: MarkerLocation,
    destinationName: string,
): LocationNotificationConfig => ({
    id: `destination-${Date.now()}`,
    title: "Destination Nearby",
    body: `You're approaching ${destinationName}`,
    triggerRadius: 20, 
    targetLocation: destinationLocation,
    categoryId: "location-based",
    data: {
        type: "destination",
        destinationName,
    },
});
