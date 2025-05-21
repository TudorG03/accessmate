import { API_URL } from "@/constants/api";
import apiService from "./api.service";

// Interface for navigation history entry
interface NavigationHistoryEntry {
    userId: string;
    placeId: string;
    placeName: string;
    placeTypes: string[];
    location: {
        latitude: number;
        longitude: number;
    };
}

/**
 * Records a navigation start event to the user's history
 *
 * @param placeData Data about the place being navigated to
 * @param userId The ID of the current user
 * @returns Promise that resolves to the navigation ID or null if recording failed
 */
export const recordNavigationStart = async (
    placeData: {
        placeId: string;
        placeName: string;
        placeTypes: string[];
        location: {
            latitude: number;
            longitude: number;
        };
    },
    userId: string | undefined,
): Promise<string | null> => {
    try {
        console.log(
            "📍 Navigation History: recordNavigationStart called with data:",
            placeData,
        );
        console.log(
            "📍 Navigation History: Current user:",
            userId || "Not logged in",
        );

        if (!userId) {
            console.warn(
                "Cannot record navigation history: User not logged in",
            );
            return null;
        }

        const historyEntry: NavigationHistoryEntry = {
            userId,
            ...placeData,
        };

        console.log(
            "📍 Navigation History: Making API call to:",
            `${API_URL}/api/navigation-history`,
        );
        console.log("📍 Navigation History: With payload:", historyEntry);

        const response = await apiService.post(
            `${API_URL}/api/navigation-history`,
            historyEntry,
        );

        console.log(
            "📍 Navigation History: API call successful, response:",
            response.data,
        );
        return response.data?.history?._id || null;
    } catch (error) {
        console.error("📍 Navigation History: API call failed:", error);
        // Log more details about the error
        if (error && typeof error === "object" && "response" in error) {
            const axiosError = error as any;
            console.error("📍 Response status:", axiosError.response?.status);
            console.error("📍 Response data:", axiosError.response?.data);
        }
        return null;
    }
};

/**
 * Mark a navigation as completed (not currently used but implemented for future use)
 *
 * @param navigationId ID of the navigation history entry to mark as completed
 * @returns Promise that resolves when the history is updated
 */
export const completeNavigation = async (
    navigationId: string,
): Promise<boolean> => {
    // This is a placeholder function that can be expanded in the future
    // When we want to track completed vs. abandoned navigations
    console.log(`Navigation ${navigationId} completed`);
    return true;
};

/**
 * Retrieves user's navigation history
 *
 * @param userId The ID of the current user
 * @param limit Maximum number of history entries to return
 * @returns Promise that resolves to navigation history entries
 */
export const getUserNavigationHistory = async (
    userId: string | undefined,
    limit = 20,
): Promise<any[]> => {
    try {
        if (!userId) {
            console.warn("Cannot get navigation history: User not logged in");
            return [];
        }

        const response = await apiService.get(
            `${API_URL}/api/navigation-history/user/${userId}?limit=${limit}`,
        );

        return response.data.history || [];
    } catch (error) {
        console.error("Failed to get navigation history:", error);
        return [];
    }
};

export default {
    recordNavigationStart,
    getUserNavigationHistory,
    completeNavigation,
};
