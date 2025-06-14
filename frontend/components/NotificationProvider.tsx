import React, { useEffect } from 'react';
import { initializeNotifications } from '@/services/notification.service';
import { initializeNotificationListeners, cleanupNotificationListeners } from '@/services/notification-events.service';
import { handleNotificationTap } from '@/services/notification-handler.service';

/**
 * NotificationProvider - Initializes the notification system once at app startup
 * Ensures notifications and listeners are set up properly without duplication
 */
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    useEffect(() => {
        const initializeNotificationSystem = async () => {
            try {
                console.log('🔔 NotificationProvider: Initializing notification system...');

                // First, ensure notifications are initialized
                const notificationsInitialized = await initializeNotifications();
                if (!notificationsInitialized) {
                    console.warn('⚠️ NotificationProvider: Failed to initialize notifications');
                    return;
                }

                // Initialize notification tap listeners with our handler
                initializeNotificationListeners(handleNotificationTap);

                console.log('✅ NotificationProvider: Notification system initialized successfully');
            } catch (error) {
                console.error('❌ NotificationProvider: Failed to initialize notification system:', error);
            }
        };

        initializeNotificationSystem();

        // Cleanup function
        return () => {
            console.log('🧹 NotificationProvider: Cleaning up notification listeners');
            cleanupNotificationListeners();
        };
    }, []); // Empty dependency array - initialize once

    return <>{children}</>;
};

export default NotificationProvider; 