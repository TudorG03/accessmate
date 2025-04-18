import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useAuth from "../../stores/auth/hooks/useAuth";
import React from "react";
import { Ionicons } from "@expo/vector-icons";

export default function UserDashboard() {
  const { user } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 p-4">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-800">
            Welcome, {user?.displayName}!
          </Text>
          <Text className="text-gray-600">
            Find accessible routes and locations
          </Text>
        </View>

        {/* Quick Actions */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-3 text-gray-800">
            Quick Actions
          </Text>
          <View className="flex-row flex-wrap">
            <Pressable className="w-1/2 p-2">
              <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <View className="bg-blue-100 w-10 h-10 rounded-full items-center justify-center mb-2">
                  <Ionicons name="navigate" size={20} color="#3b82f6" />
                </View>
                <Text className="font-medium">Navigate</Text>
                <Text className="text-xs text-gray-500">Find accessible routes</Text>
              </View>
            </Pressable>
            
            <Pressable className="w-1/2 p-2">
              <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <View className="bg-green-100 w-10 h-10 rounded-full items-center justify-center mb-2">
                  <Ionicons name="search" size={20} color="#10b981" />
                </View>
                <Text className="font-medium">Discover</Text>
                <Text className="text-xs text-gray-500">Find accessible places</Text>
              </View>
            </Pressable>
            
            <Pressable className="w-1/2 p-2">
              <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <View className="bg-purple-100 w-10 h-10 rounded-full items-center justify-center mb-2">
                  <Ionicons name="bookmark" size={20} color="#8b5cf6" />
                </View>
                <Text className="font-medium">Saved</Text>
                <Text className="text-xs text-gray-500">View saved locations</Text>
              </View>
            </Pressable>
            
            <Pressable className="w-1/2 p-2">
              <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <View className="bg-orange-100 w-10 h-10 rounded-full items-center justify-center mb-2">
                  <Ionicons name="settings" size={20} color="#f59e0b" />
                </View>
                <Text className="font-medium">Settings</Text>
                <Text className="text-xs text-gray-500">Adjust preferences</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Nearby Accessible Places */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-3 text-gray-800">
            Nearby Accessible Places
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[1, 2, 3, 4].map((item) => (
              <View key={item} className="mr-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100 w-64">
                <View className="h-32 bg-gray-200 rounded-lg mb-2" />
                <Text className="font-medium">Accessible Restaurant {item}</Text>
                <Text className="text-xs text-gray-500 mb-1">1.{item} km away</Text>
                <View className="flex-row">
                  <View className="bg-blue-50 rounded-full px-2 py-1 mr-1">
                    <Text className="text-xs text-blue-600">Wheelchair Access</Text>
                  </View>
                  <View className="bg-green-50 rounded-full px-2 py-1">
                    <Text className="text-xs text-green-600">Elevator</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Community Tips */}
        <View>
          <Text className="text-lg font-semibold mb-3 text-gray-800">
            Community Tips
          </Text>
          <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3">
            <Text className="font-medium mb-1">Using Public Transport</Text>
            <Text className="text-sm text-gray-600">Tips on navigating public transportation in a wheelchair including schedules and assistance options.</Text>
          </View>
          <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <Text className="font-medium mb-1">Finding Accessible Restaurants</Text>
            <Text className="text-sm text-gray-600">How to find restaurants with proper accessibility features and adequate space between tables.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
