import { cleanupNotificationListeners } from "./notification-events.service";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

// Define cleanup function type
type CleanupFunction = () => void | Promise<void>;

// Define cleanup categories for better organization
export enum CleanupCategory {
    LOCATION = "location",
    NOTIFICATIONS = "notifications",
    TRACKING = "tracking",
    STORAGE = "storage",
    GENERAL = "general",
}

// Registry of cleanup functions by category
const cleanupRegistry: Map<CleanupCategory, Set<CleanupFunction>> = new Map();

// Initialize all categories
Object.values(CleanupCategory).forEach((category) => {
    cleanupRegistry.set(category as CleanupCategory, new Set());
});

// Global state tracking for centralized cleanup
const cleanupState = {
    intervals: new Set<NodeJS.Timeout>(),
    subscriptions: new Set<() => void>(),
    tasks: new Set<string>(),
    isShuttingDown: false,
};

/**
 * Register a cleanup function to be called during cleanup
 */
export function registerCleanupFunction(
    cleanupFn: CleanupFunction,
    category: CleanupCategory = CleanupCategory.GENERAL,
): void {
    const categorySet = cleanupRegistry.get(category);
    if (categorySet) {
        categorySet.add(cleanupFn);
        console.log(
            `🧹 Registered ${category} cleanup function (total: ${getTotalCleanupFunctions()})`,
        );
    }
}

/**
 * Unregister a cleanup function
 */
export function unregisterCleanupFunction(
    cleanupFn: CleanupFunction,
    category: CleanupCategory = CleanupCategory.GENERAL,
): void {
    const categorySet = cleanupRegistry.get(category);
    if (categorySet) {
        categorySet.delete(cleanupFn);
        console.log(
            `🧹 Unregistered ${category} cleanup function (total: ${getTotalCleanupFunctions()})`,
        );
    }
}

/**
 * Get total number of registered cleanup functions
 */
function getTotalCleanupFunctions(): number {
    return Array.from(cleanupRegistry.values()).reduce(
        (total, set) => total + set.size,
        0,
    );
}

/**
 * Add interval to tracking for automatic cleanup
 */
export function trackInterval(interval: NodeJS.Timeout): void {
    cleanupState.intervals.add(interval);
}

/**
 * Add subscription to tracking for automatic cleanup
 */
export function trackSubscription(unsubscribe: () => void): void {
    cleanupState.subscriptions.add(unsubscribe);
}

/**
 * Add background task to tracking for automatic cleanup
 */
export function trackBackgroundTask(taskName: string): void {
    cleanupState.tasks.add(taskName);
}

/**
 * Remove interval from tracking (when manually cleaned)
 */
export function untrackInterval(interval: NodeJS.Timeout): void {
    cleanupState.intervals.delete(interval);
}

/**
 * Remove subscription from tracking (when manually cleaned)
 */
export function untrackSubscription(unsubscribe: () => void): void {
    cleanupState.subscriptions.delete(unsubscribe);
}

/**
 * Remove task from tracking (when manually cleaned)
 */
export function untrackBackgroundTask(taskName: string): void {
    cleanupState.tasks.delete(taskName);
}

/**
 * Clean all tracked intervals
 */
async function cleanupTrackedIntervals(): Promise<void> {
    console.log(
        `🧹 Cleaning up ${cleanupState.intervals.size} tracked intervals`,
    );

    for (const interval of cleanupState.intervals) {
        try {
            clearInterval(interval);
        } catch (error) {
            console.warn("⚠️ Error clearing interval:", error);
        }
    }

    cleanupState.intervals.clear();
}

/**
 * Clean all tracked subscriptions
 */
async function cleanupTrackedSubscriptions(): Promise<void> {
    console.log(
        `🧹 Cleaning up ${cleanupState.subscriptions.size} tracked subscriptions`,
    );

    for (const unsubscribe of cleanupState.subscriptions) {
        try {
            unsubscribe();
        } catch (error) {
            console.warn("⚠️ Error cleaning subscription:", error);
        }
    }

    cleanupState.subscriptions.clear();
}

/**
 * Clean all tracked background tasks
 */
async function cleanupTrackedTasks(): Promise<void> {
    console.log(
        `🧹 Cleaning up ${cleanupState.tasks.size} tracked background tasks`,
    );

    for (const taskName of cleanupState.tasks) {
        try {
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(
                taskName,
            );
            if (hasStarted) {
                await Location.stopLocationUpdatesAsync(taskName);
                console.log(`🧹 Stopped background task: ${taskName}`);
            }

            // Unregister task if possible (mainly for development)
            if (TaskManager.isTaskDefined(taskName)) {
                await TaskManager.unregisterTaskAsync(taskName);
                console.log(`🧹 Unregistered background task: ${taskName}`);
            }
        } catch (error) {
            console.warn(`⚠️ Error cleaning task ${taskName}:`, error);
        }
    }

    cleanupState.tasks.clear();
}

