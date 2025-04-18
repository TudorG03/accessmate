import { useAuthStore } from "./auth.store";

export const getAuthHeader = () => {
  const { accessToken } = useAuthStore.getState();
  return {
    Authorization: `Bearer ${accessToken}`,
  };
};

/**
 * Get the current user's ID
 * @returns Promise that resolves to the current user's ID
 * @throws Error if user is not authenticated
 */
export const getUserId = async (): Promise<string> => {
  const user = useAuthStore.getState().user;

  if (!user || !user.id) {
    throw new Error("User not authenticated");
  }

  return user.id;
};

// Hook to refresh token when needed
export const useTokenRefresh = () => {
  const refreshToken = useAuthStore((state) => state.refreshToken);

  // This function can be used to wrap API calls that require authentication
  return async <T>(apiCall: () => Promise<T>): Promise<T> => {
    try {
      return await apiCall();
    } catch (error) {
      // If we get an unauthorized error, try to refresh the token
      if (error instanceof Response && error.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
          return await apiCall();
        }
      }
      throw error;
    }
  };
};
