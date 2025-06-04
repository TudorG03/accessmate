import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../stores/theme/useTheme";
import useAuth from "../../stores/auth/hooks/useAuth";
import { ThemeToggle } from "../../components/ThemeToggle";
import { UnitPreferenceSelector } from "../../components/UnitPreferenceSelector";
import PreferencesModal from "../../components/settings/PreferencesModal";
import TopActivityTypes from "../../components/settings/TopActivityTypes";
import { ProfilePictureUpload, AccountInfoModal } from "../../components/profile";

export default function ProfileScreen() {
  const { logout, user } = useAuth();
  const { colors, classes, isDark, styles } = useTheme();
  const [preferencesModalVisible, setPreferencesModalVisible] = useState(false);
  const [profilePictureModalVisible, setProfilePictureModalVisible] = useState(false);
  const [accountInfoModalVisible, setAccountInfoModalVisible] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const handleProfilePicturePress = () => {
    setProfilePictureModalVisible(true);
  };

  const handleProfilePictureSuccess = () => {
    setProfilePictureModalVisible(false);
  };

  const menuItems = [
    {
      icon: "person-outline" as const,
      title: "Account Information",
      onPress: () => setAccountInfoModalVisible(true),
    },
    {
      icon: "heart-outline" as const,
      title: "My Preferences",
      onPress: () => setPreferencesModalVisible(true),
    },
  ];

  return (
    <SafeAreaView className="flex-1" style={styles.background}>
      <ScrollView>
        <View className="p-6">
          {/* Profile Header */}
          <View className="items-center mb-8">
            <TouchableOpacity onPress={handleProfilePicturePress}>
              <View
                className="w-24 h-24 rounded-full mb-4 items-center justify-center relative"
                style={{ backgroundColor: user?.profilePicture ? 'transparent' : colors.primary }}
              >
                {user?.profilePicture ? (
                  <>
                    <Image
                      source={{ uri: user.profilePicture }}
                      className="w-24 h-24 rounded-full"
                      resizeMode="cover"
                    />
                    {/* Camera overlay icon */}
                    <View className="absolute bottom-0 right-0 w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}>
                      <Ionicons
                        name="camera"
                        size={12}
                        color="white"
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="person"
                      size={50}
                      color="white"
                    />
                    {/* Camera overlay icon */}
                    <View className="absolute bottom-0 right-0 w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}>
                      <Ionicons
                        name="camera"
                        size={12}
                        color={colors.primary}
                      />
                    </View>
                  </>
                )}
              </View>
            </TouchableOpacity>
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

          {/* Top Activity Types */}
          <TopActivityTypes colors={colors} styles={styles} />

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

      {/* Preferences Modal */}
      <PreferencesModal
        visible={preferencesModalVisible}
        onClose={() => setPreferencesModalVisible(false)}
        colors={colors}
        styles={styles}
      />

      {/* Profile Picture Upload Modal */}
      <Modal
        visible={profilePictureModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProfilePictureModalVisible(false)}
      >
        <SafeAreaView style={[{ flex: 1 }, styles.background]}>
          <View className="flex-1">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
              <Text className="text-lg font-semibold" style={styles.text}>
                Profile Picture
              </Text>
              <TouchableOpacity onPress={() => setProfilePictureModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Profile Picture Upload Component */}
            <View className="flex-1 justify-center items-center p-6">
              <ProfilePictureUpload
                size={200}
                onUploadSuccess={handleProfilePictureSuccess}
                onDeleteSuccess={handleProfilePictureSuccess}
                onError={(error) => {
                  console.error('Profile picture error:', error);
                  // You can add toast notification here if needed
                }}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Account Info Modal */}
      <AccountInfoModal
        visible={accountInfoModalVisible}
        onClose={() => setAccountInfoModalVisible(false)}
      />
    </SafeAreaView>
  );
} 