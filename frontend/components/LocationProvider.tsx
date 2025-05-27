import React, { useEffect } from 'react';
import { useLocation } from '@/stores/location/hooks/useLocation';
import { getCurrentLocation, startLocationTracking } from '@/services/location.service';
import { useLocationStore } from '@/stores/location/location.store';
import { initializeLocationNotifications } from '@/services/location-notifications.service';

interface LocationProviderProps {
    children: React.ReactNode;
}

export function LocationProvider({ children }: LocationProviderProps) {
    const { ensureValidLocation } = useLocation();
    const { hasValidPersistedLocation } = useLocationStore();

    useEffect(() => {
        const initializeLocationAndTracking = async () => {
            try {
                console.log('🌍 LocationProvider: Starting background location initialization and tracking...');

                // Step 1: Get initial current location to ensure we have up-to-date position
                console.log('🌍 LocationProvider: Fetching current GPS location in background...');

                // Try to get current location
                const location = await getCurrentLocation();

                if (location) {
                    console.log('✅ LocationProvider: Successfully got fresh GPS location:', location.coords);
                } else {
                    console.log('⚠️ LocationProvider: Could not get GPS location, checking for persisted location...');

                    // If GPS fails, check if we have persisted location as fallback
                    if (hasValidPersistedLocation()) {
                        console.log('✅ LocationProvider: Using persisted location as fallback');
                    } else {
                        console.log('⚠️ LocationProvider: No persisted location either, will use default');
                    }
                }

                // Step 2: Ensure we have a valid location (this will set default if needed)
                await ensureValidLocation();

                // Step 3: Start continuous location tracking for notification system
                console.log('🌍 LocationProvider: Starting continuous location tracking for notifications...');
                const trackingStarted = await startLocationTracking();

                if (trackingStarted) {
                    console.log('✅ LocationProvider: Continuous location tracking started successfully');
                } else {
                    console.log('⚠️ LocationProvider: Failed to start location tracking, notifications may not work optimally');
                }

                // Step 4: Initialize location-based notification system
                console.log('🌍 LocationProvider: Initializing location-based notification system...');
                const notificationsInitialized = await initializeLocationNotifications();

                if (notificationsInitialized) {
                    console.log('✅ LocationProvider: Location-based notification system initialized successfully');
                } else {
                    console.log('⚠️ LocationProvider: Failed to initialize location notifications');
                }

                console.log('✅ LocationProvider: Background location initialization, tracking, and notification setup complete');

            } catch (error) {
                console.error('❌ LocationProvider: Error during background location initialization:', error);
                // Continue silently, the location store will provide a default location
            }
        };

        // Start location initialization and tracking in background without blocking render
        initializeLocationAndTracking();
    }, [hasValidPersistedLocation, ensureValidLocation]);

    // Always render children immediately to avoid blocking navigation
    return <>{children}</>;
} 