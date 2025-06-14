/**
 * Notification Service Configuration Singleton
 * Centralizes all notification-related constants and configuration
 */
export class NotificationConfig {
    private static instance: NotificationConfig;

    // Channel Configuration
    private readonly _OBSTACLE_NOTIFICATION_CHANNEL = "obstacle-notifications";
    private readonly _LOCATION_BASED_CATEGORY = "location-based";
    private readonly _OBSTACLE_VALIDATION_CATEGORY = "obstacle-validation";

    // Channel Properties
    private readonly _CHANNEL_NAME = "Obstacle Notifications";
    private readonly _CHANNEL_DESCRIPTION =
        "Notifications about nearby accessibility obstacles";
    private readonly _CHANNEL_LIGHT_COLOR = "#FF231F7C";
    private readonly _CHANNEL_VIBRATION_PATTERN = [0, 250, 250, 250];

    // Notification Content Templates
    private readonly _NOTIFICATION_TITLE_TEMPLATE = "Nearby {obstacleType}";
    private readonly _SINGULAR_BODY_TEMPLATE =
        "There is {count} {obstacleType} obstacle nearby. Is it still there?";
    private readonly _PLURAL_BODY_TEMPLATE =
        "There are {count} {obstacleType} obstacles nearby. Is it still there?";

    // Button Text
    private readonly _YES_BUTTON_TEXT = "✅ Yes, still there";
    private readonly _NO_BUTTON_TEXT = "❌ No, it's gone";
    private readonly _UNSURE_BUTTON_TEXT = "🤷 Not sure";
    private readonly _VIEW_BUTTON_TEXT = "View";

    // Alert Messages
    private readonly _PERMISSION_ERROR_TITLE = "Error";
    private readonly _PERMISSION_ERROR_MESSAGE =
        "Sorry, there was an error processing your notification tap. Please try again.";
    private readonly _VALIDATION_ERROR_TITLE = "Error";
    private readonly _VALIDATION_ERROR_MESSAGE =
        "Sorry, there was an error showing the validation prompt.";

    // Feedback Messages
    private readonly _CONFIRMED_FEEDBACK_TEMPLATE =
        "🙏 Thank you for confirming the {obstacleType} is still there!";
    private readonly _REMOVED_FEEDBACK_TEMPLATE =
        "🙏 Thank you for letting us know the {obstacleType} is gone!";
    private readonly _UNSURE_FEEDBACK_MESSAGE =
        "Thanks for taking the time to check - your participation helps improve accessibility for everyone.";
    private readonly _ERROR_FEEDBACK_MESSAGE =
        "Sorry, there was an error processing your response. Your feedback is still valuable to us!";

    // Time Display Constants
    private readonly _TIME_JUST_NOW = "just now";
    private readonly _TIME_MINUTE_SINGULAR = "minute";
    private readonly _TIME_MINUTE_PLURAL = "minutes";
    private readonly _TIME_HOUR_SINGULAR = "hour";
    private readonly _TIME_HOUR_PLURAL = "hours";
    private readonly _TIME_DAY_SINGULAR = "day";
    private readonly _TIME_DAY_PLURAL = "days";
    private readonly _TIME_AGO_SUFFIX = "ago";
    private readonly _TIME_RECENTLY_FALLBACK = "recently";

    // Time Calculation Constants
    private readonly _MILLISECONDS_PER_MINUTE = 1000 * 60;
    private readonly _MINUTES_PER_HOUR = 60;
    private readonly _HOURS_PER_DAY = 24;

    // Location-Based Notification Configuration
    private readonly _LOCATION_COOLDOWN_PERIOD = 10 * 60 * 1000; // 10 minutes in milliseconds
    private readonly _EARTH_RADIUS_METERS = 6371000; // Earth's radius in meters for distance calculations
    private readonly _DEGREES_TO_RADIANS_MULTIPLIER = Math.PI / 180;

    // Trigger Radius Configuration
    private readonly _OBSTACLE_TRIGGER_RADIUS = 50; // 50 meters
    private readonly _DESTINATION_TRIGGER_RADIUS = 20; // 20 meters

    // Notification Priority and Behavior
    private readonly _SHOW_ALERT = true;
    private readonly _PLAY_SOUND = true;
    private readonly _SET_BADGE = true;
    private readonly _DEFAULT_SOUND = "default";

