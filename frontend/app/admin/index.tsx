import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { UserRole } from '@/types/auth.types';

export default function AdminDashboard() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 p-4">
          <View className="mb-6">
            <Text className="text-2xl font-bold">Admin Dashboard</Text>
            <Text className="text-gray-600">Manage your application</Text>
          </View>
          
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <Text className="text-lg font-semibold mb-2">User Management</Text>
            <Text className="text-gray-600">View and manage user accounts</Text>
          </View>
          
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