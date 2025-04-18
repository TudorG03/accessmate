import { useAuthStore } from '../auth.store';
import { UserRole } from '@/types/auth.types';

export function useRole() {
  const role = useAuthStore((s) => s.user?.role);

  return {
    role,
    isUser: role === UserRole.USER,
    isModerator: role === UserRole.MODERATOR,
    isAdmin: role === UserRole.ADMIN,
    hasAtLeast: (allowed: UserRole[]) => !!role && allowed.includes(role),
  };
}