    // Location-Based Notification Templates
    private readonly _OBSTACLE_ALERT_TITLE = "Accessibility Alert";
    private readonly _OBSTACLE_ALERT_BODY_TEMPLATE =
        "{obstacleType} detected nearby. Please be cautious.";
    private readonly _DESTINATION_ALERT_TITLE = "Destination Nearby";
    private readonly _DESTINATION_ALERT_BODY_TEMPLATE =
        "You're approaching {destinationName}";

    // Validation Modal Configuration
    private readonly _VALIDATION_MODAL_TITLE_TEMPLATE =
        "🚧 Validate {obstacleType}";
    private readonly _SINGULAR_VALIDATION_MESSAGE_TEMPLATE =
        "We detected a {obstacleType} obstacle near your location{timeInfo}.\n\nIs this obstacle still present?";
    private readonly _PLURAL_VALIDATION_MESSAGE_TEMPLATE =
        "We detected {count} {obstacleType} obstacles near your location{timeInfo}.\n\nAre these obstacles still present?";

    // String Transformation Patterns
    private readonly _UNDERSCORE_REPLACEMENT = " ";
    private readonly _WORD_CAPITALIZATION_REGEX = /\b\w/g;

    private constructor() {
        // Private constructor to enforce singleton pattern
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): NotificationConfig {
        if (!NotificationConfig.instance) {
            NotificationConfig.instance = new NotificationConfig();
        }
        return NotificationConfig.instance;
    }

    // Channel Configuration Getters
    public get OBSTACLE_NOTIFICATION_CHANNEL(): string {
        return this._OBSTACLE_NOTIFICATION_CHANNEL;
    }

    public get LOCATION_BASED_CATEGORY(): string {
        return this._LOCATION_BASED_CATEGORY;
    }

    public get OBSTACLE_VALIDATION_CATEGORY(): string {
        return this._OBSTACLE_VALIDATION_CATEGORY;
    }

    public get CHANNEL_NAME(): string {
        return this._CHANNEL_NAME;
    }

    public get CHANNEL_DESCRIPTION(): string {
        return this._CHANNEL_DESCRIPTION;
    }

    public get CHANNEL_LIGHT_COLOR(): string {
        return this._CHANNEL_LIGHT_COLOR;
    }

    public get CHANNEL_VIBRATION_PATTERN(): number[] {
        return [...this._CHANNEL_VIBRATION_PATTERN];
    }

    // Content Template Getters
    public get NOTIFICATION_TITLE_TEMPLATE(): string {
        return this._NOTIFICATION_TITLE_TEMPLATE;
    }

    public get SINGULAR_BODY_TEMPLATE(): string {
        return this._SINGULAR_BODY_TEMPLATE;
    }

    public get PLURAL_BODY_TEMPLATE(): string {
        return this._PLURAL_BODY_TEMPLATE;
    }

    // Button Text Getters
    public get YES_BUTTON_TEXT(): string {
        return this._YES_BUTTON_TEXT;
    }

    public get NO_BUTTON_TEXT(): string {
        return this._NO_BUTTON_TEXT;
    }

    public get UNSURE_BUTTON_TEXT(): string {
        return this._UNSURE_BUTTON_TEXT;
    }

    public get VIEW_BUTTON_TEXT(): string {
        return this._VIEW_BUTTON_TEXT;
    }

    // Alert Message Getters
    public get PERMISSION_ERROR_TITLE(): string {
        return this._PERMISSION_ERROR_TITLE;
    }

    public get PERMISSION_ERROR_MESSAGE(): string {
        return this._PERMISSION_ERROR_MESSAGE;
    }

    public get VALIDATION_ERROR_TITLE(): string {
        return this._VALIDATION_ERROR_TITLE;
    }

    public get VALIDATION_ERROR_MESSAGE(): string {
        return this._VALIDATION_ERROR_MESSAGE;
    }

    // Feedback Message Getters
    public get CONFIRMED_FEEDBACK_TEMPLATE(): string {
        return this._CONFIRMED_FEEDBACK_TEMPLATE;
    }

    public get REMOVED_FEEDBACK_TEMPLATE(): string {
        return this._REMOVED_FEEDBACK_TEMPLATE;
    }

    public get UNSURE_FEEDBACK_MESSAGE(): string {
        return this._UNSURE_FEEDBACK_MESSAGE;
    }

    public get ERROR_FEEDBACK_MESSAGE(): string {
        return this._ERROR_FEEDBACK_MESSAGE;
    }

