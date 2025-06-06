import { User, UserPreferences } from "@/types/auth.types";
import api from "@/services/api.service";
import { AuthResponse, TokenResponse } from "./auth.types";

/**
 * Service for authentication-related API calls
 */
export const AuthService = {
    /**
     * Register a new user
     */
    async register(
        email: string,
        password: string,
        displayName: string,
        preferences?: any,
        profilePicture?: string,
    ): Promise<AuthResponse> {
        try {
            const response = await api.post("/auth/register", {
                email,
                password,
                displayName,
                preferences,
                profilePicture,
            });

            return response.data;
        } catch (error) {
            if (error.response) {
                // Extract the specific error message
                const errorMessage = error.response.data.message ||
                    "Registration failed";

                // Add more context based on status code
                if (error.response.status === 400) {
                    // Bad request - likely validation error
                    throw new Error(`Validation Error: ${errorMessage}`);
                } else if (error.response.status === 409) {
                    // Conflict - likely email already exists
                    throw new Error(`Account Error: ${errorMessage}`);
                } else if (error.response.status === 401) {
                    // Unauthorized
                    throw new Error(`Authentication Error: ${errorMessage}`);
                } else if (error.response.status >= 500) {
                    // Server error
                    throw new Error(`Server Error: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Login an existing user
     */
    async login(
        email: string,
        password: string,
    ): Promise<AuthResponse> {
        try {
            const response = await api.post("/auth/login", { email, password });
            return response.data;
        } catch (error) {
            if (error.response) {
                // Extract the specific error message
                const errorMessage = error.response.data.message ||
                    "Login failed";

                // Add more context based on status code
                if (error.response.status === 400) {
                    // Bad request - likely validation error
                    throw new Error(`Input Error: ${errorMessage}`);
                } else if (error.response.status === 401) {
                    // Unauthorized - likely incorrect credentials
                    throw new Error(`Authentication Error: ${errorMessage}`);
                } else if (error.response.status >= 500) {
                    // Server error
                    throw new Error(`Server Error: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Logout the current user
     */
    async logout(): Promise<void> {
        try {
            await api.post("/auth/logout");
        } catch (error) {
            console.error("Logout error:", error);
            // We don't throw here since logout should succeed even with errors
        }
    },

    /**
     * Refresh the access token using refresh token cookie
     */
    async refreshToken(): Promise<TokenResponse> {
        try {
            const response = await api.post("/auth/refresh-token");
            return response.data;
        } catch (error) {
            if (error.response) {
                const errorMessage = error.response.data.message ||
                    "Token refresh failed";

                if (error.response.status === 401) {
                    throw new Error(`Session expired: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Update user information
     */
    async updateUser(
        userId: string,
        userData: Partial<User>,
    ): Promise<{ user: User }> {
        try {
            const response = await api.put(`/auth/update/${userId}`, userData);
            return response.data;
        } catch (error) {
            if (error.response) {
                const errorMessage = error.response.data.message ||
                    "Update failed";

                if (error.response.status === 400) {
                    throw new Error(`Validation Error: ${errorMessage}`);
                } else if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (error.response.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Update user preferences
     */
    async updateUserPreferences(
        userId: string,
        preferences: UserPreferences,
    ): Promise<{ user: User }> {
        try {
            const response = await api.put(`/auth/update/${userId}`, {
                preferences,
            });
            return response.data;
        } catch (error) {
            if (error.response) {
                const errorMessage = error.response.data.message ||
                    "Preferences update failed";

                if (error.response.status === 400) {
                    throw new Error(`Validation Error: ${errorMessage}`);
                } else if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (error.response.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Upload/Update profile picture for a user
     */
    async uploadProfilePicture(
        userId: string,
        profilePicture: string,
    ): Promise<{ user: User }> {
        try {
            const response = await api.put(`/auth/profile-picture/${userId}`, {
                profilePicture,
            });
            return response.data;
        } catch (error) {
            if (error.response) {
                const errorMessage = error.response.data.message ||
                    "Profile picture upload failed";

                if (error.response.status === 400) {
                    throw new Error(`Validation Error: ${errorMessage}`);
                } else if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (error.response.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Delete profile picture for a user
     */
    async deleteProfilePicture(userId: string): Promise<{ user: User }> {
        try {
            const response = await api.delete(
                `/auth/profile-picture/${userId}`,
            );
            return response.data;
        } catch (error) {
            if (error.response) {
                const errorMessage = error.response.data.message ||
                    "Profile picture deletion failed";

                if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (error.response.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Delete user account
     */
    async deleteUser(userId: string): Promise<{ message: string }> {
        try {
            const response = await api.delete(`/auth/delete/${userId}`);
            return response.data;
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message ||
                    "Account deletion failed";

                if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (error.response.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                }

                throw new Error(errorMessage);
            }
            throw error;
        }
    },
};

// Legacy functions for backward compatibility
// These will help avoid breaking existing code
export const registerRequest = AuthService.register;
export const loginRequest = AuthService.login;
export const logoutRequest = AuthService.logout;
export const refreshTokenRequest = AuthService.refreshToken;
export const updateUserRequest = AuthService.updateUser;
