import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useAuth from "../../stores/auth/hooks/useAuth";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../stores/theme/useTheme";
import NearbyPlaces from "../../components/home/NearbyPlaces";
import { router } from "expo-router";

export default function UserDashboard() {
  const { user } = useAuth();
  const { colors, styles, isDark } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <View style={{ marginBottom: 48 }}>
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
            <Pressable 
              style={{ width: '50%', padding: 8 }}
              onPress={() => router.push('/map')}
            >
              <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="navigate" size={20} color={isDark ? '#93c5fd' : '#3b82f6'} />
                </View>
                <Text style={{ fontWeight: '500', color: colors.text }}>Navigate</Text>
                <Text style={{ fontSize: 12, color: colors.secondary }}>Find accessible routes</Text>
              </View>
            </Pressable>

            <Pressable 
              style={{ width: '50%', padding: 8 }}
              onPress={() => router.push('/history')}
            >
              <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ backgroundColor: isDark ? '#5b21b6' : '#ede9fe', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="bookmark" size={20} color={isDark ? '#c4b5fd' : '#8b5cf6'} />
                </View>
                <Text style={{ fontWeight: '500', color: colors.text }}>History</Text>
                <Text style={{ fontSize: 12, color: colors.secondary }}>View where you've been</Text>
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

            <Pressable 
              style={{ width: '50%', padding: 8 }}
              onPress={() => router.push('/profile?openPreferences=true')}
            >
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
      </ScrollView>
    </SafeAreaView>
  );
}
