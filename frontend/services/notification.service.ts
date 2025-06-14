import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useAuthStore } from "@/stores/auth/auth.store";
import { UserRole } from "@/types/auth.types";
import { getNotificationConfig } from "@/config/notification.config";

// Get configuration instance
const config = getNotificationConfig();

// Track if notifications have been initialized
let notificationsInitialized = false;

/**
 * Check if the current user has the 'user' role and is allowed to receive notifications
 */
function canReceiveNotifications(): boolean {
    try {
        const { user, isAuthenticated } = useAuthStore.getState();

        if (!isAuthenticated || !user) {
            return false;
        }

        if (user.role !== UserRole.USER) {
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Request notification permissions
 */
async function requestNotificationPermissions(): Promise<boolean> {
    try {
        const { status: existingStatus } = await Notifications
            .getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== "granted") {
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Create notification channels for Android
 */
async function createNotificationChannels(): Promise<void> {
    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(
            config.OBSTACLE_NOTIFICATION_CHANNEL,
            {
                name: config.CHANNEL_NAME,
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: config.CHANNEL_VIBRATION_PATTERN,
                lightColor: config.CHANNEL_LIGHT_COLOR,
                sound: config.DEFAULT_SOUND,
                description: config.CHANNEL_DESCRIPTION,
            },
        );
    }
}

/**
 * Initialize the notification system
 */
export async function initializeNotifications(): Promise<boolean> {
    try {
        // Don't initialize twice
        if (notificationsInitialized) {
            return true;
        }

        // Request permissions first
        const permissionGranted = await requestNotificationPermissions();
        if (!permissionGranted) {
            return false;
        }

        // Configure notification handler for foreground notifications
        Notifications.setNotificationHandler({
            handleNotification: async () => {
                return {
                    shouldShowAlert: config.SHOW_ALERT,
                    shouldPlaySound: config.PLAY_SOUND,
                    shouldSetBadge: config.SET_BADGE,
                    priority: Notifications.AndroidNotificationPriority.MAX,
                };
            },
        });

        // Note: Notification tap handlers are initialized by NotificationProvider
        // to prevent duplicate listener registration

        // Create notification channel for Android
        if (Platform.OS === "android") {
            await createNotificationChannels();
        }

        notificationsInitialized = true;

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Send obstacle validation notification
 * Asks user to validate if an obstacle is still present
 */
export async function sendObstacleValidationNotification(
    obstacleType: string,
    markers: Array<any>,
): Promise<boolean> {
    try {
        // Check if user is allowed to receive notifications (role-based filtering)
        if (!canReceiveNotifications()) {
            return false;
        }

        // Make sure notifications are initialized
        if (!notificationsInitialized) {
            const initialized = await initializeNotifications();
            if (!initialized) {
                return false;
            }
        }

        // Get the marker IDs
        const markerIds = markers.map((m) => m.id);
        const markerCount = markers.length;

        // Create notification content with validation options
        const content: Notifications.NotificationContentInput = {
            title: config.getNotificationTitle(obstacleType),
            body: config.getNotificationBody(obstacleType, markerCount),
            data: {
                obstacleType,
                markerIds,
                requiresValidation: true,
                timestamp: new Date().toISOString(),
            },
            sound: true,
        };

        // Add Android-specific properties
        if (Platform.OS === "android") {
            // @ts-ignore - Add Android-specific channel identifier
            content.categoryIdentifier = config.OBSTACLE_VALIDATION_CATEGORY;
            // @ts-ignore - Add Android-specific channel ID
            content.channelId = config.OBSTACLE_NOTIFICATION_CHANNEL;
            // @ts-ignore - Set priority
            content.priority = Notifications.AndroidNotificationPriority.MAX;
        }

        // Send the notification immediately
        const notificationId = await Notifications.scheduleNotificationAsync({
            content,
            trigger: null, // Show immediately
        });

        return true;
    } catch (error) {
        return false;
    }
}
