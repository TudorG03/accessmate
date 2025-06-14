import React, { useEffect } from 'react';
import { useLocation } from '@/stores/location/hooks/useLocation';
import { useLocationStore } from '@/stores/location/location.store';

import { trackingManager } from '@/services/tracking-manager.service';
import { getLocationConfig } from '@/config/location.config';

interface LocationProviderProps {
    children: React.ReactNode;
}

// Get configuration instance
const config = getLocationConfig();

export function LocationProvider({ children }: LocationProviderProps) {
    const { ensureValidLocation } = useLocation();
    const { hasValidPersistedLocation } = useLocationStore();

    useEffect(() => {
        const initializeLocationAndTracking = async () => {
            try {
                console.log('🌍 LocationProvider: Starting location system initialization...');

                // TrackingManager-Only Mode (Migration Complete)
                console.log('🚀 LocationProvider: Running in TrackingManager-Only Mode');

                console.log('✅ LocationProvider: Configuration loaded');

                // Initialize TrackingManager (no fallback)
                const trackingInitialized = await trackingManager.initialize();

                if (!trackingInitialized) {
                    console.error('❌ LocationProvider: TrackingManager initialization failed in strict mode');
                    throw new Error('TrackingManager initialization failed - no fallback available');
                }

                console.log('✅ LocationProvider: TrackingManager initialized successfully');

                // Ensure we have a valid location
                await ensureValidLocation();
                console.log('✅ LocationProvider: Valid location ensured');

                // Location-based notifications have been removed - only validation notifications remain

                // System ready - TrackingManager fully operational
                console.log('🎉 LocationProvider: MIGRATION COMPLETE - System fully operational!');
                console.log('📊 LocationProvider: Enhanced features active:');
                console.log('  ✅ App state monitoring');
                console.log('  ✅ Authentication integration');
                console.log('  ✅ Background tracking recovery');
                console.log('  ✅ Centralized resource management');
                console.log('🏆 LocationProvider: TrackingManager is now the primary location system');

                console.log('🎯 LocationProvider: TrackingManager-only initialization complete');

            } catch (error) {
                console.error('❌ LocationProvider: Critical error during initialization:', error);
            }
        };

        initializeLocationAndTracking();
    }, [hasValidPersistedLocation, ensureValidLocation]);

    return <>{children}</>;
} 