import { AppState, AppStateStatus, Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import {
    LOCATION_TRACKING_TASK,
    requestLocationPermissions,
    startLocationTracking,
    stopLocationTracking,
} from "./location.service";
import {
    initializeNotifications,
    requestNotificationPermissions,
    sendTestNotification,
} from "./notification.service";
import { useLocationStore } from "@/stores/location/location.store";
import { useAuthStore } from "@/stores/auth/auth.store";
import { registerCleanupFunction } from "./cleanup.service";

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
            console.log("Tracking manager already initialized");
            return true;
        }

        try {
            console.log("Initializing tracking manager...");

            // Initialize notifications first
            await initializeNotifications();

            // Request location permissions
            const permissionGranted = await requestLocationPermissions();
            if (!permissionGranted) {
                console.log("Location permissions denied");
                return false;
            }

            // Start listeners
            this.setupListeners();

            // Check if location tracking is enabled in store
            const { isTrackingEnabled, clearExpiredProcessedMarkers } =
                useLocationStore.getState();

            // Clear processed markers to enable fresh notifications
            clearExpiredProcessedMarkers();

            // Start location tracking if enabled - for all users including new users
            if (isTrackingEnabled) {
                await this.startTracking();
            }

            // Register cleanup function
            registerCleanupFunction(() => this.cleanup());
            
            this.isInitialized = true;
            console.log("Tracking manager initialized successfully");
            return true;
        } catch (error) {
            console.error("Failed to initialize tracking manager:", error);
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
                console.log(
                    `Auth state changed: ${
                        isAuthenticated ? "Logged in" : "Logged out"
                    }`,
                );

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
    }

    /**
     * Start location tracking
     */
    public async startTracking(): Promise<boolean> {
        try {
            const started = await startLocationTracking();

            if (started) {
                const { setIsTrackingEnabled } = useLocationStore.getState();
                setIsTrackingEnabled(true);

                if (this.isFirstTrackingSession) {
                    this.isFirstTrackingSession = false;
                }
            }

            return started;
        } catch (error) {
            console.error("Error starting location tracking:", error);
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
                console.log("Location tracking stopped");
                const { setIsTrackingEnabled } = useLocationStore.getState();
                setIsTrackingEnabled(false);
            }

            return stopped;
        } catch (error) {
            console.error("Error stopping location tracking:", error);
            return false;
        }
    }

    /**
     * Set up app state change listener to handle background/foreground transitions
     */
    private setupAppStateListener(): void {
        if (this.appStateSubscription) {
            return;
        }

        this.appStateSubscription = AppState.addEventListener(
            "change",
            async (nextAppState) => {
                if (
                    this.appState === "active" &&
                    nextAppState.match(/inactive|background/)
                ) {
                    // App is going to background
                    console.log("App is going to background");

                    // Check if tracking is enabled
                    const { isTrackingEnabled } = useLocationStore.getState();
                    if (isTrackingEnabled) {
                        // Make sure tracking continues in background
                        this.ensureBackgroundTracking();
                    }
                } else if (
                    nextAppState === "active" &&
                    this.appState.match(/inactive|background/)
                ) {
                    // App is coming to foreground
                    console.log("App is coming to foreground");

                    // Check if tracking task is still running
                    const { isTrackingEnabled } = useLocationStore.getState();
                    if (isTrackingEnabled) {
                        const isRunning = await Location
                            .hasStartedLocationUpdatesAsync(
                                LOCATION_TRACKING_TASK,
                            )
                            .catch(() => false);

                        if (!isRunning) {
                            // Restart tracking if it's not running
                            console.log("Restarting location tracking...");
                            await this.startTracking();
                        }
                    }
                }

                this.appState = nextAppState;
            },
        );
    }

    /**
     * Ensure background tracking is properly configured
     */
    private async ensureBackgroundTracking(): Promise<void> {
        try {
            // Check if the task is registered and running
            const isTaskDefined = TaskManager.isTaskDefined(
                LOCATION_TRACKING_TASK,
            );
            if (!isTaskDefined) {
                console.warn("Location tracking task is not defined");
                return;
            }

            const isTracking = await Location.hasStartedLocationUpdatesAsync(
                LOCATION_TRACKING_TASK,
            )
                .catch(() => false);

            if (!isTracking) {
                console.log("Background tracking not active, restarting...");
                await this.startTracking();
            }
        } catch (error) {
            console.error("Error ensuring background tracking:", error);
        }
    }

    /**
     * Clean up resources
     */
    public cleanup(): void {
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        if (this.authStateUnsubscribe) {
            this.authStateUnsubscribe();
            this.authStateUnsubscribe = null;
        }

        this.isInitialized = false;
    }
}

// Export singleton instance
export const trackingManager = TrackingManager.getInstance();
