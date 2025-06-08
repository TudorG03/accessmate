/**
 * Location Service Configuration Singleton
 * Centralizes all location-related constants and configuration
 */
export class LocationConfig {
    private static instance: LocationConfig;
    
    // Core Configuration
    private readonly _LOCATION_TRACKING_TASK = "background-location-tracking";
    private readonly _MARKER_PROXIMITY_THRESHOLD = 100; // meters
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
    private readonly _NOTIFICATION_BODY = "Detecting nearby accessibility obstacles";
    private readonly _NOTIFICATION_COLOR = "#F1B24A";
    
    // Retry Configuration
    private readonly _MAX_RETRY_ATTEMPTS = 3;
    private readonly _RETRY_DELAY_BASE = 1000; // 1 second base delay for exponential backoff
    
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
    
    /**
     * Get all configuration as a read-only object for debugging
     */
    public getConfigSnapshot(): Readonly<{
        LOCATION_TRACKING_TASK: string;
        MARKER_PROXIMITY_THRESHOLD: number;
        LOCATION_UPDATE_INTERVAL: number;
        CLEANUP_INTERVAL: number;
        MARKER_FETCH_TIMEOUT: number;
        NOTIFICATION_TIMEOUT: number;
        MARKER_COOLDOWN_DURATION: number;
        MINIMUM_DISTANCE_CHANGE: number;
        LOCATION_ACCURACY: string;
        NOTIFICATION_TITLE: string;
        NOTIFICATION_BODY: string;
        NOTIFICATION_COLOR: string;
        MAX_RETRY_ATTEMPTS: number;
        RETRY_DELAY_BASE: number;
    }> {
        return {
            LOCATION_TRACKING_TASK: this._LOCATION_TRACKING_TASK,
            MARKER_PROXIMITY_THRESHOLD: this._MARKER_PROXIMITY_THRESHOLD,
            LOCATION_UPDATE_INTERVAL: this._LOCATION_UPDATE_INTERVAL,
            CLEANUP_INTERVAL: this._CLEANUP_INTERVAL,
            MARKER_FETCH_TIMEOUT: this._MARKER_FETCH_TIMEOUT,
            NOTIFICATION_TIMEOUT: this._NOTIFICATION_TIMEOUT,
            MARKER_COOLDOWN_DURATION: this._MARKER_COOLDOWN_DURATION,
            MINIMUM_DISTANCE_CHANGE: this._MINIMUM_DISTANCE_CHANGE,
            LOCATION_ACCURACY: this._LOCATION_ACCURACY,
            NOTIFICATION_TITLE: this._NOTIFICATION_TITLE,
            NOTIFICATION_BODY: this._NOTIFICATION_BODY,
            NOTIFICATION_COLOR: this._NOTIFICATION_COLOR,
            MAX_RETRY_ATTEMPTS: this._MAX_RETRY_ATTEMPTS,
            RETRY_DELAY_BASE: this._RETRY_DELAY_BASE,
        } as const;
    }
    
    /**
     * Log current configuration for debugging
     */
    public logConfiguration(): void {
        console.log("📍 Location Service Configuration:", this.getConfigSnapshot());
    }
    
    /**
     * Validate configuration values
     */
    public validateConfiguration(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        if (this._MARKER_PROXIMITY_THRESHOLD <= 0) {
            errors.push("MARKER_PROXIMITY_THRESHOLD must be greater than 0");
        }
        
        if (this._LOCATION_UPDATE_INTERVAL < 1000) {
            errors.push("LOCATION_UPDATE_INTERVAL should be at least 1000ms to avoid excessive battery drain");
        }
        
        if (this._MARKER_FETCH_TIMEOUT < 5000) {
            errors.push("MARKER_FETCH_TIMEOUT should be at least 5000ms for reliable network requests");
        }
        
        if (this._NOTIFICATION_TIMEOUT < 1000) {
            errors.push("NOTIFICATION_TIMEOUT should be at least 1000ms");
        }
        
        if (this._MARKER_COOLDOWN_DURATION < 60000) { // 1 minute minimum
            errors.push("MARKER_COOLDOWN_DURATION should be at least 60000ms (1 minute)");
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

/**
 * Convenience function to get the LocationConfig instance
 */
export const getLocationConfig = (): LocationConfig => LocationConfig.getInstance();

/**
 * Type for location configuration snapshot
 */
export type LocationConfigSnapshot = ReturnType<LocationConfig["getConfigSnapshot"]>; 