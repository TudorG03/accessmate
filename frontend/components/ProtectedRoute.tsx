import React, { ReactNode, useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import useAuth from '../stores/auth/hooks/useAuth';
import { useRole } from '../stores/auth/hooks/useRole';
import { UserRole } from '@/types/auth.types';
import { useTheme } from '../stores/theme/useTheme';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  fallbackPath = '/login'
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasAtLeast } = useRole();
  const { colors } = useTheme();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(fallbackPath);
    }
  }, [isAuthenticated, isLoading, fallbackPath]);

  // Check if user has required role
  const hasRequiredRole = !allowedRoles || hasAtLeast(allowedRoles);

  // Handle unauthorized users (authenticated but wrong role)
  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasRequiredRole) {
      // Redirect to unauthorized page or dashboard
      router.replace('/unauthorized');
    }
  }, [isAuthenticated, hasRequiredRole, isLoading]);

  if (isLoading) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: colors.background }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Only render children if authenticated and has required role
  if (isAuthenticated && hasRequiredRole) {
    return <>{children}</>;
  }

  // Render nothing while redirecting
  return null;
} 