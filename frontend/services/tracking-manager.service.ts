import { AppState, AppStateStatus, Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import {
    LOCATION_TRACKING_TASK,
    requestLocationPermissions,
    startLocationTracking,
    stopLocationTracking,
} from "./location.service";
import { initializeNotifications } from "./notification.service";
import { useLocationStore } from "@/stores/location/location.store";
import { useAuthStore } from "@/stores/auth/auth.store";
import {
    CleanupCategory,
    registerCleanupFunction,
    trackSubscription,
    untrackSubscription,
} from "./cleanup.service";

import { getLocationConfig } from "@/config/location.config";

// Singleton tracking manager
class TrackingManager {
    private static instance: TrackingManager;
    private isInitialized: boolean = false;
    private appState: AppStateStatus = "active";
    private appStateSubscription: any = null;
    private authStateUnsubscribe: (() => void) | null = null;
    private isFirstTrackingSession: boolean = true;

    // Private constructor for singleton pattern
    private constructor() {}

    // Get the singleton instance
    public static getInstance(): TrackingManager {
        if (!TrackingManager.instance) {
            TrackingManager.instance = new TrackingManager();
        }
        return TrackingManager.instance;
    }

    /**
     * Initialize the tracking manager
     */
    public async initialize(): Promise<boolean> {
        if (this.isInitialized) {
            return true;
        }

        try {
            console.log("🔄 TrackingManager: Starting initialization...");

            // Request location permissions
            const permissionGranted = await requestLocationPermissions();
            if (!permissionGranted) {
                console.warn(
                    "⚠️ TrackingManager: Location permissions not granted",
                );
                // Still initialize the manager for future permission attempts
                this.setupListeners();
                this.isInitialized = true;
                return false; // Return false to indicate permissions issue, but still initialized
            }

            console.log("✅ TrackingManager: Permissions granted");

            // Start listeners for enhanced functionality
            this.setupListeners();

            // Check if location tracking is enabled in store
            const { isTrackingEnabled, clearExpiredProcessedMarkers } =
                useLocationStore.getState();

            // Clear processed markers to enable fresh notifications
            try {
                clearExpiredProcessedMarkers();
            } catch (clearError) {
                console.warn(
                    "⚠️ TrackingManager: Error clearing expired markers:",
                    clearError,
                );
            }

            // Start location tracking if enabled
            if (isTrackingEnabled) {
                console.log(
                    "🚀 TrackingManager: Location tracking is enabled, starting...",
                );
                const trackingStarted = await this.startTracking();
                if (!trackingStarted) {
                    console.warn(
                        "⚠️ TrackingManager: Failed to start tracking during initialization",
                    );
                } else {
                    console.log(
                        "✅ TrackingManager: Location tracking started successfully",
                    );
                }
            } else {
                console.log(
                    "📍 TrackingManager: Location tracking is disabled in store",
                );
            }

            // Register cleanup function
            registerCleanupFunction(
                () => this.cleanup(),
                CleanupCategory.TRACKING,
            );

            this.isInitialized = true;
            console.log(
                "✅ TrackingManager: Initialization completed successfully",
            );
            return true;
        } catch (error) {
            console.error("❌ TrackingManager: Initialization error:", error);
            // Still mark as initialized to prevent repeated failures
            this.isInitialized = true;
            return false;
        }
    }

    /**
     * Set up all event listeners
     */
    private setupListeners(): void {
        this.setupAppStateListener();
        this.setupAuthStateListener();
    }

    /**
     * Set up auth state change listener to handle login/logout events
     */
    private setupAuthStateListener(): void {
        // Remove any existing listener
        if (this.authStateUnsubscribe) {
            this.authStateUnsubscribe();
        }

        // Subscribe to authentication state changes
        this.authStateUnsubscribe = useAuthStore.subscribe(
            async (state) => {
                const isAuthenticated = state.isAuthenticated;

                if (isAuthenticated) {
                    // User has logged in, reset processed markers
                    const { resetProcessedMarkers } = useLocationStore
                        .getState();
                    resetProcessedMarkers();

                    // Start tracking if enabled
                    const { isTrackingEnabled } = useLocationStore.getState();
                    if (isTrackingEnabled) {
                        await this.startTracking();
                    }
                } else {
                    // User has logged out, stop tracking
                    await this.stopTracking();
                }
            },
        );

        // Track the subscription for automatic cleanup
        if (this.authStateUnsubscribe) {
            trackSubscription(this.authStateUnsubscribe);
        }
    }

    /**
     * Start location tracking
     */
    public async startTracking(): Promise<boolean> {
        try {
            console.log("🔄 TrackingManager: Attempting to start tracking...");

            // Check permissions first
            const permissionGranted = await requestLocationPermissions();
            if (!permissionGranted) {
                console.warn(
                    "⚠️ TrackingManager: Cannot start tracking - permissions not granted",
                );
                return false;
            }

            const started = await startLocationTracking();

            if (started) {
                const { setIsTrackingEnabled } = useLocationStore.getState();
                setIsTrackingEnabled(true);
                console.log(
                    "✅ TrackingManager: Tracking started successfully",
                );

                if (this.isFirstTrackingSession) {
                    this.isFirstTrackingSession = false;
                }
            } else {
                console.warn(
                    "⚠️ TrackingManager: Failed to start location tracking",
                );
            }

            return started;
        } catch (error) {
            console.error(
                "❌ TrackingManager: Error starting tracking:",
                error,
            );
            return false;
        }
    }

    /**
     * Stop location tracking
     */
    public async stopTracking(): Promise<boolean> {
        try {
            const stopped = await stopLocationTracking();

            if (stopped) {
                const { setIsTrackingEnabled } = useLocationStore.getState();
                setIsTrackingEnabled(false);
            }

            return stopped;
        } catch (error) {
            return false;
        }
    }

    /**
     * Set up app state listener for background/foreground changes
     */
    private setupAppStateListener(): void {
        // Remove any existing subscription
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
        }

        // Subscribe to app state changes
        this.appStateSubscription = AppState.addEventListener(
            "change",
            (nextAppState: AppStateStatus) => {
                const previousState = this.appState;
                this.appState = nextAppState;

                // Handle state transitions
                if (
                    previousState.match(/inactive|background/) &&
                    nextAppState === "active"
                ) {
                    // App has come to the foreground
                    this.handleAppForeground();
                } else if (
                    previousState === "active" &&
                    nextAppState.match(/inactive|background/)
                ) {
                    // App has gone to the background
                    this.handleAppBackground();
                }
            },
        );
    }

    /**
     * Handle app coming to foreground
     */
    private async handleAppForeground(): Promise<void> {
        const { isTrackingEnabled } = useLocationStore.getState();

        if (isTrackingEnabled) {
            // Ensure background tracking is still active
            await this.ensureBackgroundTracking();
        }
    }

    /**
     * Handle app going to background
     */
    private async handleAppBackground(): Promise<void> {
        const { isTrackingEnabled } = useLocationStore.getState();

        if (isTrackingEnabled) {
            // Ensure background tracking continues
            await this.ensureBackgroundTracking();
        }
    }

    /**
     * Ensure background tracking is active when needed
     */
    private async ensureBackgroundTracking(): Promise<void> {
        try {
            // Check if the background task is defined
            const isTaskDefined = await TaskManager.isTaskDefined(
                LOCATION_TRACKING_TASK,
            );

            if (!isTaskDefined) {
                // Task was lost, restart tracking
                await this.startTracking();
            }
        } catch (error) {
            // Silent error handling
        }
    }

    /**
     * Cleanup all resources
     */
    public cleanup(): void {
        // Remove app state listener
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        // Remove auth state listener
        if (this.authStateUnsubscribe) {
            untrackSubscription(this.authStateUnsubscribe);
            this.authStateUnsubscribe();
            this.authStateUnsubscribe = null;
        }

        // Reset state
        this.isInitialized = false;
        this.isFirstTrackingSession = true;
    }
}

// Export singleton instance
export const trackingManager = TrackingManager.getInstance();

// Convenience functions
export const initializeTrackingManager = () => trackingManager.initialize();
export const startTracking = () => trackingManager.startTracking();
export const stopTracking = () => trackingManager.stopTracking();
