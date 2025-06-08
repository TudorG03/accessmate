import { VALIDATION_RULES } from "./validation.constants";

/**
 * Common validation utilities for input fields
 */

export interface ValidationResult {
    isValid: boolean;
    message?: string;
}

/**
 * Validates text input with length constraints
 */
export const validateTextInput = (
    text: string,
    options: {
        required?: boolean;
        minLength?: number;
        maxLength?: number;
        fieldName?: string;
    },
): ValidationResult => {
    const { required = false, minLength, maxLength, fieldName = "Field" } =
        options;

    if (required && !text.trim()) {
        return { isValid: false, message: `${fieldName} is required` };
    }

    if (text && minLength && text.trim().length < minLength) {
        return {
            isValid: false,
            message:
                `${fieldName} must be at least ${minLength} characters long`,
        };
    }

    if (text && maxLength && text.trim().length > maxLength) {
        return {
            isValid: false,
            message: `${fieldName} must be less than ${maxLength} characters`,
        };
    }

    return { isValid: true };
};

/**
 * Validates review description
 */
export const validateReviewDescription = (
    description: string,
): ValidationResult => {
    return validateTextInput(description, {
        minLength: VALIDATION_RULES.DESCRIPTION.REVIEW_MIN,
        maxLength: VALIDATION_RULES.DESCRIPTION.REVIEW_MAX,
        fieldName: "Description",
    });
};

/**
 * Validates marker description
 */
export const validateMarkerDescription = (
    description: string,
): ValidationResult => {
    return validateTextInput(description, {
        maxLength: VALIDATION_RULES.DESCRIPTION.MARKER_MAX,
        fieldName: "Description",
    });
};

/**
 * Validates search query
 */
export const validateSearchQuery = (query: string): ValidationResult => {
    if (!query.trim()) {
        return { isValid: false, message: "Search query cannot be empty" };
    }

    if (query.length > VALIDATION_RULES.SEARCH.MAX_LENGTH) {
        return {
            isValid: false,
            message: VALIDATION_RULES.SEARCH.MESSAGE_LENGTH,
        };
    }

    if (!VALIDATION_RULES.SEARCH.REGEX.test(query)) {
        return {
            isValid: false,
            message: VALIDATION_RULES.SEARCH.MESSAGE_INVALID,
        };
    }

    return { isValid: true };
};

/**
 * Sanitizes user input to prevent potential security issues
 * Preserves internal spaces for fields that need them
 */
export const sanitizeInput = (input: string): string => {
    return input
        .replace(/[<>]/g, "") // Remove potential HTML tags
        .replace(/javascript:/gi, "") // Remove javascript: protocol
        .replace(/on\w+=/gi, ""); // Remove event handlers
};

/**
 * Sanitizes input and trims whitespace (for fields that don't need internal spaces)
 */
export const sanitizeAndTrim = (input: string): string => {
    return sanitizeInput(input).trim();
};

/**
 * Validates location name
 */
export const validateLocationName = (name: string): ValidationResult => {
    return validateTextInput(name, {
        required: true,
        minLength: VALIDATION_RULES.LOCATION_NAME.MIN_LENGTH,
        maxLength: VALIDATION_RULES.LOCATION_NAME.MAX_LENGTH,
        fieldName: "Location name",
    });
};

/**
 * Validates rating (1-5 scale)
 */
export const validateRating = (rating: number): ValidationResult => {
    if (
        !rating || rating < VALIDATION_RULES.RATING.MIN ||
        rating > VALIDATION_RULES.RATING.MAX
    ) {
        return { isValid: false, message: VALIDATION_RULES.RATING.MESSAGE };
    }
    return { isValid: true };
};

/**
 * Validates password strength
 */
export const validatePassword = (password: string): ValidationResult => {
    if (!password) {
        return { isValid: false, message: "Password is required" };
    }

    if (password.length < VALIDATION_RULES.PASSWORD.MIN_LENGTH) {
        return { isValid: false, message: VALIDATION_RULES.PASSWORD.MESSAGE };
    }

    if (!VALIDATION_RULES.PASSWORD.REGEX.test(password)) {
        return { isValid: false, message: VALIDATION_RULES.PASSWORD.MESSAGE };
    }

    return { isValid: true };
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): ValidationResult => {
    if (!email) {
        return { isValid: false, message: "Email is required" };
    }

    if (!VALIDATION_RULES.EMAIL.REGEX.test(email)) {
        return { isValid: false, message: VALIDATION_RULES.EMAIL.MESSAGE };
    }

    return { isValid: true };
};

/**
 * Validates display name
 */
export const validateDisplayName = (name: string): ValidationResult => {
    return validateTextInput(name, {
        required: true,
        minLength: VALIDATION_RULES.DISPLAY_NAME.MIN_LENGTH,
        maxLength: VALIDATION_RULES.DISPLAY_NAME.MAX_LENGTH,
        fieldName: "Display name",
    });
};

/**
 * Validates username
 */
export const validateUsername = (username: string): ValidationResult => {
    if (!username) {
        return { isValid: false, message: "Username is required" };
    }

    if (username.length < VALIDATION_RULES.USERNAME.MIN_LENGTH) {
        return {
            isValid: false,
            message: VALIDATION_RULES.USERNAME.MESSAGE_MIN,
        };
    }

    if (username.length > VALIDATION_RULES.USERNAME.MAX_LENGTH) {
        return {
            isValid: false,
            message: VALIDATION_RULES.USERNAME.MESSAGE_MAX,
        };
    }

    if (!VALIDATION_RULES.USERNAME.REGEX.test(username)) {
        return {
            isValid: false,
            message: VALIDATION_RULES.USERNAME.MESSAGE_INVALID,
        };
    }

    return { isValid: true };
};

/**
 * Validates search radius
 */
export const validateSearchRadius = (radius: number): ValidationResult => {
    if (
        !radius || radius < VALIDATION_RULES.SEARCH_RADIUS.MIN ||
        radius > VALIDATION_RULES.SEARCH_RADIUS.MAX
    ) {
        return {
            isValid: false,
            message: VALIDATION_RULES.SEARCH_RADIUS.MESSAGE,
        };
    }
    return { isValid: true };
};

/**
 * Validates numeric input with constraints
 */
export const validateNumericInput = (
    value: string | number,
    options: {
        required?: boolean;
        min?: number;
        max?: number;
        fieldName?: string;
        allowDecimals?: boolean;
    },
): ValidationResult => {
    const {
        required = false,
        min,
        max,
        fieldName = "Field",
        allowDecimals = true,
    } = options;

    if (required && (value === "" || value === null || value === undefined)) {
        return { isValid: false, message: `${fieldName} is required` };
    }

    if (value === "" || value === null || value === undefined) {
        return { isValid: true }; // Optional field
    }

    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) {
        return {
            isValid: false,
            message: `${fieldName} must be a valid number`,
        };
    }

    if (!allowDecimals && numValue % 1 !== 0) {
        return {
            isValid: false,
            message: `${fieldName} must be a whole number`,
        };
    }

    if (min !== undefined && numValue < min) {
        return {
            isValid: false,
            message: `${fieldName} must be at least ${min}`,
        };
    }

    if (max !== undefined && numValue > max) {
        return {
            isValid: false,
            message: `${fieldName} must be at most ${max}`,
        };
    }

    return { isValid: true };
};
