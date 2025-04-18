import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { UserRole } from '@/types/auth.types';

export default function ModeratorDashboard() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MODERATOR]}>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 p-4">
          <View className="mb-6">
            <Text className="text-2xl font-bold">Moderator Dashboard</Text>
            <Text className="text-gray-600">Content moderation tools</Text>
          </View>
          
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <Text className="text-lg font-semibold mb-2">Content Review</Text>
            <Text className="text-gray-600">Review and approve user-generated content</Text>
          </View>
          
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <Text className="text-lg font-semibold mb-2">Reports</Text>
            <Text className="text-gray-600">Handle user reports and issues</Text>
          </View>
          
          <View className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <Text className="text-lg font-semibold mb-2">Activity Log</Text>
            <Text className="text-gray-600">View recent moderation activities</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
} 