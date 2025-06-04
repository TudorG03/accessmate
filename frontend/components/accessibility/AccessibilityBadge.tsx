import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccessibilityData, AccessibilityConfidence } from '@/types/recommendation.types';

interface AccessibilityBadgeProps {
  accessibility: AccessibilityData;
  isDark: boolean;
  size?: 'small' | 'medium';
}

export const AccessibilityBadge: React.FC<AccessibilityBadgeProps> = ({ 
  accessibility, 
  isDark, 
  size = 'small' 
}) => {
  if (!accessibility || accessibility.matchesUserNeeds.length === 0) {
    return null;
  }

  const getConfidenceColor = (confidence: AccessibilityConfidence) => {
    switch (confidence) {
      case 'high':
        return isDark ? '#059669' : '#10b981';
      case 'medium':
        return isDark ? '#d97706' : '#f59e0b';
      case 'low':
        return isDark ? '#dc2626' : '#ef4444';
      default:
        return isDark ? '#6b7280' : '#9ca3af';
    }
  };

  const getIconName = (match: string): keyof typeof Ionicons.glyphMap => {
    switch (match) {
      case 'wheelchair_accessible':
        return 'accessibility';
      case 'elevator':
        return 'arrow-up-circle';
      case 'ramp':
        return 'trending-up';
      case 'accessible_bathroom':
        return 'fitness';
      case 'wide_doors':
        return 'resize-outline';
      default:
        return 'checkmark-circle';
    }
  };

  const getMatchLabel = (match: string) => {
    switch (match) {
      case 'wheelchair_accessible':
        return 'Wheelchair';
      case 'elevator':
        return 'Elevator';
      case 'ramp':
        return 'Ramp';
      case 'accessible_bathroom':
        return 'Accessible Toilet';
      case 'wide_doors':
        return 'Wide Doors';
      default:
        return match;
    }
  };

  const iconSize = size === 'small' ? 12 : 16;
  const textSize = size === 'small' ? 10 : 12;
  const padding = size === 'small' ? 4 : 6;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {accessibility.matchesUserNeeds.slice(0, 3).map((match: string, index: number) => (
        <View
          key={match}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: getConfidenceColor(accessibility.confidence),
            paddingHorizontal: padding,
            paddingVertical: 2,
            borderRadius: 8,
            opacity: 0.9,
          }}
        >
          <Ionicons
            name={getIconName(match)}
            size={iconSize}
            color="white"
            style={{ marginRight: 2 }}
          />
          <Text
            style={{
              color: 'white',
              fontSize: textSize,
              fontWeight: '600',
            }}
          >
            {getMatchLabel(match)}
          </Text>
        </View>
      ))}
      {accessibility.matchesUserNeeds.length > 3 && (
        <View
          style={{
            backgroundColor: isDark ? '#374151' : '#e5e7eb',
            paddingHorizontal: padding,
            paddingVertical: 2,
            borderRadius: 8,
          }}
        >
          <Text
            style={{
              color: isDark ? '#d1d5db' : '#6b7280',
              fontSize: textSize,
              fontWeight: '600',
            }}
          >
            +{accessibility.matchesUserNeeds.length - 3}
          </Text>
        </View>
      )}
    </View>
  );
};

export default AccessibilityBadge; 