import * as Notifications from "expo-notifications";
import { Alert, ToastAndroid } from "react-native";
import { MarkerService } from "@/stores/marker/marker.service";
import { getNotificationConfig } from "@/config/notification.config";

// Get configuration instance
const config = getNotificationConfig();

// Store the subscription reference
let notificationSubscription: Notifications.Subscription | null = null;

// Store a reference to the obstacle validation function
let showObstacleValidationModal: ((data: any, callback: any) => void) | null =
    null;

/**
 * Set the obstacle validation modal function
 */
export function setObstacleValidationModal(
    modalFunction: (data: any, callback: any) => void,
): void {
    showObstacleValidationModal = modalFunction;
}

/**
 * Clear the obstacle validation modal function reference
 */
export function clearObstacleValidationModal(): void {
    showObstacleValidationModal = null;
}

/**
 * Handle notification tap events
 */
export async function handleNotificationTap(
    response: Notifications.NotificationResponse,
): Promise<void> {
    try {
        // Extract notification data
        const data = response.notification.request.content.data;

        // Check if this is an obstacle validation notification
        if (data?.requiresValidation) {
            // Process the validation notification
            const markerIds = data.markerIds || [];
            const obstacleType = data.obstacleType || "unknown";
            const timestamp = data.timestamp;

            if (markerIds.length > 0) {
                await promptObstacleValidation(
                    obstacleType,
                    markerIds,
                    timestamp,
                );
            }
        }
    } catch (error) {
        // Show a generic error message to the user
        Alert.alert(
            config.PERMISSION_ERROR_TITLE,
            config.PERMISSION_ERROR_MESSAGE,
            [{ text: "OK", style: "default" }],
        );
    }
}

/**
 * Show a prompt asking the user to validate if an obstacle still exists
 */
async function promptObstacleValidation(
    obstacleType: string,
    markerIds: string[],
    timestamp?: string,
): Promise<void> {
    try {
        const markerCount = markerIds.length;
        const timeAgo = timestamp ? getTimeAgo(timestamp) : undefined;

        // Check if we have the modal function available
        if (showObstacleValidationModal) {
            // Use the new modal system
            const validationData = {
                obstacleType,
                markerIds,
                markerCount,
                timeAgo,
            };

            showObstacleValidationModal(
                validationData,
                handleValidationResponse,
            );
        } else {
            // Fallback to alert system if modal is not available
            await showFallbackAlert(obstacleType, markerIds, timeAgo);
        }
    } catch (error) {
        Alert.alert(
            config.VALIDATION_ERROR_TITLE,
            config.VALIDATION_ERROR_MESSAGE,
            [{ text: "OK", style: "default" }],
        );
    }
}

/**
 * Fallback alert system when modal is not available
 */
async function showFallbackAlert(
    obstacleType: string,
    markerIds: string[],
    timeAgo?: string,
): Promise<void> {
    const markerCount = markerIds.length;
    const timeInfo = timeAgo ? ` (detected ${timeAgo})` : "";

    // Create a more detailed message
    const message = config.getValidationMessage(
        obstacleType,
        markerCount,
        timeInfo,
    );

    // Show a prompt to the user with enhanced options
    Alert.alert(
        config.getValidationModalTitle(obstacleType),
        message,
        [
            {
                text: config.YES_BUTTON_TEXT,
                onPress: () =>
                    handleValidationResponse(true, markerIds, obstacleType),
                style: "default",
            },
            {
                text: config.NO_BUTTON_TEXT,
                onPress: () =>
                    handleValidationResponse(false, markerIds, obstacleType),
                style: "destructive",
            },
            {
                text: config.UNSURE_BUTTON_TEXT,
                onPress: () =>
                    handleValidationResponse(null, markerIds, obstacleType),
                style: "cancel",
            },
        ],
        {
            cancelable: true,
        },
    );
}

/**
 * Handle validation response from user
 */
async function handleValidationResponse(
    response: boolean | null, // true = still exists, false = removed, null = unsure
    markerIds: string[],
    obstacleType: string,
): Promise<void> {
    try {
        if (response === false) {
            // User says obstacle is gone - increment notThere count for all markers
            const updatePromises = markerIds.map(async (markerId) => {
                try {
                    const marker = await MarkerService.getMarkerById(markerId);
                    if (marker) {
                        const newNotThereCount = (marker.notThere || 0) + 1;

                        if (newNotThereCount >= 5) {
                            await MarkerService.deleteMarker(markerId);
                            ToastAndroid.show("Obstacle removed - at least 5 \"not there\"", ToastAndroid.SHORT);
                            return;
                        }

                        await MarkerService.updateMarker(markerId, {
                            notThere: newNotThereCount,
                        });
                    }
                } catch (markerError) {
                    // Silent error handling for individual marker updates
                }
            });

            await Promise.allSettled(updatePromises);
        }
        // For "still there" (true) and "not sure" (null), we don't update anything
        // This preserves the current state while acknowledging user feedback
    } catch (error) {
        // Silent error handling
    }
}

/**
 * Convert timestamp to human-readable "time ago" format
 */
function getTimeAgo(timestamp: string): string {
    try {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInMs = now.getTime() - time.getTime();
        const diffInMins = Math.floor(
            diffInMs / config.MILLISECONDS_PER_MINUTE,
        );

        return config.formatTimeAgo(diffInMins);
    } catch (error) {
        return config.TIME_RECENTLY_FALLBACK;
    }
}

export default {
    setObstacleValidationModal,
    clearObstacleValidationModal,
    handleNotificationTap,
};
