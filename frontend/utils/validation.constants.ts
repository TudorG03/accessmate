/**
 * Shared validation constants for consistent validation across the app
 * These should match the backend validation rules
 */

export const VALIDATION_RULES = {
    PASSWORD: {
        MIN_LENGTH: 8,
        REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
        MESSAGE:
            "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number",
    },
    EMAIL: {
        REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        MESSAGE: "Please enter a valid email address",
    },
    DISPLAY_NAME: {
        MIN_LENGTH: 2,
        MAX_LENGTH: 50,
        MESSAGE_MIN: "Display name must be at least 2 characters long",
        MESSAGE_MAX: "Display name cannot exceed 50 characters",
    },
    SEARCH: {
        MAX_LENGTH: 100,
        MIN_LENGTH: 1,
        REGEX: /^[a-zA-Z0-9\s\-.,!?'"\u00C0-\u017F]+$/,
        MESSAGE_LENGTH: "Search query is too long",
        MESSAGE_INVALID: "Search contains invalid characters",
    },
    DESCRIPTION: {
        REVIEW_MIN: 10,
        REVIEW_MAX: 1000,
        MARKER_MAX: 500,
        MESSAGE_REVIEW_MIN:
            "Description should be at least 10 characters if provided",
        MESSAGE_REVIEW_MAX: "Description must be less than 1000 characters",
        MESSAGE_MARKER_MAX: "Description must be less than 500 characters",
    },
    RATING: {
        MIN: 1,
        MAX: 5,
        MESSAGE: "Rating must be between 1 and 5",
    },
    SEARCH_RADIUS: {
        MIN: 1,
        MAX: 50,
        MESSAGE: "Search radius must be between 1 and 50 km",
    },
    LOCATION_NAME: {
        MIN_LENGTH: 2,
        MAX_LENGTH: 100,
        MESSAGE_MIN: "Location name must be at least 2 characters long",
        MESSAGE_MAX: "Location name cannot exceed 100 characters",
    },
    USERNAME: {
        MIN_LENGTH: 3,
        MAX_LENGTH: 30,
        REGEX: /^[a-zA-Z0-9_-]+$/,
        MESSAGE_MIN: "Username must be at least 3 characters long",
        MESSAGE_MAX: "Username cannot exceed 30 characters",
        MESSAGE_INVALID:
            "Username can only contain letters, numbers, underscores, and dashes",
    },
} as const;

export type ValidationRule = keyof typeof VALIDATION_RULES;
