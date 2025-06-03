import { User, UserRole } from "@/types/auth.types";
import api from "@/services/api.service";

export interface CreateUserRequest {
    email: string;
    password: string;
    displayName: string;
    role?: UserRole;
    preferences?: any;
}

export interface UpdateUserRequest {
    email?: string;
    password?: string;
    displayName?: string;
    role?: UserRole;
    isActive?: boolean;
    preferences?: any;
}

export interface UsersResponse {
    message: string;
    users: User[];
    total?: number;
    page?: number;
    limit?: number;
}

export interface UserResponse {
    message: string;
    user: User;
}

/**
 * Service for admin-related API calls
 */
export const AdminService = {
    /**
     * Get all users (admin/moderator only)
     */
    async getAllUsers(): Promise<UsersResponse> {
        try {
            const response = await api.get("/auth/");
            return response.data;
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to fetch users";
                
                if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                } else if (error.response.status === 401) {
                    throw new Error(`Authentication Error: ${errorMessage}`);
                }
                
                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Get user by ID
     */
    async getUserById(userId: string): Promise<UserResponse> {
        try {
            const response = await api.get(`/auth/user/${userId}`);
            return response.data;
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to fetch user";
                
                if (error.response.status === 404) {
                    throw new Error(`Not Found: ${errorMessage}`);
                } else if (error.response.status === 403) {
                    throw new Error(`Permission Error: ${errorMessage}`);
                }
                
                throw new Error(errorMessage);
            }
            throw error;
        }
    },

    /**
     * Update user (admin operation)
     */
    async updateUser(userId: string, userData: UpdateUserRequest): Promise<UserResponse> {
        try {
            const response = await api.put(`/auth/update/${userId}`, userData);
            return response.data;
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to update user";
                
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
     * Delete user (admin only)
     */
    async deleteUser(userId: string): Promise<{ message: string }> {
        try {
            const response = await api.delete(`/auth/delete/${userId}`);
            return response.data;
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to delete user";
                
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
     * Create new user (using register endpoint)
     */
    async createUser(userData: CreateUserRequest): Promise<UserResponse> {
        try {
            const response = await api.post("/auth/register", userData);
            return response.data;
        } catch (error: any) {
            if (error.response) {
                const errorMessage = error.response.data.message || "Failed to create user";
                
                if (error.response.status === 400) {
                    throw new Error(`Validation Error: ${errorMessage}`);
                } else if (error.response.status === 409) {
                    throw new Error(`Conflict Error: ${errorMessage}`);
                }
                
                throw new Error(errorMessage);
            }
            throw error;
        }
    }
}; 