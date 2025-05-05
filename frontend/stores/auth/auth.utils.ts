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
  const MAX_RETRIES = 1;

  // This function can be used to wrap API calls that require authentication
  return async <T>(apiCall: () => Promise<T>, retryCount = 0): Promise<T> => {
    try {
      return await apiCall();
    } catch (error) {
      // If we get an unauthorized error, try to refresh the token
      if (
        (error instanceof Response && error.status === 401) ||
        (error instanceof Error && error.message.includes("401"))
      ) {
        if (retryCount < MAX_RETRIES) {
          const refreshed = await refreshToken();
          if (refreshed) {
            // Retry the API call with the new token
            return useTokenRefresh()(apiCall, retryCount + 1);
          }
        }
      }
      throw error;
    }
  };
};