    // Time Constants Getters
    public get TIME_JUST_NOW(): string {
        return this._TIME_JUST_NOW;
    }

    public get TIME_MINUTE_SINGULAR(): string {
        return this._TIME_MINUTE_SINGULAR;
    }

    public get TIME_MINUTE_PLURAL(): string {
        return this._TIME_MINUTE_PLURAL;
    }

    public get TIME_HOUR_SINGULAR(): string {
        return this._TIME_HOUR_SINGULAR;
    }

    public get TIME_HOUR_PLURAL(): string {
        return this._TIME_HOUR_PLURAL;
    }

    public get TIME_DAY_SINGULAR(): string {
        return this._TIME_DAY_SINGULAR;
    }

    public get TIME_DAY_PLURAL(): string {
        return this._TIME_DAY_PLURAL;
    }

    public get TIME_AGO_SUFFIX(): string {
        return this._TIME_AGO_SUFFIX;
    }

    public get TIME_RECENTLY_FALLBACK(): string {
        return this._TIME_RECENTLY_FALLBACK;
    }

    // Time Calculation Constants
    public get MILLISECONDS_PER_MINUTE(): number {
        return this._MILLISECONDS_PER_MINUTE;
    }

    public get MINUTES_PER_HOUR(): number {
        return this._MINUTES_PER_HOUR;
    }

    public get HOURS_PER_DAY(): number {
        return this._HOURS_PER_DAY;
    }

    // Location Configuration Getters
    public get LOCATION_COOLDOWN_PERIOD(): number {
        return this._LOCATION_COOLDOWN_PERIOD;
    }

    public get EARTH_RADIUS_METERS(): number {
        return this._EARTH_RADIUS_METERS;
    }

    public get DEGREES_TO_RADIANS_MULTIPLIER(): number {
        return this._DEGREES_TO_RADIANS_MULTIPLIER;
    }

    public get OBSTACLE_TRIGGER_RADIUS(): number {
        return this._OBSTACLE_TRIGGER_RADIUS;
    }

    public get DESTINATION_TRIGGER_RADIUS(): number {
        return this._DESTINATION_TRIGGER_RADIUS;
    }

    // Notification Behavior Getters
    public get SHOW_ALERT(): boolean {
        return this._SHOW_ALERT;
    }

    public get PLAY_SOUND(): boolean {
        return this._PLAY_SOUND;
    }

    public get SET_BADGE(): boolean {
        return this._SET_BADGE;
    }

    public get DEFAULT_SOUND(): string {
        return this._DEFAULT_SOUND;
    }

    // Location-Based Alert Getters
    public get OBSTACLE_ALERT_TITLE(): string {
        return this._OBSTACLE_ALERT_TITLE;
    }

    public get OBSTACLE_ALERT_BODY_TEMPLATE(): string {
        return this._OBSTACLE_ALERT_BODY_TEMPLATE;
    }

    public get DESTINATION_ALERT_TITLE(): string {
        return this._DESTINATION_ALERT_TITLE;
    }

    public get DESTINATION_ALERT_BODY_TEMPLATE(): string {
        return this._DESTINATION_ALERT_BODY_TEMPLATE;
    }

    // Validation Modal Getters
    public get VALIDATION_MODAL_TITLE_TEMPLATE(): string {
        return this._VALIDATION_MODAL_TITLE_TEMPLATE;
    }

    public get SINGULAR_VALIDATION_MESSAGE_TEMPLATE(): string {
        return this._SINGULAR_VALIDATION_MESSAGE_TEMPLATE;
    }

    public get PLURAL_VALIDATION_MESSAGE_TEMPLATE(): string {
        return this._PLURAL_VALIDATION_MESSAGE_TEMPLATE;
    }

    // String Transformation Getters
    public get UNDERSCORE_REPLACEMENT(): string {
        return this._UNDERSCORE_REPLACEMENT;
    }

    public get WORD_CAPITALIZATION_REGEX(): RegExp {
        return this._WORD_CAPITALIZATION_REGEX;
    }

    // Utility Methods
    /**
     * Format obstacle type for display (replace underscores and capitalize)
     */
    public formatObstacleType(obstacleType: string): string {
        return obstacleType
            .replace(/_/g, this._UNDERSCORE_REPLACEMENT)
            .replace(
                this._WORD_CAPITALIZATION_REGEX,
                (char) => char.toUpperCase(),
            );
    }

