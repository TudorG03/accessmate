import { getAccessToken } from "./auth.token";

/**
 * Check if there's a valid access token without importing auth store
 * @returns True if there's a valid access token, false otherwise
 */
export const hasValidToken = (): boolean => {
  const currentToken = getAccessToken();
  return !!currentToken;
};

/**
 * Simple authentication check that doesn't create circular dependencies
 * This is a lightweight version for services that don't need full auth state
 * @returns True if there's a valid access token, false otherwise
 */
export const isAuthenticatedSimple = (): boolean => {
  return hasValidToken();
}; 