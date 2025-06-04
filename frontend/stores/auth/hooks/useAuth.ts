import { useAuthStore } from "../auth.store";
import { UserPreferences } from "@/types/auth.types";

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
    updateUserPreferences: useAuthStore((s) => s.updateUserPreferences),
    uploadProfilePicture: useAuthStore((s) => s.uploadProfilePicture),
    deleteProfilePicture: useAuthStore((s) => s.deleteProfilePicture),
    deleteUser: useAuthStore((s) => s.deleteUser),
    refreshToken: useAuthStore((s) => s.refreshToken),
    clearError: useAuthStore((s) => s.clearError),
  };
};

export default useAuth;
