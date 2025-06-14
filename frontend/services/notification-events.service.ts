import * as Notifications from "expo-notifications";

// Store the subscription reference
let notificationSubscription: Notifications.Subscription | null = null;

/**
 * Add a notification response listener
 */
export function addNotificationResponseListener(
    listener: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
    const wrappedListener = (response: Notifications.NotificationResponse) => {
        try {
            listener(response);
        } catch (error) {
            // Silent error handling
        }
    };

    return Notifications.addNotificationResponseReceivedListener(
        wrappedListener,
    );
}

/**
 * Remove a notification listener
 */
export function removeNotificationListener(
    subscription: Notifications.Subscription,
): void {
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
}

/**
 * Clean up notification listeners
 */
export function cleanupNotificationListeners(): void {
    if (notificationSubscription) {
        removeNotificationListener(notificationSubscription);
        notificationSubscription = null;
    }
}

/**
 * Check if notification listeners are active
 */
export function areNotificationListenersActive(): boolean {
    return notificationSubscription !== null;
}
