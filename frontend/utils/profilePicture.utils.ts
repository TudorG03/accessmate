/**
 * Utility functions for profile picture handling
 */

export interface ProfilePictureValidation {
    isValid: boolean;
    message?: string;
}

/**
 * Validates a profile picture data URL
 */
export const validateProfilePicture = (
    profilePicture: string,
): ProfilePictureValidation => {
    if (!profilePicture) {
        return { isValid: true }; // Optional field
    }

    // Check if it's a valid base64 data URL for images
    if (
        !profilePicture.startsWith("data:image/") ||
        !profilePicture.includes("base64,")
    ) {
        return {
            isValid: false,
            message: "Profile picture must be a valid base64 image data URL",
        };
    }

    // Check file size (base64 string length should be reasonable)
    // Base64 encoding increases size by ~33%, so 2MB image = ~2.7MB base64
    // Let's limit to ~4MB base64 string (≈3MB original image)
    if (profilePicture.length > 4 * 1024 * 1024) {
        return {
            isValid: false,
            message:
                "Profile picture is too large. Please use an image smaller than 3MB",
        };
    }

    return { isValid: true };
};

/**
 * Creates a data URL from image picker result
 */
export const createProfilePictureDataUrl = (
    base64: string,
    mimeType: string = "jpeg",
): string => {
    return `data:image/${mimeType};base64,${base64}`;
};

/**
 * Extracts base64 data from a data URL
 */
export const extractBase64FromDataUrl = (dataUrl: string): string | null => {
    const base64Index = dataUrl.indexOf("base64,");
    if (base64Index === -1) {
        return null;
    }
    return dataUrl.substring(base64Index + 7);
};

/**
 * Gets the mime type from a data URL
 */
export const getMimeTypeFromDataUrl = (dataUrl: string): string | null => {
    const match = dataUrl.match(/data:image\/([a-zA-Z]*);base64,/);
    return match ? match[1] : null;
};

/**
 * Checks if a string is a valid profile picture data URL
 */
export const isProfilePictureDataUrl = (str: string): boolean => {
    return str.startsWith("data:image/") && str.includes("base64,");
};
