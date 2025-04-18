import { User, UserPreferences } from "@/types/auth.types";
import { API_URL } from "@/constants/api";
import axios from "axios";

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
        preferences?: Partial<UserPreferences>,
    ): Promise<{ accessToken: string; user: User }> {
        try {
            console.log(
                `Sending registration request to: ${API_URL}/auth/register`,
            );
            const response = await axios.post(
                `${API_URL}/auth/register`,
                { email, password, displayName, preferences },
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    withCredentials: true, // Important for cookies
                },
            );

            return response.data;
        } catch (error) {
            console.error("Registration error details:", error);
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(
                    error.response.data.message || "Registration failed",
                );
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
    ): Promise<{ accessToken: string; user: User }> {
        try {
            const response = await axios.post(
                `${API_URL}/auth/login`,
                { email, password },
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    withCredentials: true, // Important for cookies
                },
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(error.response.data.message || "Login failed");
            }
            throw error;
        }
    },

    /**
     * Logout the current user
     */
    async logout(accessToken: string): Promise<void> {
        try {
            await axios.post(
                `${API_URL}/auth/logout`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    withCredentials: true,
                },
            );
        } catch (error) {
            console.error("Logout error:", error);
            // We don't throw here since logout should succeed even with errors
        }
    },

    /**
     * Refresh the access token using refresh token cookie
     */
    async refreshToken(): Promise<{ accessToken: string }> {
        try {
            const response = await axios.post(
                `${API_URL}/auth/refresh-token`,
                {},
                {
                    withCredentials: true,
                },
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(
                    error.response.data.message || "Token refresh failed",
                );
            }
            throw error;
        }
    },

    /**
     * Update a user's profile
     */
    async updateUser(
        accessToken: string,
        userId: string,
        userData: Partial<User>,
    ): Promise<{ user: User }> {
        try {
            const response = await axios.put(
                `${API_URL}/auth/update/${userId}`,
                userData,
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                    withCredentials: true,
                },
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(error.response.data.message || "Update failed");
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
