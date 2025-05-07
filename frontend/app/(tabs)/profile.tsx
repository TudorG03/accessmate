import React from "react";
import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "../../stores/theme/useTheme";
import useAuth from "../../stores/auth/hooks/useAuth";
import { ThemeToggle } from "../../components/ThemeToggle";
import { UnitPreferenceSelector } from "../../components/UnitPreferenceSelector";

export default function ProfileScreen() {
  const { logout, user } = useAuth();
  const { colors, classes, isDark, styles } = useTheme();

  const handleLogout = async () => {
    await logout();
    // Navigation is now handled in the auth store
  };

  const menuItems = [
    {
      icon: "person-outline" as const,
      title: "Account Information",
      onPress: () => console.log("Account Information pressed"),
    },
    {
      icon: "notifications-outline" as const,
      title: "Notifications",
      onPress: () => console.log("Notifications pressed"),
    },
    {
      icon: "shield-checkmark-outline" as const,
      title: "Privacy & Security",
      onPress: () => console.log("Privacy pressed"),
    },
    {
      icon: "help-circle-outline" as const,
      title: "Help & Support",
      onPress: () => console.log("Help pressed"),
    },
    {
      icon: "document-text-outline" as const,
      title: "Terms & Policies",
      onPress: () => console.log("Terms pressed"),
    },
  ];

  return (
    <SafeAreaView className="flex-1" style={styles.background}>
      <ScrollView>
        <View className="p-6">
          {/* Profile Header */}
          <View className="items-center mb-8">
            <View
              className="w-24 h-24 rounded-full mb-4 items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Ionicons
                name="person"
                size={50}
                color="white"
              />
            </View>
            <Text className="text-2xl font-bold" style={styles.text}>{user?.displayName || 'User'}</Text>
            <Text style={styles.secondaryText}>{user?.email || 'email@example.com'}</Text>
          </View>

          {/* Menu Items */}
          <View className="mb-8">
            {menuItems.map((item, index) => (
              <Pressable
                key={index}
                className={`flex-row items-center py-4 ${index < menuItems.length - 1 ? "border-b" : ""
                  }`}
                style={{ borderColor: colors.border }}
                onPress={item.onPress}
              >
                <Ionicons
                  name={item.icon}
                  size={24}
                  color={colors.primary}
                  style={{ marginRight: 12 }}
                />
                <Text className="flex-1 text-base" style={styles.text}>
                  {item.title}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.secondaryText}
                />
              </Pressable>
            ))}
          </View>

          {/* Preferences Settings */}
          <View className="p-4 rounded-lg mb-6" style={styles.card}>
            <Text className="text-lg font-bold mb-2" style={styles.text}>
              Preferences
            </Text>
            <UnitPreferenceSelector />
          </View>

          {/* Theme Settings */}
          <View className="rounded-lg mb-6" style={styles.card}>
            <ThemeToggle />
          </View>

          {/* Logout Button */}
          <Pressable
            className="py-4 rounded-lg border flex-row justify-center items-center"
            style={{ borderColor: colors.error }}
            onPress={handleLogout}
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color={colors.error}
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: colors.error, fontWeight: "500" }}>
              Log Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 