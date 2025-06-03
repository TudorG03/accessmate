import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { UserRole } from '@/types/auth.types';
import { useAuthStore } from '@/stores/auth/auth.store';

export default function AdminDashboard() {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const navigateToUsers = () => {
    router.push('/admin/users');
  };

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
    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 p-4">
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-2xl font-bold">Admin Dashboard</Text>
              <Text className="text-gray-600">Manage your application</Text>
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
          
          <TouchableOpacity 
            className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-gray-200"
            onPress={navigateToUsers}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 disabled">
                <Text className="text-lg font-semibold mb-2">User Management</Text>
                <Text className="text-gray-600">View and manage user accounts</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#6B7280" />
            </View>
          </TouchableOpacity>
          
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4 disabled">
            <Text className="text-lg font-semibold mb-2">Content Management</Text>
            <Text className="text-gray-600">Edit application content</Text>
            <Text className="text-red-500">This feature is currently unavailable</Text>
          </View>
          
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4 disabled">
            <Text className="text-lg font-semibold mb-2">Analytics</Text>
            <Text className="text-gray-600">View application usage statistics</Text>
            <Text className="text-red-500">This feature is currently unavailable</Text>
          </View>
          
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4 disabled">
            <Text className="text-lg font-semibold mb-2">Settings</Text>
            <Text className="text-gray-600">Configure application settings</Text>
            <Text className="text-red-500">This feature is currently unavailable</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
} 