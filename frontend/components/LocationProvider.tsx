import React, { createContext, ReactNode, useContext, useEffect } from 'react';
import { useLocation } from '@/stores/location/hooks/useLocation';
import { MarkerLocation } from '@/types/marker.types';

// Define the context shape
interface LocationContextType {
    currentLocation: MarkerLocation | null;
    lastLocationUpdateTime: Date | null;
    isTrackingEnabled: boolean;
    processedMarkersCount: number;
    isInitializing: boolean;
    toggleTracking: () => Promise<boolean>;
    updateCheckRadius: (radius: number) => void;
    clearAllProcessedMarkers: () => void;
}

// Create the context with default values
const LocationContext = createContext<LocationContextType>({
    currentLocation: null,
    lastLocationUpdateTime: null,
    isTrackingEnabled: false,
    processedMarkersCount: 0,
    isInitializing: true,
    toggleTracking: async () => false,
    updateCheckRadius: () => { },
    clearAllProcessedMarkers: () => { },
});

// Hook to use location data
export const useLocationContext = () => useContext(LocationContext);

// Provider component
export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const location = useLocation();

    return (
        <LocationContext.Provider value={location}>
            {children}
        </LocationContext.Provider>
    );
}; 