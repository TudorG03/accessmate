import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ObstacleType } from "@/types/marker.types";
import { initializeNotificationHandlers } from "./notification-handler.service";

// Define notification channels for Android
export const OBSTACLE_NOTIFICATION_CHANNEL = "obstacle-notifications";

// Track if notifications have been initialized
let notificationsInitialized = false;

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    try {
        console.log("🔔 Requesting notification permissions...");
        const { status: existingStatus } = await Notifications
            .getPermissionsAsync();

        console.log(
            `🔔 Current notification permission status: ${existingStatus}`,
        );

        // Return true if permissions are already granted
        if (existingStatus === "granted") {
            console.log("✅ Notification permissions already granted");
            return true;
        }

        // Request permissions
        console.log("📱 Requesting notification permissions from user...");
        const { status } = await Notifications.requestPermissionsAsync({
            ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
            },
            android: {},
        });

        console.log(`📱 New notification permission status: ${status}`);
        const granted = status === "granted";
        console.log(
            granted
                ? "✅ Notification permissions granted"
                : "❌ Notification permissions denied",
        );

        return granted;
    } catch (error) {
        console.error("❌ Error requesting notification permissions:", error);
        return false;
    }
}

/**
 * Initialize the notification system
 */
export async function initializeNotifications(): Promise<boolean> {
    try {
        console.log("🔔 Initializing notification system...");

        // Don't initialize twice
        if (notificationsInitialized) {
            console.log("✅ Notification system already initialized");
            return true;
        }

        // Request permissions first
        console.log("🔔 Requesting notification permissions...");
        const permissionGranted = await requestNotificationPermissions();
        if (!permissionGranted) {
            console.error("❌ Notification permissions not granted");
            return false;
        }

        // Configure notification handler for foreground notifications
        console.log("🔔 Setting up notification handler...");
        Notifications.setNotificationHandler({
            handleNotification: async () => {
                console.log("📲 Handling incoming notification in foreground");
                return {
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: true,
                    priority: Notifications.AndroidNotificationPriority.MAX,
                };
            },
        });

        // Initialize notification tap handlers
        console.log("🔔 Initializing notification tap handlers...");
        initializeNotificationHandlers();

        // Create notification channel for Android
        if (Platform.OS === "android") {
            console.log("🔔 Creating Android notification channels...");
            await createNotificationChannels();
        }

        console.log("✅ Notification system initialized successfully");
        notificationsInitialized = true;

        // Send a test notification to verify everything is working
        await sendTestNotification();

        return true;
    } catch (error) {
        console.error("❌ Failed to initialize notification system:", error);
        return false;
    }
}

/**
 * Create notification channels (Android only)
 */
async function createNotificationChannels(): Promise<void> {
    try {
        console.log(
            "🔔 Creating Android notification channel:",
            OBSTACLE_NOTIFICATION_CHANNEL,
        );

        // Get existing channels to check if our channel already exists
        const existingChannels = await Notifications
            .getNotificationChannelsAsync();
        console.log(
            `📱 Found ${existingChannels.length} existing notification channels`,
        );

        const ourChannelExists = existingChannels.some(
            (channel) => channel.id === OBSTACLE_NOTIFICATION_CHANNEL,
        );

        if (ourChannelExists) {
            console.log("✅ Obstacle notification channel already exists");
        } else {
            // Create our notification channel
            await Notifications.setNotificationChannelAsync(
                OBSTACLE_NOTIFICATION_CHANNEL,
                {
                    name: "Obstacle Notifications",
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: "#F1B24A",
                    description:
                        "Notifications about nearby accessibility obstacles",
                    enableVibrate: true,
                    showBadge: true,
                },
            );
            console.log("✅ Android notification channel created successfully");
        }
    } catch (error) {
        console.error("❌ Error creating notification channels:", error);
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
        console.log(
            `🔔 Preparing validation notification for ${obstacleType} with ${markers.length} markers`,
        );

        // Make sure notifications are initialized
        if (!notificationsInitialized) {
            console.log(
                "🔄 Notification system not initialized, initializing now...",
            );
            const initialized = await initializeNotifications();
            if (!initialized) {
                console.error("❌ Failed to initialize notification system");
                return false;
            }
        }

        // Format the obstacle type name for display
        const obstacleTypeName = obstacleType
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());

        console.log(`🔔 Preparing notification for ${obstacleTypeName}`);

        // Get the marker IDs
        const markerIds = markers.map((m) => m.id);
        const markerCount = markers.length;

        // Create notification content with validation options
        const content: Notifications.NotificationContentInput = {
            title: `Nearby ${obstacleTypeName}`,
            body: `There ${
                markerCount === 1 ? "is" : "are"
            } ${markerCount} ${obstacleTypeName.toLowerCase()} obstacle(s) nearby. Is it still there?`,
            data: {
                obstacleType,
                markerIds,
                requiresValidation: true,
                timestamp: new Date().toISOString(),
            },
            sound: true,
        };

        console.log(
            "📱 Notification content prepared:",
            JSON.stringify(content),
        );

        // Add Android-specific properties
        if (Platform.OS === "android") {
            console.log("📱 Setting Android-specific properties");
            // @ts-ignore - Add Android-specific channel identifier
            content.categoryIdentifier = "obstacle-validation";
            // @ts-ignore - Add Android-specific channel ID
            content.channelId = OBSTACLE_NOTIFICATION_CHANNEL;
            // @ts-ignore - Set priority
            content.priority = Notifications.AndroidNotificationPriority.MAX;
        }

        // Send the notification immediately
        console.log("📲 Scheduling notification for immediate delivery");
        const notificationId = await Notifications.scheduleNotificationAsync({
            content,
            trigger: null, // Show immediately
        });

        console.log(
            `✅ Sent obstacle validation notification: ${notificationId}`,
        );
        return true;
    } catch (error) {
        console.error(
            "❌ Error sending obstacle validation notification:",
            error,
        );
        return false;
    }
}

/**
 * Send a test notification
 */
export async function sendTestNotification(): Promise<boolean> {
    try {
        // Make sure notifications are initialized
        if (!notificationsInitialized) {
            const initialized = await initializeNotifications();
            if (!initialized) return false;
        }

        // Create notification content
        const content: Notifications.NotificationContentInput = {
            title: "Test Notification",
            body: `This is a test notification sent at ${
                new Date().toLocaleTimeString()
            }`,
            data: {
                test: true,
                timestamp: new Date().toISOString(),
            },
            sound: true,
        };

        // Add Android-specific properties
        if (Platform.OS === "android") {
            // @ts-ignore - Add Android-specific channel
            content.channelId = OBSTACLE_NOTIFICATION_CHANNEL;
            // @ts-ignore - Set priority
            content.priority = Notifications.AndroidNotificationPriority.MAX;
        }

        // Send the notification immediately
        const notificationId = await Notifications.scheduleNotificationAsync({
            content,
            trigger: null, // Show immediately
        });

        console.log(`Sent test notification: ${notificationId}`);
        return true;
    } catch (error) {
        console.error("Error sending test notification:", error);
        return false;
    }
}

/**
 * Listen for notification responses (when user taps a notification)
 */
export function addNotificationResponseListener(
    listener: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * Remove a notification listener
 */
export function removeNotificationListener(
    subscription: Notifications.Subscription,
): void {
    if (subscription) {
        subscription.remove();
    }
}
