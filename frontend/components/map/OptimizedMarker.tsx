import React, { memo, useMemo, useCallback } from 'react';
import { View } from 'react-native';
import { Marker as MapMarker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Marker } from '@/types/marker.types';
import { getObstacleColor, getObstacleIcon } from '@/stores/marker/marker.utils';
import { formatDistance } from '@/utils/distanceUtils';

interface OptimizedMarkerProps {
    marker: Marker;
    index: number;
    onPress: (marker: Marker) => void;
    getMarkerTitle: (marker: Marker) => string;
    getMarkerDescription: (marker: Marker) => string;
    markerAnchor: { x: number; y: number };
    styles: any;
}

const OptimizedMarker = memo(({
    marker,
    index,
    onPress,
    getMarkerTitle,
    getMarkerDescription,
    markerAnchor,
    styles
}: OptimizedMarkerProps) => {
    const obstacleIcon = getObstacleIcon(marker.obstacleType);

    return (
        <MapMarker
            coordinate={{
                latitude: marker.location.latitude,
                longitude: marker.location.longitude,
            }}
            title={getMarkerTitle(marker)}
            description={getMarkerDescription(marker)}
            onPress={() => onPress(marker)}
            anchor={markerAnchor}
            tracksViewChanges={false}
        >
            <View style={styles.markerContainer}>
                <View style={[styles.markerIcon, { backgroundColor: getObstacleColor(marker.obstacleScore) }]}>
                    {
                        obstacleIcon.name === "stairs" ?
                            <FontAwesome6 name="stairs" size={16} color={obstacleIcon.color} />
                            :
                            <Ionicons
                                name={obstacleIcon.name as any}
                                size={16}
                                color={obstacleIcon.color}
                            />
                    }
                </View>
            </View>
        </MapMarker>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    return (
        prevProps.marker.id === nextProps.marker.id &&
        prevProps.marker.obstacleScore === nextProps.marker.obstacleScore &&
        prevProps.marker.obstacleType === nextProps.marker.obstacleType &&
        prevProps.marker.location.latitude === nextProps.marker.location.latitude &&
        prevProps.marker.location.longitude === nextProps.marker.location.longitude &&
        prevProps.index === nextProps.index
    );
});

OptimizedMarker.displayName = 'OptimizedMarker';

export default OptimizedMarker; 