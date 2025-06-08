import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { AdminService } from '@/services/admin.service';
import { User, UserRole } from '@/types/auth.types';
import { validateSearchQuery, sanitizeInput } from '@/utils/validation.utils';

interface UserListProps {
  onUserSelect?: (user: User) => void;
  onUserEdit?: (user: User) => void;
  onUserDelete?: (user: User) => void;
  refreshTrigger?: number;
}

export const UserListComponent: React.FC<UserListProps> = ({
  onUserSelect,
  onUserEdit,
  onUserDelete,
  refreshTrigger = 0,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState('');

  // Load users on mount and when refreshTrigger changes
  useEffect(() => {
    loadUsers();
  }, [refreshTrigger]);

  // Filter users when search query or role filter changes
  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, selectedRole]);

  const loadUsers = async () => {
    try {
      setError(null);
      const response = await AdminService.getAllUsers();
      setUsers(response.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleSearchChange = (text: string) => {
    const sanitizedText = sanitizeInput(text);

    if (sanitizedText) {
      const validation = validateSearchQuery(sanitizedText);
      if (!validation.isValid) {
        setSearchError(validation.message || '');
        setSearchQuery(sanitizedText);
        return;
      }
    }

    setSearchError('');
    setSearchQuery(sanitizedText);
  };

  const filterUsers = () => {
    let filtered = users;

    // Filter by search query
    if (searchQuery.trim() && !searchError) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.displayName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    // Filter by role
    if (selectedRole !== 'all') {
      filtered = filtered.filter((user) => user.role === selectedRole);
    }

    setFilteredUsers(filtered);
  };

  const handleDeleteUser = (user: User) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${user.displayName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onUserDelete?.(user),
        },
      ]
    );
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-red-100 text-red-800';
      case UserRole.MODERATOR:
        return 'bg-blue-100 text-blue-800';
      case UserRole.USER:
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderUserItem = ({ item: user }: { item: User }) => (
    <TouchableOpacity
      className="bg-white rounded-lg shadow-sm p-4 mb-3 border border-gray-200"
      onPress={() => onUserSelect?.(user)}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">
            {user.displayName}
          </Text>
          <Text className="text-sm text-gray-600">{user.email}</Text>
        </View>
        <View className={`px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
          <Text className="text-xs font-medium capitalize">{user.role}</Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-xs text-gray-500">
            Status: {user.isActive ? 'Active' : 'Inactive'}
          </Text>
          {user.lastLogin && (
            <Text className="text-xs text-gray-500">
              Last login: {new Date(user.lastLogin).toLocaleDateString()}
            </Text>
          )}
        </View>

        <View className="flex-row gap-2">
          <TouchableOpacity
            className="bg-blue-500 px-3 py-1 rounded"
            onPress={() => onUserEdit?.(user)}
          >
            <Text className="text-white text-xs font-medium">Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-red-500 px-3 py-1 rounded"
            onPress={() => handleDeleteUser(user)}
          >
            <Text className="text-white text-xs font-medium">Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRoleFilter = () => (
    <View className="flex-row mb-4">
      {(['all', UserRole.ADMIN, UserRole.MODERATOR, UserRole.USER] as const).map((role) => (
        <TouchableOpacity
          key={role}
          className={`mr-2 px-3 py-2 rounded-full ${selectedRole === role
            ? 'bg-blue-500'
            : 'bg-gray-200'
            }`}
          onPress={() => setSelectedRole(role)}
        >
          <Text
            className={`text-xs font-medium ${selectedRole === role ? 'text-white' : 'text-gray-700'
              }`}
          >
            {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-2 text-gray-600">Loading users...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-red-600 text-center mb-4">{error}</Text>
        <TouchableOpacity
          className="bg-blue-500 px-4 py-2 rounded"
          onPress={loadUsers}
        >
          <Text className="text-white font-medium">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Search Bar */}
      <View className="mb-4">
        <TextInput
          className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchError && (
          <Text className="text-red-600 text-sm mt-1">{searchError}</Text>
        )}
      </View>

      {/* Role Filter */}
      {renderRoleFilter()}

      {/* Stats */}
      <View className="mb-4">
        <Text className="text-sm text-gray-600">
          Showing {filteredUsers.length} of {users.length} users
        </Text>
      </View>

      {/* User List */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="py-8 text-center">
            <Text className="text-gray-500 text-center">
              {searchQuery || selectedRole !== 'all'
                ? 'No users match your filters'
                : 'No users found'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}; 