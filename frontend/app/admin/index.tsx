import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { UserRole } from '@/types/auth.types';

export default function AdminDashboard() {
  const navigateToUsers = () => {
    router.push('/admin/users');
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 p-4">
          <View className="mb-6">
            <Text className="text-2xl font-bold">Admin Dashboard</Text>
            <Text className="text-gray-600">Manage your application</Text>
          </View>
          
          <TouchableOpacity 
            className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-gray-200"
            onPress={navigateToUsers}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-lg font-semibold mb-2">User Management</Text>
                <Text className="text-gray-600">View and manage user accounts</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#6B7280" />
            </View>
          </TouchableOpacity>
          
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <Text className="text-lg font-semibold mb-2">Content Management</Text>
            <Text className="text-gray-600">Edit application content</Text>
          </View>
          
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <Text className="text-lg font-semibold mb-2">Analytics</Text>
            <Text className="text-gray-600">View application usage statistics</Text>
          </View>
          
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <Text className="text-lg font-semibold mb-2">Settings</Text>
            <Text className="text-gray-600">Configure application settings</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
} 