import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { UserRole } from '@/types/auth.types';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth/auth.store';

export default function ModeratorDashboard() {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MODERATOR]}>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 p-4">
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-2xl font-bold">Moderator Dashboard</Text>
              <Text className="text-gray-600">Manage app content and reviews</Text>
              {user && (
                <View className="flex-row items-center mt-2">
                  <Ionicons name="person-circle" size={16} color="#6B7280" />
                  <Text className="text-sm text-gray-500 ml-1">
                    Welcome, {user.displayName}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              className="bg-red-500 px-4 py-2 rounded-lg flex-row items-center"
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={18} color="white" />
              <Text className="text-white font-medium ml-2">Logout</Text>
            </TouchableOpacity>
          </View>
          
          {/* Review Management Card */}
          <TouchableOpacity
            className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-gray-200"
            onPress={() => router.push('/moderator/reviews')}
          >
            <View className="flex-row items-center mb-2">
              <View className="bg-blue-100 p-2 rounded-lg mr-3">
                <MaterialCommunityIcons name="star-box-multiple" size={24} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900">Review Management</Text>
                <Text className="text-gray-600">Moderate and edit user reviews</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
            <View className="ml-12">
              <Text className="text-sm text-gray-500">
                • Edit review content and ratings
              </Text>
              <Text className="text-sm text-gray-500">
                • Delete inappropriate reviews
              </Text>
              <Text className="text-sm text-gray-500">
                • Monitor accessibility feedback
              </Text>
            </View>
          </TouchableOpacity>

          {/* Quick Stats Card */}
          <View className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 mb-4">
            <Text className="text-white text-lg font-semibold mb-2">Quick Overview</Text>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-white text-2xl font-bold">-</Text>
                <Text className="text-blue-100 text-xs">Total Reviews</Text>
              </View>
              <View className="items-center">
                <Text className="text-white text-2xl font-bold">-</Text>
                <Text className="text-blue-100 text-xs">This Week</Text>
              </View>
              <View className="items-center">
                <Text className="text-white text-2xl font-bold">-</Text>
                <Text className="text-blue-100 text-xs">Avg Rating</Text>
              </View>
            </View>
            <Text className="text-blue-100 text-xs mt-2">
              Visit Review Management for detailed statistics
            </Text>
          </View>

          {/* Moderator Guidelines */}
          <View className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="information-circle" size={20} color="#D97706" />
              <Text className="text-amber-800 font-semibold ml-2">Moderator Guidelines</Text>
            </View>
            <Text className="text-amber-700 text-sm mb-2">
              As a moderator, you have the responsibility to:
            </Text>
            <Text className="text-amber-700 text-sm">
              • Ensure reviews are appropriate and helpful
            </Text>
            <Text className="text-amber-700 text-sm">
              • Correct inaccurate accessibility information
            </Text>
            <Text className="text-amber-700 text-sm">
              • Remove spam or inappropriate content
            </Text>
            <Text className="text-amber-700 text-sm">
              • Maintain objective and fair moderation
            </Text>
          </View>

          {/* Recent Activity Placeholder */}
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-gray-200">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Recent Activity</Text>
            <Text className="text-gray-500 text-center py-4">
              Activity feed will be available in future updates
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
} 