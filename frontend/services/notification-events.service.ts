import * as Notifications from "expo-notifications";

// Store the subscription reference
let notificationSubscription: Notifications.Subscription | null = null;

/**
 * Add a notification response listener
 */
export function addNotificationResponseListener(
    listener: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
    console.log("🔔 Adding notification response listener");
    return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * Remove a notification listener
 */
export function removeNotificationListener(
    subscription: Notifications.Subscription,
): void {
    console.log("🔔 Removing notification listener");
    Notifications.removeNotificationSubscription(subscription);
}

/**
 * Initialize notification response listeners
 */
export function initializeNotificationListeners(
    handler: (response: Notifications.NotificationResponse) => void,
): void {
    // Clean up any existing handlers first
    cleanupNotificationListeners();

    // Add a listener for notification taps
    notificationSubscription = addNotificationResponseListener(handler);
    console.log("✅ Notification response handler initialized");
}

/**
 * Clean up notification listeners
 */
export function cleanupNotificationListeners(): void {
    if (notificationSubscription) {
        removeNotificationListener(notificationSubscription);
        notificationSubscription = null;
        console.log("🧹 Notification response handler cleaned up");
    }
} 