/**
 * Execute cleanup functions for a specific category
 */
async function executeCleanupCategory(
    category: CleanupCategory,
): Promise<void> {
    const categorySet = cleanupRegistry.get(category);
    if (!categorySet || categorySet.size === 0) {
        return;
    }

    console.log(
        `🧹 Executing ${categorySet.size} ${category} cleanup functions...`,
    );

    const cleanupPromises: Promise<void>[] = [];

    for (const cleanupFn of categorySet) {
        try {
            const result = cleanupFn();
            if (result instanceof Promise) {
                cleanupPromises.push(result);
            }
        } catch (error) {
            console.warn(
                `⚠️ Error executing ${category} cleanup function:`,
                error,
            );
        }
    }

    // Wait for all async cleanup functions to complete
    if (cleanupPromises.length > 0) {
        try {
            await Promise.allSettled(cleanupPromises);
        } catch (error) {
            console.warn(
                `⚠️ Error waiting for ${category} async cleanup functions:`,
                error,
            );
        }
    }

    console.log(`✅ Completed ${category} cleanup`);
}

/**
 * Execute all registered cleanup functions by category
 */
export async function executeAllCleanupFunctions(): Promise<void> {
    console.log(
        `🧹 Executing cleanup for ${getTotalCleanupFunctions()} total functions...`,
    );

    // Execute in order of importance
    const cleanupOrder = [
        CleanupCategory.LOCATION,
        CleanupCategory.TRACKING,
        CleanupCategory.NOTIFICATIONS,
        CleanupCategory.STORAGE,
        CleanupCategory.GENERAL,
    ];

    for (const category of cleanupOrder) {
        await executeCleanupCategory(category);
    }

    console.log("✅ All categorized cleanup functions executed");
}

/**
 * Complete system cleanup - cleans everything
 */
export async function performCompleteCleanup(): Promise<void> {
    if (cleanupState.isShuttingDown) {
        console.log("🧹 Cleanup already in progress, skipping...");
        return;
    }

    cleanupState.isShuttingDown = true;
    console.log("🧹 Starting complete system cleanup...");

    try {
        // 1. Clean tracked resources first
        await Promise.allSettled([
            cleanupTrackedIntervals(),
            cleanupTrackedSubscriptions(),
            cleanupTrackedTasks(),
        ]);

        // 2. Execute all registered cleanup functions
        await executeAllCleanupFunctions();

        // 3. Clean up notification listeners (legacy)
        cleanupNotificationListeners();

        console.log("✅ Complete system cleanup finished");
    } catch (error) {
        console.error("❌ Error during complete cleanup:", error);
    } finally {
        cleanupState.isShuttingDown = false;
    }
}

/**
 * Core cleanup function that handles basic cleanup without circular dependencies
 * (Legacy function - use performCompleteCleanup for new code)
 */
export async function performCoreCleanup(): Promise<void> {
    console.log("🧹 Performing core cleanup (legacy)...");
    await performCompleteCleanup();
}

/**
 * Cleanup specific to location services
 */
export async function cleanupLocationServices(): Promise<void> {
    console.log("🧹 Starting location services cleanup...");
    await executeCleanupCategory(CleanupCategory.LOCATION);
}

/**
 * Cleanup specific to tracking services
 */
export async function cleanupTrackingServices(): Promise<void> {
    console.log("🧹 Starting tracking services cleanup...");
    await executeCleanupCategory(CleanupCategory.TRACKING);
}

/**
 * Cleanup specific to notification services
 */
export async function cleanupNotificationServices(): Promise<void> {
    console.log("🧹 Starting notification services cleanup...");
    await executeCleanupCategory(CleanupCategory.NOTIFICATIONS);
}

/**
 * Get cleanup status for debugging
 */
export function getCleanupStatus() {
    return {
        totalFunctions: getTotalCleanupFunctions(),
        byCategory: Object.fromEntries(
            Array.from(cleanupRegistry.entries()).map((
                [category, set],
            ) => [category, set.size]),
        ),
        tracked: {
            intervals: cleanupState.intervals.size,
            subscriptions: cleanupState.subscriptions.size,
            tasks: cleanupState.tasks.size,
        },
        isShuttingDown: cleanupState.isShuttingDown,
    };
}
