import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface AccessibilityFilterState {
  accessibleOnly: boolean;
  sortByAccessibility: boolean;
  showHighConfidenceOnly: boolean;
}

interface AccessibilityFilterProps {
  filter: AccessibilityFilterState;
  onFilterChange: (filter: AccessibilityFilterState) => void;
  colors: any;
  isDark: boolean;
  hasAccessibilityPreferences: boolean;
}

export const AccessibilityFilter: React.FC<AccessibilityFilterProps> = ({
  filter,
  onFilterChange,
  colors,
  isDark,
  hasAccessibilityPreferences,
}) => {
  const [showModal, setShowModal] = useState(false);

  // Don't show the filter if user has no accessibility preferences
  if (!hasAccessibilityPreferences) {
    return null;
  }

  const activeFiltersCount = [
    filter.accessibleOnly,
    filter.sortByAccessibility,
    filter.showHighConfidenceOnly,
  ].filter(Boolean).length;

  return (
    <>
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: activeFiltersCount > 0 ? colors.primary : colors.card,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          marginRight: 8,
        }}
        onPress={() => setShowModal(true)}
      >
        <Ionicons
          name="accessibility"
          size={16}
          color={activeFiltersCount > 0 ? 'white' : colors.text}
          style={{ marginRight: 4 }}
        />
        <Text
          style={{
            color: activeFiltersCount > 0 ? 'white' : colors.text,
            fontSize: 14,
            fontWeight: '500',
          }}
        >
          Accessibility
        </Text>
        {activeFiltersCount > 0 && (
          <View
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: 10,
              width: 20,
              height: 20,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 4,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {activeFiltersCount}
            </Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: 40,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: colors.text,
                }}
              >
                Accessibility Filters
              </Text>
              <Pressable
                onPress={() => setShowModal(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* Filter Options */}
            <View style={{ gap: 16 }}>
              {/* Accessible Only Filter */}
              <Pressable
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 12,
                }}
                onPress={() => onFilterChange({
                  ...filter,
                  accessibleOnly: !filter.accessibleOnly,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '500',
                      color: colors.text,
                      marginBottom: 4,
                    }}
                  >
                    Show only accessible places
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.secondary,
                    }}
                  >
                    Only show places that match your accessibility needs
                  </Text>
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: filter.accessibleOnly ? colors.primary : 'transparent',
                    borderWidth: 2,
                    borderColor: filter.accessibleOnly ? colors.primary : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {filter.accessibleOnly && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
              </Pressable>

              {/* Sort by Accessibility */}
              <Pressable
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 12,
                }}
                onPress={() => onFilterChange({
                  ...filter,
                  sortByAccessibility: !filter.sortByAccessibility,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '500',
                      color: colors.text,
                      marginBottom: 4,
                    }}
                  >
                    Sort by accessibility match
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.secondary,
                    }}
                  >
                    Prioritize places with the best accessibility features
                  </Text>
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: filter.sortByAccessibility ? colors.primary : 'transparent',
                    borderWidth: 2,
                    borderColor: filter.sortByAccessibility ? colors.primary : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {filter.sortByAccessibility && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
              </Pressable>

              {/* High Confidence Only */}
              <Pressable
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 12,
                }}
                onPress={() => onFilterChange({
                  ...filter,
                  showHighConfidenceOnly: !filter.showHighConfidenceOnly,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '500',
                      color: colors.text,
                      marginBottom: 4,
                    }}
                  >
                    High confidence data only
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.secondary,
                    }}
                  >
                    Only show places with reliable accessibility information
                  </Text>
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: filter.showHighConfidenceOnly ? colors.primary : 'transparent',
                    borderWidth: 2,
                    borderColor: filter.showHighConfidenceOnly ? colors.primary : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {filter.showHighConfidenceOnly && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
              </Pressable>
            </View>

            {/* Clear Filters Button */}
            {activeFiltersCount > 0 && (
              <Pressable
                style={{
                  backgroundColor: colors.secondary,
                  paddingVertical: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginTop: 20,
                }}
                onPress={() => onFilterChange({
                  accessibleOnly: false,
                  sortByAccessibility: false,
                  showHighConfidenceOnly: false,
                })}
              >
                <Text
                  style={{
                    color: 'white',
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                >
                  Clear Filters
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

export default AccessibilityFilter; 