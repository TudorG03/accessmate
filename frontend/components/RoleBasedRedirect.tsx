import { UserRole } from '@/types/auth.types';
import { router } from 'expo-router';

/**
 * Gets the correct path for a user based on their role
 * @param role The user's role
 * @returns The path the user should be directed to
 */
export function getPathForRole(role: UserRole | undefined | null): string {
  if (!role) {
    return '/login';
  }

  switch (role) {
    case UserRole.ADMIN:
      return '/admin';
    case UserRole.MODERATOR:
      return '/moderator';
    case UserRole.USER:
      return '/(tabs)/home';
    default:
      return '/'; // Default to regular user dashboard
  }
}

/**
 * Redirects the user to the appropriate dashboard based on their role
 * @param role The user's role
 */
export function redirectBasedOnRole(role: UserRole | undefined | null) {
  console.log(`Redirecting based on role: ${role}`);

  if (!role) {
    router.replace('/' as const);
    return;
  }

  switch (role) {
    case UserRole.ADMIN:
      router.replace('/admin' as const);
      break;
    case UserRole.MODERATOR:
      router.replace('/moderator' as const);
      break;
    case UserRole.USER:
      // Navigate to the index screen of the tabs group
      router.replace('/(tabs)/home' as const);
      break;
    default:
      router.replace('/' as const);
  }
}