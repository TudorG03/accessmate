import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useAuth from "../../stores/auth/hooks/useAuth";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../stores/theme/useTheme";
import { formatDistance } from "@/utils/distanceUtils";
import NearbyPlaces from "../../components/home/NearbyPlaces";
import { router } from "expo-router";

export default function UserDashboard() {
  const { user } = useAuth();
  const { colors, styles, isDark } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
            Welcome, <Text style={{ color: colors.primary }}>{user?.displayName}</Text>!
          </Text>
          <Text style={{ color: colors.secondary }}>
            Find accessible routes and locations
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12, color: colors.text }}>
            Quick Actions
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Pressable style={{ width: '50%', padding: 8 }}>
              <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="navigate" size={20} color={isDark ? '#93c5fd' : '#3b82f6'} />
                </View>
                <Text style={{ fontWeight: '500', color: colors.text }}>Navigate</Text>
                <Text style={{ fontSize: 12, color: colors.secondary }}>Find accessible routes</Text>
              </View>
            </Pressable>

            <Pressable style={{ width: '50%', padding: 8 }}>
              <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ backgroundColor: isDark ? '#064e3b' : '#d1fae5', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="search" size={20} color={isDark ? '#6ee7b7' : '#10b981'} />
                </View>
                <Text style={{ fontWeight: '500', color: colors.text }}>Discover</Text>
                <Text style={{ fontSize: 12, color: colors.secondary }}>Find accessible places</Text>
              </View>
            </Pressable>

            <Pressable style={{ width: '50%', padding: 8 }}>
              <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ backgroundColor: isDark ? '#5b21b6' : '#ede9fe', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="bookmark" size={20} color={isDark ? '#c4b5fd' : '#8b5cf6'} />
                </View>
                <Text style={{ fontWeight: '500', color: colors.text }}>Saved</Text>
                <Text style={{ fontSize: 12, color: colors.secondary }}>View saved locations</Text>
              </View>
            </Pressable>

            <Pressable 
              style={{ width: '50%', padding: 8 }}
              onPress={() => router.push('/recommendations')}
            >
              <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ backgroundColor: isDark ? '#7c2d12' : '#fee2e2', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="sparkles" size={20} color={isDark ? '#fca5a5' : '#ef4444'} />
                </View>
                <Text style={{ fontWeight: '500', color: colors.text }}>Recommendations</Text>
                <Text style={{ fontSize: 12, color: colors.secondary }}>Personalized places</Text>
              </View>
            </Pressable>

            <Pressable style={{ width: '50%', padding: 8 }}>
              <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ backgroundColor: isDark ? '#78350f' : '#ffedd5', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="settings" size={20} color={isDark ? '#fdba74' : '#f59e0b'} />
                </View>
                <Text style={{ fontWeight: '500', color: colors.text }}>Settings</Text>
                <Text style={{ fontSize: 12, color: colors.secondary }}>Adjust preferences</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Nearby Places */}
        <NearbyPlaces />

        {/* Community Tips */}
        <View>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12, color: colors.text }}>
            Community Tips
          </Text>
          <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
            <Text style={{ fontWeight: '500', marginBottom: 4, color: colors.text }}>Using Public Transport</Text>
            <Text style={{ fontSize: 14, color: colors.secondary }}>Tips on navigating public transportation in a wheelchair including schedules and assistance options.</Text>
          </View>
          <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontWeight: '500', marginBottom: 4, color: colors.text }}>Finding Accessible Restaurants</Text>
            <Text style={{ fontSize: 14, color: colors.secondary }}>How to find restaurants with proper accessibility features and adequate space between tables.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
