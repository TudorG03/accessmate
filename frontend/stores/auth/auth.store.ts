import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";
import { router } from "expo-router";
import {
  ActivityType,
  Budget,
  TransportMethod,
  User,
  UserPreferences,
  UserRole,
} from "@/types/auth.types";
import { AuthService } from "./auth.service";
import { getAccessToken, setAccessToken } from "./auth.token";
import api, { registerLogoutHandler } from "@/services/api.service";
import { AuthResponse } from "./auth.types";
import { performCoreCleanup } from "@/services/cleanup.service";

const storage = new MMKV();

const mmkvStorage = {
  setItem: (name: string, value: string) => {
    return storage.set(name, value);
  },
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  removeItem: (name: string) => {
    return storage.delete(name);
  },
};

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  register: (
    email: string,
    password: string,
    displayName: string,
    preferences?: Partial<UserPreferences>,
    profilePicture?: string,
  ) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateUser: (userId: string, userData: Partial<User>) => Promise<void>;
  updateUserPreferences: (preferences: UserPreferences) => Promise<void>;
  uploadProfilePicture: (
    userId: string,
    profilePicture: string,
  ) => Promise<void>;
  deleteProfilePicture: (userId: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // Create the store object
      const store = {
        isAuthenticated: false,
        accessToken: null,
        user: null,
        isLoading: false,
        error: null,

        register: async (
          email,
          password,
          displayName,
          preferences,
          profilePicture,
        ) => {
          set({ isLoading: true, error: null });
          try {
            const data = await AuthService.register(
              email,
              password,
              displayName,
              preferences,
              profilePicture,
            );

            setAccessToken(data.accessToken);
            set({
              isAuthenticated: true,
              accessToken: data.accessToken,
              user: data.user,
            });

            if (data.user && data.user.role) {
              switch (data.user.role) {
                case UserRole.ADMIN:
                  router.replace("/admin");
                  break;
                case UserRole.MODERATOR:
                  router.replace("/moderator");
                  break;
                case UserRole.USER:
                  router.replace("/(tabs)/home");
                  break;
                default:
                  router.replace("/");
              }
            } else {
              router.replace("/");
            }
          } catch (error) {
            set({
              error: error instanceof Error
                ? error.message
                : "Registration failed",
            });
            console.error("Registration error:", error);
          } finally {
            set({ isLoading: false });
          }
        },

        login: async (email, password) => {
          set({ isLoading: true, error: null });
          try {
            const data = await AuthService.login(email, password);

            setAccessToken(data.accessToken);
            set({
              isAuthenticated: true,
              accessToken: data.accessToken,
              user: data.user,
            });

            if (data.user && data.user.role) {
              switch (data.user.role) {
                case UserRole.ADMIN:
                  router.replace("/admin");
                  break;
                case UserRole.MODERATOR:
                  router.replace("/moderator");
                  break;
                case UserRole.USER:
                  router.replace("/(tabs)/home");
                  break;
                default:
                  router.replace("/");
              }
            } else {
              router.replace("/");
            }
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : "Login failed",
            });
            console.error("Login error:", error);
          } finally {
            set({ isLoading: false });
          }
        },

        logout: async () => {
          set({ isLoading: true, error: null });
          try {
            await AuthService.logout();

            // Cleanup resources to prevent memory leaks
            await performCoreCleanup();

            setAccessToken(null);
            set({
              isAuthenticated: false,
              accessToken: null,
              user: null,
            });

            router.navigate("/");
          } catch (error) {
            console.error("Logout error:", error);
            
            // Still perform cleanup even if logout API call fails
            await performCoreCleanup();
            
            setAccessToken(null);
            set({
              isAuthenticated: false,
              accessToken: null,
              user: null,
            });

            router.navigate("/");
          } finally {
            set({ isLoading: false });
          }
        },

        refreshToken: async () => {
          try {
            const data = await AuthService.refreshToken();

            setAccessToken(data.accessToken);
            set({
              accessToken: data.accessToken,
              isAuthenticated: true,
            });
            return true;
          } catch (error) {
            console.error("Refresh token error:", error);
            setAccessToken(null);
            set({
              isAuthenticated: false,
              accessToken: null,
              user: null,
            });
            return false;
          }
        },

        updateUser: async (userId, userData) => {
          set({ isLoading: true, error: null });
          try {
            const data = await AuthService.updateUser(
              userId,
              userData,
            );
            set({ user: data.user });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : "Update failed",
            });
            console.error("Update user error:", error);
          } finally {
            set({ isLoading: false });
          }
        },

        updateUserPreferences: async (preferences: UserPreferences) => {
          set({ isLoading: true, error: null });
          try {
            if (!get().user || !get().user.id) {
              throw new Error("User not authenticated");
            }

            const userId = get().user.id;
            const data = await AuthService.updateUserPreferences(
              userId,
              preferences,
            );

            set({ user: data.user });
          } catch (error) {
            set({
              error: error instanceof Error
                ? error.message
                : "Preferences update failed",
            });
            console.error("Update preferences error:", error);
          } finally {
            set({ isLoading: false });
          }
        },

        uploadProfilePicture: async (userId, profilePicture) => {
          set({ isLoading: true, error: null });
          try {
            const data = await AuthService.uploadProfilePicture(
              userId,
              profilePicture,
            );
            set({ user: data.user });
          } catch (error) {
            set({
              error: error instanceof Error
                ? error.message
                : "Profile picture upload failed",
            });
            console.error("Upload profile picture error:", error);
          } finally {
            set({ isLoading: false });
          }
        },

        deleteProfilePicture: async (userId) => {
          set({ isLoading: true, error: null });
          try {
            const data = await AuthService.deleteProfilePicture(userId);
            set({ user: data.user });
          } catch (error) {
            set({
              error: error instanceof Error
                ? error.message
                : "Profile picture deletion failed",
            });
            console.error("Delete profile picture error:", error);
          } finally {
            set({ isLoading: false });
          }
        },

        clearError: () => set({ error: null }),
      };

      // Register the logout handler with the API service
      registerLogoutHandler(store.logout);

      return store;
    },
    {
      name: "auth-storage",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
