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
  ) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateUser: (userId: string, userData: Partial<User>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      accessToken: null,
      user: null,
      isLoading: false,
      error: null,

      register: async (email, password, displayName, preferences) => {
        set({ isLoading: true, error: null });
        try {
          const data = await AuthService.register(
            email,
            password,
            displayName,
            preferences,
          );

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
          const { accessToken } = get();

          if (accessToken) {
            await AuthService.logout(accessToken);
          } else {
            throw new Error("Logout failed");
          }

          set({
            isAuthenticated: false,
            accessToken: null,
            user: null,
          });

          router.navigate("/");
        } catch (error) {
          console.error("Logout error:", error);
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

          set({
            accessToken: data.accessToken,
            isAuthenticated: true,
          });
          return true;
        } catch (error) {
          console.error("Refresh token error:", error);
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
          const { accessToken } = get();

          if (accessToken) {
            const data = await AuthService.updateUser(
              accessToken,
              userId,
              userData,
            );
            set({
              user: data.user,
            });
          } else {
            throw new Error("Can't update user");
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Update failed",
          });
          console.error("Update user error:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
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
