import mongoose from "mongoose";
import NavigationHistory from "../models/history/navigation-history.mongo.ts";
import UserProfile from "../models/recommendation/user-profile.mongo.ts";

export interface ProfileUpdateOptions {
  forceRebuild?: boolean; // Rebuild entire profile from scratch
  includeRecentOnly?: boolean; // Only use last 30 days of data
  weightDecay?: number; // Decay factor for older visits (default: 0.95)
}

export interface LocationCluster {
  center: [number, number]; // [longitude, latitude]
  visitCount: number;
  radius: number;
  places: string[]; // place IDs in this cluster
}

export class UserProfileService {
  private static readonly DEFAULT_DECAY_FACTOR = 0.95;
  private static readonly CLUSTER_RADIUS_THRESHOLD = 1000; // 1km
  private static readonly MIN_VISITS_FOR_CLUSTER = 3;
  private static readonly MAX_PROFILE_AGE_HOURS = 24;

  /**
   * Get or create user profile, rebuilding if necessary
   */
  static async getOrCreateProfile(
    userId: string,
    options: ProfileUpdateOptions = {}
  ) {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      let profile = await UserProfile.findOne({ userId: userObjectId });

      // Check if profile needs update
      const needsUpdate =
        !profile ||
        (profile as any).needsUpdate() ||
        options.forceRebuild ||
        this.isProfileStale(profile);

      if (needsUpdate) {
        profile = await this.buildProfile(userId, options);
      }

      return profile;
    } catch (error) {
      console.error(
        `Error getting/creating profile for user ${userId}:`,
        error
      );
      throw new Error(
        `Failed to get user profile: ${(error as Error).message}`
      );
    }
  }

  /**
   * Build complete user profile from navigation history
   */
  static async buildProfile(
    userId: string,
    options: ProfileUpdateOptions = {}
  ) {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);

      // Get navigation history
      const navigationHistory = await this.getNavigationHistory(
        userId,
        options
      );

      if (navigationHistory.length === 0) {
        return this.createEmptyProfile(userObjectId);
      }

      // Extract behavioral patterns
      const categoryPreferences = this.extractCategoryPreferences(
        navigationHistory,
        options.weightDecay
      );
      const temporalPreferences =
        this.extractTemporalPreferences(navigationHistory);
      const locationPreferences = await this.extractLocationPreferences(
        navigationHistory
      );

      // Update or create profile
      const profileData = {
        userId: userObjectId,
        categoryPreferences: new Map(Object.entries(categoryPreferences)),
        temporalPreferences,
        locationPreferences,
        totalVisits: navigationHistory.length,
        lastUpdated: new Date(),
        version: 1,
      };

      const profile = await UserProfile.findOneAndUpdate(
        { userId: userObjectId },
        profileData,
        { upsert: true, new: true, runValidators: true }
      );

      console.log(
        `Built profile for user ${userId} with ${navigationHistory.length} visits`
      );
      return profile;
    } catch (error) {
      console.error(`Error building profile for user ${userId}:`, error);
      throw new Error(
        `Failed to build user profile: ${(error as Error).message}`
      );
    }
  }

  /**
   * Update profile incrementally with new navigation entry
   */
  static async updateProfileIncremental(
    userId: string,
    newVisit: any,
    options: ProfileUpdateOptions = {}
  ) {
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      let profile = await UserProfile.findOne({ userId: userObjectId });

      if (!profile) {
        // No profile exists, build from scratch
        return this.buildProfile(userId, options);
      }

      const decayFactor = options.weightDecay || this.DEFAULT_DECAY_FACTOR;

      // Update category preferences
      this.updateCategoryPreferences(profile, newVisit, decayFactor);

      // Update temporal preferences
      this.updateTemporalPreferences(profile, newVisit);

      // Update location preferences
      await this.updateLocationPreferences(profile, newVisit);

      // Update metadata
      profile.totalVisits += 1;
      profile.lastUpdated = new Date();

      await profile.save();
      console.log(`Updated profile incrementally for user ${userId}`);
      return profile;
    } catch (error) {
      console.error(`Error updating profile for user ${userId}:`, error);
      throw new Error(
        `Failed to update user profile: ${(error as Error).message}`
      );
    }
  }

  // Private helper methods

  private static async getNavigationHistory(
    userId: string,
    options: ProfileUpdateOptions
  ) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    let query: any = { userId: userObjectId };

    if (options.includeRecentOnly) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query.timestamp = { $gte: thirtyDaysAgo };
    }

    return NavigationHistory.find(query)
      .sort({ timestamp: -1 })
      .limit(1000) // Limit to prevent memory issues
      .lean();
  }

  private static extractCategoryPreferences(
    navigationHistory: any[],
    weightDecay = this.DEFAULT_DECAY_FACTOR
  ): Record<string, number> {
    const categoryScores: Record<string, number> = {};
    const now = Date.now();

    navigationHistory.forEach((visit, index) => {
      // Apply time-based decay (more recent visits have higher weight)
      const ageInDays =
        (now - new Date(visit.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      const timeDecay = Math.exp(-ageInDays / 30); // 30-day half-life

      // Apply position-based decay (more recent in list has higher weight)
      const positionDecay = Math.pow(weightDecay, index);

      const weight = timeDecay * positionDecay;

      visit.placeTypes.forEach((placeType: string) => {
        categoryScores[placeType] = (categoryScores[placeType] || 0) + weight;
      });
    });

    // Normalize scores to 0-1 range
    const maxScore = Math.max(...Object.values(categoryScores));
    if (maxScore > 0) {
      Object.keys(categoryScores).forEach((category) => {
        categoryScores[category] = categoryScores[category] / maxScore;
      });
    }

    return categoryScores;
  }

  private static extractTemporalPreferences(navigationHistory: any[]) {
    const hourOfDay = new Array(24).fill(0);
    const dayOfWeek = new Array(7).fill(0);

    navigationHistory.forEach((visit) => {
      const date = new Date(visit.timestamp);
      const hour = date.getHours();
      const day = date.getDay();

      hourOfDay[hour]++;
      dayOfWeek[day]++;
    });

    // Normalize by total visits
    const totalVisits = navigationHistory.length;
    if (totalVisits > 0) {
      for (let i = 0; i < 24; i++) {
        hourOfDay[i] = hourOfDay[i] / totalVisits;
      }
      for (let i = 0; i < 7; i++) {
        dayOfWeek[i] = dayOfWeek[i] / totalVisits;
      }
    }

    return { hourOfDay, dayOfWeek };
  }

  private static async extractLocationPreferences(navigationHistory: any[]) {
    const clusters = this.clusterLocations(navigationHistory);
    const preferredRadius = this.calculatePreferredRadius(navigationHistory);

    return {
      preferredRadius,
      frequentAreas: clusters.map((cluster) => ({
        center: {
          type: "Point",
          coordinates: cluster.center,
        },
        visitCount: cluster.visitCount,
        radius: cluster.radius,
      })),
    };
  }

  private static clusterLocations(navigationHistory: any[]): LocationCluster[] {
    const clusters: LocationCluster[] = [];

    navigationHistory.forEach((visit) => {
      const coords = visit.location.coordinates;
      let addedToCluster = false;

      // Try to add to existing cluster
      for (const cluster of clusters) {
        const distance = this.calculateDistance(coords, cluster.center);
        if (distance <= this.CLUSTER_RADIUS_THRESHOLD) {
          // Update cluster center (weighted average)
          const totalVisits = cluster.visitCount + 1;
          cluster.center[0] =
            (cluster.center[0] * cluster.visitCount + coords[0]) / totalVisits;
          cluster.center[1] =
            (cluster.center[1] * cluster.visitCount + coords[1]) / totalVisits;
          cluster.visitCount++;
          cluster.places.push(visit.placeId);
          addedToCluster = true;
          break;
        }
      }

      // Create new cluster if not added to existing one
      if (!addedToCluster) {
        clusters.push({
          center: [coords[0], coords[1]],
          visitCount: 1,
          radius: this.CLUSTER_RADIUS_THRESHOLD,
          places: [visit.placeId],
        });
      }
    });

    // Filter clusters with minimum visits
    return clusters.filter(
      (cluster) => cluster.visitCount >= this.MIN_VISITS_FOR_CLUSTER
    );
  }

  private static calculatePreferredRadius(navigationHistory: any[]): number {
    if (navigationHistory.length < 2) return 5000; // Default 5km

    const distances: number[] = [];
    const center = this.calculateCentroid(navigationHistory);

    navigationHistory.forEach((visit) => {
      const distance = this.calculateDistance(
        visit.location.coordinates,
        center
      );
      distances.push(distance);
    });

    // Use 80th percentile as preferred radius
    distances.sort((a, b) => a - b);
    const index = Math.floor(distances.length * 0.8);
    return Math.max(1000, Math.min(50000, distances[index])); // Between 1km and 50km
  }

  private static calculateCentroid(navigationHistory: any[]): [number, number] {
    const totalLng = navigationHistory.reduce(
      (sum, visit) => sum + visit.location.coordinates[0],
      0
    );
    const totalLat = navigationHistory.reduce(
      (sum, visit) => sum + visit.location.coordinates[1],
      0
    );
    const count = navigationHistory.length;

    return [totalLng / count, totalLat / count];
  }

  private static calculateDistance(coord1: number[], coord2: number[]): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (coord1[1] * Math.PI) / 180;
    const lat2Rad = (coord2[1] * Math.PI) / 180;
    const deltaLatRad = ((coord2[1] - coord1[1]) * Math.PI) / 180;
    const deltaLngRad = ((coord2[0] - coord1[0]) * Math.PI) / 180;

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLngRad / 2) *
        Math.sin(deltaLngRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private static createEmptyProfile(userObjectId: mongoose.Types.ObjectId) {
    return new UserProfile({
      userId: userObjectId,
      categoryPreferences: new Map(),
      temporalPreferences: {
        hourOfDay: new Array(24).fill(0),
        dayOfWeek: new Array(7).fill(0),
      },
      locationPreferences: {
        preferredRadius: 5000,
        frequentAreas: [],
      },
      totalVisits: 0,
      lastUpdated: new Date(),
      version: 1,
    });
  }

  private static isProfileStale(profile: any): boolean {
    const staleThreshold = new Date(
      Date.now() - this.MAX_PROFILE_AGE_HOURS * 60 * 60 * 1000
    );
    return profile.lastUpdated < staleThreshold;
  }

  private static updateCategoryPreferences(
    profile: any,
    newVisit: any,
    decayFactor: number
  ) {
    // Apply decay to existing preferences
    for (const [category, score] of profile.categoryPreferences.entries()) {
      profile.categoryPreferences.set(category, score * decayFactor);
    }

    // Add new visit preferences
    const weight = 1.0 / (profile.totalVisits + 1); // Normalize by total visits
    newVisit.placeTypes.forEach((placeType: string) => {
      const currentScore = profile.categoryPreferences.get(placeType) || 0;
      profile.categoryPreferences.set(placeType, currentScore + weight);
    });

    this.normalizeCategoryPreferences(profile);
  }

  private static updateTemporalPreferences(profile: any, newVisit: any) {
    const date = new Date(newVisit.timestamp);
    const hour = date.getHours();
    const day = date.getDay();

    // Incremental update with smoothing
    const smoothingFactor = 1.0 / (profile.totalVisits + 1);

    profile.temporalPreferences.hourOfDay[hour] += smoothingFactor;
    profile.temporalPreferences.dayOfWeek[day] += smoothingFactor;

    // Normalize
    const hourSum = profile.temporalPreferences.hourOfDay.reduce(
      (a: number, b: number) => a + b,
      0
    );
    const daySum = profile.temporalPreferences.dayOfWeek.reduce(
      (a: number, b: number) => a + b,
      0
    );

    if (hourSum > 0) {
      profile.temporalPreferences.hourOfDay =
        profile.temporalPreferences.hourOfDay.map((h: number) => h / hourSum);
    }
    if (daySum > 0) {
      profile.temporalPreferences.dayOfWeek =
        profile.temporalPreferences.dayOfWeek.map((d: number) => d / daySum);
    }
  }

  private static async updateLocationPreferences(profile: any, newVisit: any) {
    const newCoords = newVisit.location.coordinates;
    let addedToExistingArea = false;

    // Try to add to existing frequent area
    for (const area of profile.locationPreferences.frequentAreas) {
      const distance = this.calculateDistance(
        newCoords,
        area.center.coordinates
      );
      if (distance <= area.radius) {
        // Update area center (weighted average)
        const totalVisits = area.visitCount + 1;
        area.center.coordinates[0] =
          (area.center.coordinates[0] * area.visitCount + newCoords[0]) /
          totalVisits;
        area.center.coordinates[1] =
          (area.center.coordinates[1] * area.visitCount + newCoords[1]) /
          totalVisits;
        area.visitCount++;
        addedToExistingArea = true;
        break;
      }
    }

    // Create new frequent area if not added to existing one
    if (!addedToExistingArea) {
      profile.locationPreferences.frequentAreas.push({
        center: {
          type: "Point",
          coordinates: [newCoords[0], newCoords[1]],
        },
        visitCount: 1,
        radius: this.CLUSTER_RADIUS_THRESHOLD,
      });
    }
  }

  private static normalizeCategoryPreferences(profile: any) {
    const values = Array.from(profile.categoryPreferences.values()) as number[];
    const maxScore = Math.max(...values);
    if (maxScore > 0) {
      for (const [category, score] of profile.categoryPreferences.entries()) {
        profile.categoryPreferences.set(category, (score as number) / maxScore);
      }
    }
  }
}
