import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../stores/theme/useTheme";
import useAuth from "../stores/auth/hooks/useAuth";
import { useLocation } from "../stores/location/hooks/useLocation";
import { getRecommendations } from "../services/recommendationService";
import {
  Recommendation,
  RecommendationResponse,
  RecommendationLoadingState,
} from "../types/recommendation.types";
import AccessibilityBadge from "../components/accessibility/AccessibilityBadge";
import AccessibilityFilter, { AccessibilityFilterState } from "../components/accessibility/AccessibilityFilter";

export default function RecommendationsPage() {
  const { colors, styles, isDark } = useTheme();
  const { user } = useAuth();
  const { currentLocation } = useLocation();

  // State management
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<Recommendation[]>([]);
  const [accessibilityFilter, setAccessibilityFilter] = useState<AccessibilityFilterState>({
    accessibleOnly: false,
    sortByAccessibility: false,
    showHighConfidenceOnly: false,
  });
  const [loadingState, setLoadingState] = useState<RecommendationLoadingState>({
    loading: true,
    refreshing: false,
    loadingMore: false,
    error: null,
  });
  const [metadata, setMetadata] = useState<any>(null);

  // Generate a session ID for this recommendation session
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Load recommendations on component mount
  useEffect(() => {
    loadRecommendations();
  }, []);

  // Helper function to check if user has accessibility preferences
  const hasAccessibilityPreferences = () => {
    const prefs = user?.preferences?.accessibilityRequirements;
    return !!(prefs && (
      prefs.wheelchairAccessible ||
      prefs.hasElevator ||
      prefs.hasRamp ||
      prefs.hasAccessibleBathroom ||
      prefs.hasWideDoors
    ));
  };

  // Filter and sort recommendations based on accessibility filters
  useEffect(() => {
    let filtered = [...recommendations];

    // Apply accessibility filters
    if (accessibilityFilter.accessibleOnly) {
      filtered = filtered.filter(rec => 
        rec.accessibility && rec.accessibility.matchesUserNeeds.length > 0
      );
    }

    if (accessibilityFilter.showHighConfidenceOnly) {
      filtered = filtered.filter(rec => 
        rec.accessibility && rec.accessibility.confidence === 'high'
      );
    }

    // Apply sorting
    if (accessibilityFilter.sortByAccessibility) {
      filtered.sort((a, b) => {
        const aMatches = a.accessibility?.matchesUserNeeds.length || 0;
        const bMatches = b.accessibility?.matchesUserNeeds.length || 0;
        const aConfidence = a.accessibility?.confidence || 'none';
        const bConfidence = b.accessibility?.confidence || 'none';
        
        // First sort by number of matches
        if (aMatches !== bMatches) {
          return bMatches - aMatches;
        }
        
        // Then sort by confidence level
        const confidenceValues = { high: 3, medium: 2, low: 1, none: 0 };
        const aConfidenceValue = confidenceValues[aConfidence];
        const bConfidenceValue = confidenceValues[bConfidence];
        
        if (aConfidenceValue !== bConfidenceValue) {
          return bConfidenceValue - aConfidenceValue;
        }
        
        // Finally maintain original score order
        return b.score - a.score;
      });
    }

    setFilteredRecommendations(filtered);
  }, [recommendations, accessibilityFilter]);

  const loadRecommendations = async (isRefresh = false) => {
    if (!user?.id) {
      setLoadingState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: "User not authenticated",
      }));
      return;
    }

    if (!currentLocation) {
      setLoadingState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: "Location not available. Please enable location services.",
      }));
      return;
    }

    try {
      setLoadingState(prev => ({
        ...prev,
        loading: !isRefresh,
        refreshing: isRefresh,
        error: null,
      }));

      console.log("🎯 Loading recommendations for user:", user.id);
      console.log("🎯 User location:", currentLocation);

      const response: RecommendationResponse | null = await getRecommendations({
        userId: user.id,
        location: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
        searchRadius: 5000, // 5km radius
        maxResults: 20,
        forceRefresh: isRefresh,
        deviceType: "mobile",
        sessionId: sessionId,
        preferences: {
          diversityBoost: 0.15,
          qualityWeight: 0.3,
          temporalWeight: 0.2,
          locationWeight: 0.3,
          includeExplanations: true,
        },
      });

      if (response) {
        console.log("🎯 Recommendations loaded successfully:", response.recommendations.length);
        
        // Debug accessibility data
        response.recommendations.forEach((rec, index) => {
          console.log(`🏢 Recommendation ${index + 1}: ${rec.placeName}`);
          console.log(`   PlaceId: ${rec.placeId}`);
          console.log(`   Accessibility data:`, rec.accessibility);
          if (rec.accessibility?.matchesUserNeeds && rec.accessibility.matchesUserNeeds.length > 0) {
            console.log(`   ✅ Has ${rec.accessibility.matchesUserNeeds.length} accessibility matches:`, rec.accessibility.matchesUserNeeds);
          } else {
            console.log(`   ❌ No accessibility matches found`);
          }
        });
        
        setRecommendations(response.recommendations);
        setMetadata(response.metadata);
      } else {
        throw new Error("Failed to load recommendations");
      }
    } catch (error) {
      console.error("🎯 Error loading recommendations:", error);
      setLoadingState(prev => ({
        ...prev,
        error: "Failed to load recommendations. Please try again.",
      }));
    } finally {
      setLoadingState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
      }));
    }
  };

  const handleRefresh = () => {
    loadRecommendations(true);
  };

  const handlePlacePress = (recommendation: Recommendation) => {
    // Show alert with place details and navigation options
    Alert.alert(
      recommendation.placeName,
      `Type: ${(recommendation.placeTypes || []).join(", ")}\nScore: ${(recommendation.score * 100).toFixed(1)}%\n\nReasons:\n${(recommendation.reasoning || []).join("\n")}`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "View Details", 
          onPress: () => {
            console.log("Opening place details for:", recommendation.placeId);
            // Navigate to map tab with the place ID to open the details modal
            router.push({
              pathname: "/(tabs)/map",
              params: {
                openPlaceDetails: "true",
                placeId: recommendation.placeId
              }
            });
          }
        },
        { 
          text: "Get Directions", 
          onPress: () => {
            console.log("Starting navigation to place:", recommendation.placeId);
            // Navigate to map tab and automatically start route planning
            router.push({
              pathname: "/(tabs)/map",
              params: {
                startNavigation: "true",
                placeId: recommendation.placeId
              }
            });
          }
        },
      ]
    );
  };

  const renderRecommendationCard = (recommendation: Recommendation, index: number) => {
    const scorePercentage = Math.round(recommendation.score * 100);
    const distance = recommendation.metadata?.distance 
      ? `${(recommendation.metadata.distance / 1000).toFixed(1)}km away`
      : "Distance unknown";

    return (
      <Pressable
        key={recommendation.placeId}
        style={{
          backgroundColor: colors.card,
          padding: 16,
          borderRadius: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }}
        onPress={() => handlePlacePress(recommendation)}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 4 }}>
              {recommendation.placeName}
            </Text>
            <Text style={{ fontSize: 12, color: colors.secondary, marginBottom: 4 }}>
              {(recommendation.placeTypes || []).slice(0, 3).join(" • ")}
            </Text>
            <Text style={{ fontSize: 12, color: colors.secondary }}>
              {distance}
            </Text>
            
            {/* Accessibility Badge */}
            {recommendation.accessibility && (
              <View style={{ marginTop: 4 }}>
                <AccessibilityBadge 
                  accessibility={recommendation.accessibility}
                  isDark={isDark}
                  size="small"
                />
              </View>
            )}
          </View>
          <View style={{
            backgroundColor: scorePercentage >= 80 
              ? (isDark ? '#065f46' : '#d1fae5')
              : scorePercentage >= 60 
              ? (isDark ? '#92400e' : '#fef3c7')
              : (isDark ? '#7f1d1d' : '#fee2e2'),
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}>
            <Text style={{
              fontSize: 12,
              fontWeight: "600",
              color: scorePercentage >= 80
                ? (isDark ? '#6ee7b7' : '#059669')
                : scorePercentage >= 60
                ? (isDark ? '#fbbf24' : '#d97706')
                : (isDark ? '#fca5a5' : '#dc2626'),
            }}>
              {scorePercentage}%
            </Text>
          </View>
        </View>

        {recommendation.reasoning && recommendation.reasoning.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: colors.secondary, marginBottom: 4 }}>
              Why we recommend this:
            </Text>
            <Text style={{ fontSize: 12, color: colors.text, lineHeight: 16 }}>
              • {(recommendation.reasoning || []).slice(0, 2).join("\n• ")}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
      <View style={{
        backgroundColor: isDark ? '#374151' : '#f3f4f6',
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
      }}>
        <Ionicons name="sparkles-outline" size={32} color={colors.secondary} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 8 }}>
        No Recommendations Yet
      </Text>
      <Text style={{ fontSize: 14, color: colors.secondary, textAlign: "center", marginBottom: 24 }}>
        We're learning about your preferences.{"\n"}Visit some places to get personalized recommendations!
      </Text>
      <Pressable
        style={{
          backgroundColor: colors.primary,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
        }}
        onPress={handleRefresh}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>Refresh</Text>
      </Pressable>
    </View>
  );

  const renderErrorState = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
      <View style={{
        backgroundColor: isDark ? '#7f1d1d' : '#fee2e2',
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
      }}>
        <Ionicons name="warning-outline" size={32} color={isDark ? '#fca5a5' : '#dc2626'} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 8 }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 14, color: colors.secondary, textAlign: "center", marginBottom: 24 }}>
        {loadingState.error}
      </Text>
      <Pressable
        style={{
          backgroundColor: colors.primary,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
        }}
        onPress={handleRefresh}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>Try Again</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            padding: 8,
            marginRight: 8,
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>
            Personalized Recommendations
          </Text>
          {metadata && (
            <Text style={{ fontSize: 12, color: colors.secondary }}>
              {filteredRecommendations.length} recommendations
              {filteredRecommendations.length !== recommendations.length && ` (${recommendations.length} total)`}
              {hasAccessibilityPreferences() && (
                <Text style={{ color: colors.primary }}>
                  {" "}• Accessibility-enhanced
                </Text>
              )}
              {" "}• {metadata.fromCache ? 'From cache' : 'Fresh results'}
              {metadata.accessibilityEnhanced && (
                <Text style={{ color: colors.primary }}>
                  {" "}• ♿ Enhanced
                </Text>
              )}
            </Text>
          )}
        </View>
        <Pressable
          onPress={handleRefresh}
          style={{ padding: 8 }}
          disabled={loadingState.refreshing}
        >
          <Ionicons
            name="refresh"
            size={20}
            color={loadingState.refreshing ? colors.secondary : colors.primary}
          />
        </Pressable>
      </View>

      {/* Content */}
      {loadingState.loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 16, color: colors.secondary }}>
            Finding personalized recommendations...
          </Text>
        </View>
      ) : loadingState.error ? (
        renderErrorState()
      ) : filteredRecommendations.length === 0 ? (
        recommendations.length === 0 ? renderEmptyState() : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 64 }}>
            <View style={{
              backgroundColor: isDark ? '#374151' : '#f3f4f6',
              width: 80,
              height: 80,
              borderRadius: 40,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}>
              <Ionicons name="filter-outline" size={32} color={colors.secondary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 8 }}>
              No Matching Places
            </Text>
            <Text style={{ fontSize: 14, color: colors.secondary, textAlign: "center", marginBottom: 24 }}>
              No recommendations match your current accessibility filters.{"\n"}Try adjusting your filters or refresh for new results.
            </Text>
            <Pressable
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
              onPress={() => setAccessibilityFilter({
                accessibleOnly: false,
                sortByAccessibility: false,
                showHighConfidenceOnly: false,
              })}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>Clear Filters</Text>
            </Pressable>
          </View>
        )
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={loadingState.refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* Info Card */}
          <View style={{
            backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons
                name="information-circle"
                size={20}
                color={isDark ? '#93c5fd' : '#3b82f6'}
                style={{ marginRight: 8 }}
              />
              <Text style={{
                fontSize: 14,
                fontWeight: "600",
                color: isDark ? '#93c5fd' : '#1e40af',
              }}>
                AI-Powered Recommendations
              </Text>
            </View>
            <Text style={{
              fontSize: 12,
              color: isDark ? '#bfdbfe' : '#1e40af',
              lineHeight: 16,
            }}>
              These recommendations are personalized based on your location, preferences, and accessibility needs. The more you use the app, the better they become!
            </Text>
          </View>

          {/* Accessibility Filter */}
          {hasAccessibilityPreferences() && (
            <View style={{ marginBottom: 16 }}>
              <AccessibilityFilter
                filter={accessibilityFilter}
                onFilterChange={setAccessibilityFilter}
                colors={colors}
                isDark={isDark}
                hasAccessibilityPreferences={hasAccessibilityPreferences()}
              />
            </View>
          )}

          {/* Recommendations List */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 12 }}>
              Recommended for You
              {filteredRecommendations.length !== recommendations.length && (
                <Text style={{ fontSize: 14, fontWeight: "400", color: colors.secondary }}>
                  {" "}({filteredRecommendations.length} of {recommendations.length})
                </Text>
              )}
            </Text>
            {filteredRecommendations.map((recommendation, index) =>
              renderRecommendationCard(recommendation, index)
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
} 