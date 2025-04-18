import { useAuthStore } from '../auth.store';

const useAuth = () => {
  return {
    user: useAuthStore((s) => s.user),
    token: useAuthStore((s) => s.accessToken),
    isAuthenticated: useAuthStore((s) => s.isAuthenticated),
    isLoading: useAuthStore((s) => s.isLoading),
    error: useAuthStore((s) => s.error),

    login: useAuthStore((s) => s.login),
    register: useAuthStore((s) => s.register),
    logout: useAuthStore((s) => s.logout),
    updateUser: useAuthStore((s) => s.updateUser),
    refreshToken: useAuthStore((s) => s.refreshToken),
    clearError: useAuthStore((s) => s.clearError),
  };
};

export default useAuth;

