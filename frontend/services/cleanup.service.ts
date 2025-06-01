import { cleanupNotificationListeners } from "./notification-events.service";

// Define cleanup function type
type CleanupFunction = () => void | Promise<void>;

// Registry of cleanup functions
const cleanupRegistry: Set<CleanupFunction> = new Set();

/**
 * Register a cleanup function to be called during logout
 */
export function registerCleanupFunction(cleanupFn: CleanupFunction): void {
    cleanupRegistry.add(cleanupFn);
    console.log(`🧹 Registered cleanup function (total: ${cleanupRegistry.size})`);
}

/**
 * Unregister a cleanup function
 */
export function unregisterCleanupFunction(cleanupFn: CleanupFunction): void {
    cleanupRegistry.delete(cleanupFn);
    console.log(`🧹 Unregistered cleanup function (total: ${cleanupRegistry.size})`);
}

/**
 * Execute all registered cleanup functions
 */
export async function executeAllCleanupFunctions(): Promise<void> {
    console.log(`🧹 Executing ${cleanupRegistry.size} cleanup functions...`);
    
    const cleanupPromises: Promise<void>[] = [];
    
    for (const cleanupFn of cleanupRegistry) {
        try {
            const result = cleanupFn();
            if (result instanceof Promise) {
                cleanupPromises.push(result);
            }
        } catch (error) {
            console.warn("⚠️ Error executing cleanup function:", error);
        }
    }
    
    // Wait for all async cleanup functions to complete
    if (cleanupPromises.length > 0) {
        try {
            await Promise.allSettled(cleanupPromises);
        } catch (error) {
            console.warn("⚠️ Error waiting for async cleanup functions:", error);
        }
    }
    
    console.log("✅ All cleanup functions executed");
}

/**
 * Core cleanup function that handles basic cleanup without circular dependencies
 */
export async function performCoreCleanup(): Promise<void> {
    try {
        // Clean up notification listeners (this doesn't create circular dependency)
        cleanupNotificationListeners();
        console.log("🧹 Cleaned up notification listeners during logout");
        
        // Execute all registered cleanup functions
        await executeAllCleanupFunctions();
        
    } catch (cleanupError) {
        console.warn("⚠️ Error during core cleanup:", cleanupError);
        // Don't let cleanup errors prevent logout
    }
} 