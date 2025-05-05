import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_URL } from "@/constants/api";
import { getAccessToken, setAccessToken } from "@/stores/auth/auth.token";

// Create axios instance with default config
const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

// Flag to track if we're currently refreshing the token
let isRefreshing = false;
// Queue of requests that are waiting for the token refresh
let failedQueue: { resolve: Function; reject: Function }[] = [];

// Auth endpoints that should NOT trigger token refresh
const AUTH_ENDPOINTS = ["/auth/login", "/auth/register"];

// Function to handle logout - will be set by auth store
let logoutHandler: (() => Promise<void>) | null = null;

// Register the logout handler
export const registerLogoutHandler = (handler: () => Promise<void>) => {
    logoutHandler = handler;
};

const processQueue = (error: Error | null, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

// Add request interceptor
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const accessToken = getAccessToken();
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

// Add response interceptor
api.interceptors.response.use(
    (response) => {
        // Log successful responses for debugging
        console.log(
            `🌐 API Success [${response.config.method?.toUpperCase()}] ${response.config.url}`,
            {
                status: response.status,
                hasData: !!response.data,
            },
        );
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config;

        // If there's no config or it's already been retried, reject
        if (!originalRequest || (originalRequest as any)._retry) {
            console.error("🌐 API Error (already retried or no config):", {
                url: originalRequest?.url || "unknown",
                status: error.response?.status,
                message: error.message,
            });
            return Promise.reject(error);
        }

        // Log error details for debugging
        console.error("🌐 API Error:", {
            url: originalRequest.url,
            method: originalRequest.method?.toUpperCase(),
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });

        // Get the request URL path
        const requestPath = originalRequest.url || "";

        // Check if the error is due to an expired token AND the request is NOT an auth endpoint
        if (
            error.response?.status === 401 &&
            !AUTH_ENDPOINTS.some((endpoint) => requestPath.includes(endpoint))
        ) {
            // Check if we have a token. If not, likely already logged out
            const hasToken = !!getAccessToken();
            if (!hasToken) {
                console.log("🌐 No access token, not attempting token refresh");
                return Promise.reject(error);
            }

            console.log("🌐 Token expired, attempting refresh...");
            if (isRefreshing) {
                // If we're already refreshing, add this request to the queue
                console.log(
                    "🌐 Token refresh already in progress, adding request to queue",
                );
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        console.log(
                            "🌐 Queue processed, retrying with new token",
                        );
                        originalRequest.headers.Authorization =
                            `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch((err) => {
                        console.error("🌐 Queue processing failed:", err);
                        return Promise.reject(err);
                    });
            }

            (originalRequest as any)._retry = true;
            isRefreshing = true;

            try {
                console.log("🌐 Refreshing token...");
                // Instead of AuthService.refreshToken, call the refresh endpoint directly
                const response = await axios.post(
                    `${API_URL}/auth/refresh-token`,
                    {},
                    { withCredentials: true },
                );
                const { accessToken } = response.data;
                console.log("🌐 Token refresh successful");
                setAccessToken(accessToken);

                // Update the failed request with new token
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;

                // Process any queued requests
                console.log("🌐 Processing queued requests");
                processQueue(null, accessToken);

                // Retry the original request
                return api(originalRequest);
            } catch (refreshError) {
                console.error("🌐 Token refresh failed:", refreshError);
                // If refresh fails, reject all queued requests
                processQueue(refreshError as Error);

                setAccessToken(null);

                // Call the logout handler if it's registered
                if (logoutHandler) {
                    console.log(
                        "🌐 Calling logout handler after token refresh failure",
                    );
                    try {
                        await logoutHandler();
                    } catch (e) {
                        console.error(
                            "🌐 Error during logout after refresh failure:",
                            e,
                        );
                    }
                }

                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // For network errors, add more context
        if (!error.response) {
            const enhancedError = new Error(`Network error: ${error.message}`);
            return Promise.reject(enhancedError);
        }

        return Promise.reject(error);
    },
);

export default api;
