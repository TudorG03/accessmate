import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../stores/theme/useTheme";
import useAuth from "../stores/auth/hooks/useAuth";
import { router } from "expo-router";
import navigationHistoryService from "../services/navigation-history.service";

interface HistoryEntry {
  _id: string;
  placeId: string;
  placeName: string;
  placeTypes: string[];
  location: {
    coordinates: number[];
  };
  timestamp: string;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const { colors, styles, isDark } = useTheme();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const historyData = await navigationHistoryService.getUserNavigationHistory(user?.id, 50);
      setHistory(historyData);
    } catch (error) {
      console.error("Failed to fetch navigation history:", error);
      Alert.alert("Error", "Failed to load navigation history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id]);

  const onRefresh = () => {
    fetchHistory(true);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatPlaceTypes = (types: string[]) => {
    // Filter out common generic types and format nicely
    const filteredTypes = types.filter(type => 
      !['point_of_interest', 'establishment'].includes(type)
    );
    
    if (filteredTypes.length === 0) return 'Place';
    
    return filteredTypes
      .slice(0, 2) // Take first 2 types
      .map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
      .join(', ');
  };

  const handlePlacePress = (entry: HistoryEntry) => {
    // Navigate to map with place details
    router.push(`/map?openPlaceDetails=true&placeId=${entry.placeId}`);
  };

  const getPlaceTypeIcon = (types: string[]) => {
    const type = types.find(t => !['point_of_interest', 'establishment'].includes(t)) || 'place';
    
    if (type.includes('restaurant') || type.includes('food')) return 'restaurant';
    if (type.includes('hospital') || type.includes('health')) return 'medical';
    if (type.includes('school') || type.includes('university')) return 'school';
    if (type.includes('store') || type.includes('shopping')) return 'storefront';
    if (type.includes('park') || type.includes('recreation')) return 'leaf';
    if (type.includes('transit') || type.includes('station')) return 'train';
    if (type.includes('gas') || type.includes('fuel')) return 'car';
    if (type.includes('bank') || type.includes('finance')) return 'card';
    if (type.includes('lodging') || type.includes('hotel')) return 'bed';
    if (type.includes('gym') || type.includes('fitness')) return 'fitness';
    return 'location';
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, color: colors.text }}>Loading your history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 16, 
        borderBottomWidth: 1, 
        borderBottomColor: colors.border 
      }}>
        <Pressable 
          onPress={() => router.back()}
          style={{ marginRight: 16 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, flex: 1 }}>
          Your Places
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 14 }}>
          {history.length} {history.length === 1 ? 'place' : 'places'}
        </Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {history.length === 0 ? (
          <View style={{ 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center', 
            paddingVertical: 60 
          }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: isDark ? '#374151' : '#f3f4f6',
              justifyContent: 'center', 
              alignItems: 'center',
              marginBottom: 16
            }}>
              <Ionicons name="location-outline" size={40} color={colors.secondary} />
            </View>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: '600', 
              color: colors.text, 
              marginBottom: 8 
            }}>
              No places visited yet
            </Text>
            <Text style={{ 
              color: colors.secondary, 
              textAlign: 'center', 
              paddingHorizontal: 32 
            }}>
              Start navigating to places and they'll appear here for easy access
            </Text>
          </View>
        ) : (
          history.map((entry) => (
            <Pressable
              key={entry._id}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
                shadowOpacity: 0.1,
                shadowRadius: 4,
              }}
              onPress={() => handlePlacePress(entry)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {/* Icon */}
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12
                }}>
                  <Ionicons 
                    name={getPlaceTypeIcon(entry.placeTypes)} 
                    size={20} 
                    color={colors.primary} 
                  />
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: '600', 
                    color: colors.text,
                    marginBottom: 4
                  }}>
                    {entry.placeName}
                  </Text>
                  
                  <Text style={{ 
                    fontSize: 14, 
                    color: colors.secondary,
                    marginBottom: 6
                  }}>
                    {formatPlaceTypes(entry.placeTypes)}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={14} color={colors.secondary} />
                    <Text style={{ 
                      fontSize: 12, 
                      color: colors.secondary,
                      marginLeft: 4
                    }}>
                      {formatDate(entry.timestamp)}
                    </Text>
                  </View>
                </View>

                {/* Arrow */}
                <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
} 