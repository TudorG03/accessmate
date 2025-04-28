import * as Notifications from "expo-notifications";
import { Alert } from "react-native";
import { MarkerService } from "@/stores/marker/marker.service";
import {
    addNotificationResponseListener,
    removeNotificationListener,
} from "./notification.service";

// Store the subscription reference
let notificationSubscription: Notifications.Subscription | null = null;

/**
 * Initialize notification handlers
 */
export function initializeNotificationHandlers(): void {
    // Clean up any existing handlers first
    cleanupNotificationHandlers();

    // Add a listener for notification taps
    notificationSubscription = addNotificationResponseListener(
        handleNotificationTap,
    );
    console.log("Notification response handler initialized");
}

/**
 * Clean up notification handlers
 */
export function cleanupNotificationHandlers(): void {
    if (notificationSubscription) {
        removeNotificationListener(notificationSubscription);
        notificationSubscription = null;
        console.log("Notification response handler cleaned up");
    }
}

/**
 * Handle notification tap events
 */
async function handleNotificationTap(
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

            if (markerIds.length > 0) {
                promptObstacleValidation(obstacleType, markerIds);
            }
        }
    } catch (error) {
        console.error("Error handling notification tap:", error);
    }
}

/**
 * Show a prompt asking the user to validate if an obstacle still exists
 */
function promptObstacleValidation(
    obstacleType: string,
    markerIds: string[],
): void {
    // Format the obstacle type name for display
    const obstacleTypeName = obstacleType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

    // Show a prompt to the user
    Alert.alert(
        `Validate ${obstacleTypeName}`,
        `Is this ${obstacleTypeName.toLowerCase()} obstacle still present?`,
        [
            {
                text: "Yes, still there",
                onPress: () => confirmObstacleExistence(markerIds, true),
                style: "default",
            },
            {
                text: "No, it's gone",
                onPress: () => confirmObstacleExistence(markerIds, false),
                style: "destructive",
            },
            {
                text: "Not sure",
                style: "cancel",
            },
        ],
    );
}

/**
 * Process the user's response about an obstacle's existence
 */
async function confirmObstacleExistence(
    markerIds: string[],
    stillExists: boolean,
): Promise<void> {
    if (!stillExists) {
        // User confirmed the obstacle no longer exists
        // This part will be implemented later as mentioned in requirements
        console.log(
            `User confirmed markers no longer exist: ${markerIds.join(", ")}`,
        );
        Alert.alert(
            "Thank You",
            "Thanks for confirming! We'll update our records accordingly.",
        );
    } else {
        // User confirmed the obstacle still exists
        console.log(
            `User confirmed markers still exist: ${markerIds.join(", ")}`,
        );
        Alert.alert(
            "Thank You",
            "Thanks for confirming! This helps keep our data accurate.",
        );
    }
}

export default {
    initializeNotificationHandlers,
    cleanupNotificationHandlers,
};
