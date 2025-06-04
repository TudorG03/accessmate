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
    
    // Wrap the listener with additional logging
    const wrappedListener = (response: Notifications.NotificationResponse) => {
        console.log("🔔 ==========================================");
        console.log("🔔 NOTIFICATION EVENT RECEIVED!");
        console.log("🔔 ==========================================");
        console.log("🔔 Notification ID:", response.notification.request.identifier);
        console.log("🔔 Action identifier:", response.actionIdentifier);
        console.log("🔔 User input:", response.userText);
        console.log("🔔 Calling original handler...");
        
        try {
            listener(response);
        } catch (error) {
            console.error("❌ Error in notification listener:", error);
        }
    };
    
    return Notifications.addNotificationResponseReceivedListener(wrappedListener);
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

/**
 * Check if notification listeners are active
 */
export function areNotificationListenersActive(): boolean {
    const isActive = notificationSubscription !== null;
    console.log("🔔 Notification listeners active:", isActive);
    return isActive;
} 