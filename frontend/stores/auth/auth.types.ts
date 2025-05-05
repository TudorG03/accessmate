import { User } from "@/types/auth.types";

// Response types for auth operations
export interface AuthResponse {
    accessToken: string;
    user: User;
}

export interface TokenResponse {
    accessToken: string;
}

// Auth token management functions type
export interface TokenManager {
    getAccessToken: () => string | null;
    setAccessToken: (token: string | null) => void;
}
