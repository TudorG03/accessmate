import * as Notifications from "expo-notifications";
import { Alert } from "react-native";
import { MarkerService } from "@/stores/marker/marker.service";

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
    console.log("✅ Obstacle validation modal function registered");
}



/**
 * Handle notification tap events
 */
export async function handleNotificationTap(
    response: Notifications.NotificationResponse,
): Promise<void> {
    try {
        console.log("📱 =====================================");
        console.log("📱 NOTIFICATION TAPPED - Processing...");
        console.log("📱 =====================================");

        // Extract notification data
        const data = response.notification.request.content.data;
        console.log("📱 Full notification response:", JSON.stringify(response, null, 2));
        console.log("📱 Notification data:", JSON.stringify(data, null, 2));

        // Check if this is an obstacle validation notification
        if (data?.requiresValidation) {
            // Process the validation notification
            const markerIds = data.markerIds || [];
            const obstacleType = data.obstacleType || "unknown";
            const timestamp = data.timestamp;

            console.log(
                `📱 Processing validation request for ${obstacleType} with ${markerIds.length} markers`,
            );

            if (markerIds.length > 0) {
                await promptObstacleValidation(
                    obstacleType,
                    markerIds,
                    timestamp,
                );
            } else {
                console.warn("⚠️ No marker IDs found in notification data");
            }
        } else {
            console.log("📱 Non-validation notification tapped, ignoring");
        }
    } catch (error) {
        console.error("❌ Error handling notification tap:", error);

        // Show a generic error message to the user
        Alert.alert(
            "Error",
            "Sorry, there was an error processing your notification tap. Please try again.",
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

        console.log(`🔔 Showing validation prompt for ${obstacleType}`);

        // Check if we have the modal function available
        if (showObstacleValidationModal) {
            console.log("✅ Using modal system for validation prompt");
            // Use the new modal system
            const validationData = {
                obstacleType,
                markerIds,
                markerCount,
                timeAgo,
            };

            console.log("📱 Calling showObstacleValidationModal with:", validationData);
            showObstacleValidationModal(
                validationData,
                handleValidationResponse,
            );
        } else {
            // Fallback to alert system if modal is not available
            console.warn(
                "⚠️ Obstacle validation modal not available, falling back to alert",
            );
            console.log("📱 Modal function registered:", !!showObstacleValidationModal);
            await showFallbackAlert(obstacleType, markerIds, timeAgo);
        }
    } catch (error) {
        console.error("❌ Error showing validation prompt:", error);

        Alert.alert(
            "Error",
            "Sorry, there was an error showing the validation prompt.",
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
    // Format the obstacle type name for display
    const obstacleTypeName = obstacleType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

    const markerCount = markerIds.length;
    const timeInfo = timeAgo ? ` (detected ${timeAgo})` : "";

    // Create a more detailed message
    const message = markerCount === 1
        ? `We detected a ${obstacleTypeName.toLowerCase()} obstacle near your location${timeInfo}.\n\nIs this obstacle still present?`
        : `We detected ${markerCount} ${obstacleTypeName.toLowerCase()} obstacles near your location${timeInfo}.\n\nAre these obstacles still present?`;

    console.log(`🔔 Showing fallback validation alert for ${obstacleTypeName}`);

    // Show a prompt to the user with enhanced options
    Alert.alert(
        `🚧 Validate ${obstacleTypeName}`,
        message,
        [
            {
                text: "✅ Yes, still there",
                onPress: () =>
                    handleValidationResponse(true, markerIds, obstacleType),
                style: "default",
            },
            {
                text: "❌ No, it's gone",
                onPress: () =>
                    handleValidationResponse(false, markerIds, obstacleType),
                style: "destructive",
            },
            {
                text: "🤷 Not sure",
                onPress: () =>
                    handleValidationResponse(null, markerIds, obstacleType),
                style: "cancel",
            },
        ],
        {
            cancelable: true,
            onDismiss: () =>
                console.log("📱 Validation alert dismissed by user"),
        },
    );
}

/**
 * Handle the validation response from user
 */
async function handleValidationResponse(
    response: boolean | null,
    markerIds: string[],
    obstacleType: string,
): Promise<void> {
    try {
        const responseText = response === true
            ? "confirmed"
            : response === false
            ? "removed"
            : "unsure";
        console.log(`✅ User ${responseText} markers: ${markerIds.join(", ")}`);

        // If user said obstacles are no longer there, increment notThere count
        if (response === false) {
            console.log(
                `📝 Incrementing notThere count for ${markerIds.length} markers`,
            );

            // Update each marker's notThere field
            const updatePromises = markerIds.map(async (markerId) => {
                try {
                    // Get current marker to read current notThere value
                    const currentMarker = await MarkerService.getMarkerById(
                        markerId,
                    );
                    console.log(currentMarker);
                    
                    if (!currentMarker) {
                        throw new Error(`Marker ${markerId} not found`);
                    }

                    const newNotThereCount = (currentMarker.notThere || 0) + 1;

                    console.log(
                        `📝 Updating marker ${markerId}: notThere ${
                            currentMarker.notThere || 0
                        } -> ${newNotThereCount}`,
                    );

                    // Update only the notThere field
                    await MarkerService.updateMarker(markerId, {
                        notThere: newNotThereCount,
                    });

                    console.log(
                        `✅ Successfully updated marker ${markerId} notThere count to ${newNotThereCount}`,
                    );
                    return {
                        markerId,
                        success: true,
                        newCount: newNotThereCount,
                    };
                } catch (error) {
                    console.error(
                        `❌ Failed to update marker ${markerId}:`,
                        error,
                    );
                    return {
                        markerId,
                        success: false,
                        error: error instanceof Error
                            ? error.message
                            : String(error),
                    };
                }
            });

            // Wait for all updates to complete
            const results = await Promise.allSettled(updatePromises);

            // Count successful updates
            const successfulUpdates = results.filter((result) =>
                result.status === "fulfilled" && result.value.success
            ).length;

            const failedUpdates = results.length - successfulUpdates;

            if (successfulUpdates > 0) {
                console.log(
                    `✅ Successfully updated ${successfulUpdates} marker(s) notThere count`,
                );
            }

            if (failedUpdates > 0) {
                console.error(`❌ Failed to update ${failedUpdates} marker(s)`);
                // Show user feedback for partial failures
                Alert.alert(
                    "Partial Update",
                    `Updated ${successfulUpdates} markers successfully. ${failedUpdates} updates failed.`,
                    [{ text: "OK" }],
                );
            }
        }

        // Log analytics data for future improvements
        logValidationResponse(markerIds, obstacleType, response);

        console.log("📝 Validation response processed successfully");
    } catch (error) {
        console.error("❌ Error processing validation response:", error);

        // Show user feedback for errors
        Alert.alert(
            "Update Failed",
            "Sorry, there was an error updating the markers. Please try again later.",
            [{ text: "OK" }],
        );
    }
}

/**
 * Get a human-readable time ago string
 */
function getTimeAgo(timestamp: string): string {
    try {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now.getTime() - past.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));

        if (diffMins < 1) return "just now";
        if (diffMins < 60) {
            return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
        }

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) {
            return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
        }

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    } catch (error) {
        console.warn("⚠️ Error calculating time ago:", error);
        return "recently";
    }
}

/**
 * Log validation response for analytics (placeholder for future implementation)
 */
function logValidationResponse(
    markerIds: string[],
    obstacleType: string,
    response: boolean | null, // true = still exists, false = removed, null = unsure
): void {
    try {
        const responseText = response === true
            ? "confirmed"
            : response === false
            ? "removed"
            : "unsure";

        console.log(`📊 Validation Response Logged:`, {
            markerIds,
            obstacleType,
            response: responseText,
            timestamp: new Date().toISOString(),
            markerCount: markerIds.length,
        });

        // TODO: In the future, this could send analytics data to a backend service
        // to track validation accuracy and user engagement
    } catch (error) {
        console.error("❌ Error logging validation response:", error);
    }
}

export default {
    setObstacleValidationModal,
    handleNotificationTap,
};