    /**
     * Get notification title with formatted obstacle type
     */
    public getNotificationTitle(obstacleType: string): string {
        return this._NOTIFICATION_TITLE_TEMPLATE.replace(
            "{obstacleType}",
            this.formatObstacleType(obstacleType),
        );
    }

    /**
     * Get notification body based on marker count
     */
    public getNotificationBody(
        obstacleType: string,
        markerCount: number,
    ): string {
        const template = markerCount === 1
            ? this._SINGULAR_BODY_TEMPLATE
            : this._PLURAL_BODY_TEMPLATE;

        return template
            .replace("{count}", markerCount.toString())
            .replace(
                "{obstacleType}",
                this.formatObstacleType(obstacleType).toLowerCase(),
            );
    }

    /**
     * Get validation modal title
     */
    public getValidationModalTitle(obstacleType: string): string {
        return this._VALIDATION_MODAL_TITLE_TEMPLATE.replace(
            "{obstacleType}",
            this.formatObstacleType(obstacleType),
        );
    }

    /**
     * Get validation message based on marker count
     */
    public getValidationMessage(
        obstacleType: string,
        markerCount: number,
        timeInfo: string = "",
    ): string {
        const template = markerCount === 1
            ? this._SINGULAR_VALIDATION_MESSAGE_TEMPLATE
            : this._PLURAL_VALIDATION_MESSAGE_TEMPLATE;

        return template
            .replace(
                "{obstacleType}",
                this.formatObstacleType(obstacleType).toLowerCase(),
            )
            .replace("{count}", markerCount.toString())
            .replace("{timeInfo}", timeInfo);
    }

    /**
     * Get feedback message based on response
     */
    public getFeedbackMessage(
        response: boolean | null,
        obstacleType: string,
    ): string {
        if (response === true) {
            return this._CONFIRMED_FEEDBACK_TEMPLATE.replace(
                "{obstacleType}",
                this.formatObstacleType(obstacleType).toLowerCase(),
            );
        } else if (response === false) {
            return this._REMOVED_FEEDBACK_TEMPLATE.replace(
                "{obstacleType}",
                this.formatObstacleType(obstacleType).toLowerCase(),
            );
        } else {
            return this._UNSURE_FEEDBACK_MESSAGE;
        }
    }

    /**
     * Get obstacle alert body
     */
    public getObstacleAlertBody(obstacleType: string): string {
        return this._OBSTACLE_ALERT_BODY_TEMPLATE.replace(
            "{obstacleType}",
            obstacleType,
        );
    }

    /**
     * Get destination alert body
     */
    public getDestinationAlertBody(destinationName: string): string {
        return this._DESTINATION_ALERT_BODY_TEMPLATE.replace(
            "{destinationName}",
            destinationName,
        );
    }

    /**
     * Convert degrees to radians
     */
    public degToRad(degrees: number): number {
        return degrees * this._DEGREES_TO_RADIANS_MULTIPLIER;
    }

    /**
     * Format time ago string
     */
    public formatTimeAgo(diffInMins: number): string {
        if (diffInMins < 1) {
            return this._TIME_JUST_NOW;
        } else if (diffInMins < this._MINUTES_PER_HOUR) {
            const unit = diffInMins === 1
                ? this._TIME_MINUTE_SINGULAR
                : this._TIME_MINUTE_PLURAL;
            return `${diffInMins} ${unit} ${this._TIME_AGO_SUFFIX}`;
        } else {
            const diffInHours = Math.floor(diffInMins / this._MINUTES_PER_HOUR);
            if (diffInHours < this._HOURS_PER_DAY) {
                const unit = diffInHours === 1
                    ? this._TIME_HOUR_SINGULAR
                    : this._TIME_HOUR_PLURAL;
                return `${diffInHours} ${unit} ${this._TIME_AGO_SUFFIX}`;
            } else {
                const diffInDays = Math.floor(
                    diffInHours / this._HOURS_PER_DAY,
                );
                const unit = diffInDays === 1
                    ? this._TIME_DAY_SINGULAR
                    : this._TIME_DAY_PLURAL;
                return `${diffInDays} ${unit} ${this._TIME_AGO_SUFFIX}`;
            }
        }
    }
}

/**
 * Convenience function to get the NotificationConfig instance
 */
export const getNotificationConfig = (): NotificationConfig =>
    NotificationConfig.getInstance();
