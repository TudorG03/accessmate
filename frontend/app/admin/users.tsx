import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserListComponent } from '@/components/admin/UserListComponent';
import { UserFormComponent } from '@/components/admin/UserFormComponent';
import { AdminService } from '@/services/admin.service';
import { User, UserRole } from '@/types/auth.types';

type ViewMode = 'list' | 'create' | 'edit';

export default function AdminUsersScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCreateUser = () => {
    setSelectedUser(null);
    setViewMode('create');
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setViewMode('edit');
  };

  const handleDeleteUser = async (user: User) => {
    try {
      await AdminService.deleteUser(user.id);
      Alert.alert('Success', `User ${user.displayName} has been deleted`);
      // Trigger refresh of user list
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete user');
    }
  };

  const handleFormSuccess = (user: User) => {
    setViewMode('list');
    setSelectedUser(null);
    // Trigger refresh of user list
    setRefreshTrigger(prev => prev + 1);
  };

  const handleFormCancel = () => {
    setViewMode('list');
    setSelectedUser(null);
  };

  const renderHeader = () => (
    <View className="flex-row justify-between items-center mb-6">
      <View>
        <Text className="text-2xl font-bold text-gray-900">User Management</Text>
        <Text className="text-gray-600">Manage user accounts and permissions</Text>
      </View>
      
      {viewMode === 'list' && (
        <TouchableOpacity
          className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
          onPress={handleCreateUser}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text className="text-white font-medium ml-1">Add User</Text>
        </TouchableOpacity>
      )}
      
      {(viewMode === 'create' || viewMode === 'edit') && (
        <TouchableOpacity
          className="bg-gray-500 px-4 py-2 rounded-lg flex-row items-center"
          onPress={handleFormCancel}
        >
          <Ionicons name="arrow-back" size={20} color="white" />
          <Text className="text-white font-medium ml-1">Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderContent = () => {
    switch (viewMode) {
      case 'list':
        return (
          <UserListComponent
            onUserEdit={handleEditUser}
            onUserDelete={handleDeleteUser}
            refreshTrigger={refreshTrigger}
          />
        );
      
      case 'create':
        return (
          <UserFormComponent
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        );
      
      case 'edit':
        return (
          <UserFormComponent
            user={selectedUser}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 p-4">
          {renderHeader()}
          {renderContent()}
        </View>
      </SafeAreaView>
    </ProtectedRoute>
  );
} 