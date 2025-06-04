import { AccessibilityData } from "./accessibility-enhancement.service.ts";

interface CacheEntry {
  data: AccessibilityData;
  timestamp: number;
  userId: string;
}

export class AccessibilityCache {
  private static cache = new Map<string, CacheEntry>();
  private static readonly CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly MAX_CACHE_SIZE = 1000; // Maximum number of entries

  /**
   * Generate cache key for a place and user combination
   */
  private static generateKey(placeId: string, userId: string): string {
    return `${placeId}_${userId}`;
  }

  /**
   * Get cached accessibility data
   */
  static get(placeId: string, userId: string): AccessibilityData | null {
    const key = this.generateKey(placeId, userId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const isExpired = Date.now() - entry.timestamp > this.CACHE_DURATION_MS;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set accessibility data in cache
   */
  static set(placeId: string, userId: string, data: AccessibilityData): void {
    // Clean up old entries if cache is getting too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanup();
    }

    const key = this.generateKey(placeId, userId);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      userId
    });
  }

  /**
   * Invalidate cache entries for a specific user
   */
  static invalidateUser(userId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.userId === userId) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate cache entries for a specific place (all users)
   */
  static invalidatePlace(placeId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(placeId + "_")) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clean up expired entries
   */
  static cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION_MS) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    // If still too large after cleanup, remove oldest entries
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = this.cache.size - Math.floor(this.MAX_CACHE_SIZE * 0.8); // Remove 20% of entries
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(sortedEntries[i][0]);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  static clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: 0, // Would need to track hits/misses to calculate
      oldestEntry: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
      newestEntry: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
    };
  }
} 