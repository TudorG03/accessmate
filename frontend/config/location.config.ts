/**
 * Location Service Configuration Singleton
 * Centralizes all location-related constants and configuration
 */
export class LocationConfig {
    private static instance: LocationConfig;

    // Core Configuration
    private readonly _LOCATION_TRACKING_TASK = "background-location-tracking";
    private readonly _MARKER_PROXIMITY_THRESHOLD = 50; // meters
    private readonly _LOCATION_UPDATE_INTERVAL = 2000; // 2 seconds in milliseconds
    private readonly _CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
    private readonly _MARKER_FETCH_TIMEOUT = 10000; // 10 seconds in milliseconds
    private readonly _NOTIFICATION_TIMEOUT = 5000; // 5 seconds in milliseconds

    // Cooldown Configuration
    private readonly _MARKER_COOLDOWN_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

    // Distance Configuration
    private readonly _MINIMUM_DISTANCE_CHANGE = 10; // meters

    // Location Accuracy Configuration
    private readonly _LOCATION_ACCURACY = "balanced" as const;

    // Notification Configuration
    private readonly _NOTIFICATION_TITLE = "AccessMate";
    private readonly _NOTIFICATION_BODY =
        "Detecting nearby accessibility obstacles";
    private readonly _NOTIFICATION_COLOR = "#F1B24A";

    // Retry Configuration
    private readonly _MAX_RETRY_ATTEMPTS = 3;
    private readonly _RETRY_DELAY_BASE = 1000; // 1 second base delay for exponential backoff

    // Feature Flags
    private readonly _ENABLE_APP_STATE_MONITORING = true; // Monitor app background/foreground
    private readonly _ENABLE_AUTH_STATE_INTEGRATION = true; // Handle login/logout events

    private constructor() {
        // Private constructor to enforce singleton pattern
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): LocationConfig {
        if (!LocationConfig.instance) {
            LocationConfig.instance = new LocationConfig();
        }
        return LocationConfig.instance;
    }

    // Getters for accessing configuration values
    public get LOCATION_TRACKING_TASK(): string {
        return this._LOCATION_TRACKING_TASK;
    }

    public get MARKER_PROXIMITY_THRESHOLD(): number {
        return this._MARKER_PROXIMITY_THRESHOLD;
    }

    public get LOCATION_UPDATE_INTERVAL(): number {
        return this._LOCATION_UPDATE_INTERVAL;
    }

    public get CLEANUP_INTERVAL(): number {
        return this._CLEANUP_INTERVAL;
    }

    public get MARKER_FETCH_TIMEOUT(): number {
        return this._MARKER_FETCH_TIMEOUT;
    }

    public get NOTIFICATION_TIMEOUT(): number {
        return this._NOTIFICATION_TIMEOUT;
    }

    public get MARKER_COOLDOWN_DURATION(): number {
        return this._MARKER_COOLDOWN_DURATION;
    }

    public get MINIMUM_DISTANCE_CHANGE(): number {
        return this._MINIMUM_DISTANCE_CHANGE;
    }

    public get LOCATION_ACCURACY(): "balanced" {
        return this._LOCATION_ACCURACY;
    }

    public get NOTIFICATION_TITLE(): string {
        return this._NOTIFICATION_TITLE;
    }

    public get NOTIFICATION_BODY(): string {
        return this._NOTIFICATION_BODY;
    }

    public get NOTIFICATION_COLOR(): string {
        return this._NOTIFICATION_COLOR;
    }

    public get MAX_RETRY_ATTEMPTS(): number {
        return this._MAX_RETRY_ATTEMPTS;
    }

    public get RETRY_DELAY_BASE(): number {
        return this._RETRY_DELAY_BASE;
    }

    public get ENABLE_APP_STATE_MONITORING(): boolean {
        return this._ENABLE_APP_STATE_MONITORING;
    }

    public get ENABLE_AUTH_STATE_INTEGRATION(): boolean {
        return this._ENABLE_AUTH_STATE_INTEGRATION;
    }
}

/**
 * Convenience function to get the LocationConfig instance
 */
export const getLocationConfig = (): LocationConfig =>
    LocationConfig.getInstance();
