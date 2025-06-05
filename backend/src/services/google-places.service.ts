import { load } from "https://deno.land/std/dotenv/mod.ts";

// Load environment variables
await load({ export: true });

export interface GooglePlaceBasic {
  placeId: string;
  name: string;
  types: string[];
  location: {
    latitude: number;
    longitude: number;
  };
  vicinity?: string;
  rating?: number;
  priceLevel?: number;
  userRatingsTotal?: number;
  businessStatus?: string;
}

export interface GooglePlaceDetailed extends GooglePlaceBasic {
  formattedAddress: string;
  phoneNumber?: string;
  website?: string;
  openingHours?: {
    openNow: boolean;
    periods: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
    weekdayText: string[];
  };
  photos?: Array<{
    photoReference: string;
    height: number;
    width: number;
  }>;
  reviews?: Array<{
    authorName: string;
    rating: number;
    text: string;
    time: number;
  }>;
  geometry: {
    location: { lat: number; lng: number };
    viewport: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
}

export interface NearbySearchParams {
  location: { latitude: number; longitude: number };
  radius: number; // in meters
  types?: string[];
  minPrice?: number; // 0-4
  maxPrice?: number; // 0-4
  openNow?: boolean;
  maxResults?: number;
}

export interface TextSearchParams {
  query: string;
  location?: { latitude: number; longitude: number };
  radius?: number; // in meters
  types?: string[];
  maxResults?: number;
}

export class GooglePlacesService {
  private static readonly API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
  private static readonly BASE_URL = "https://places.googleapis.com/v1";
  private static readonly LEGACY_BASE_URL = "https://maps.googleapis.com/maps/api/place";
  private static readonly DEFAULT_MAX_RESULTS = 20;
  private static readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  
  // Rate limiting
  private static requestCount = 0;
  private static lastResetTime = Date.now();
  private static readonly MAX_REQUESTS_PER_MINUTE = 100;

  /**
   * Search for nearby places using the new Places API
   */
  static async searchNearby(params: NearbySearchParams): Promise<GooglePlaceBasic[]> {
    try {
      if (!this.API_KEY) {
        throw new Error("Google Maps API key not configured");
      }

      await this.checkRateLimit();

      const {
        location,
        radius,
        types = [],
        minPrice,
        maxPrice,
        openNow,
        maxResults = this.DEFAULT_MAX_RESULTS
      } = params;

      const requestBody: any = {
        includedTypes: types.length > 0 ? types : [
          "restaurant",
          "tourist_attraction", 
          "shopping_mall",
          "lodging",
          "gas_station",
          "bank",
          "hospital",
          "pharmacy",
          "grocery_store",
          "park"
        ],
        locationRestriction: {
          circle: {
            center: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
            radius: Math.min(radius, 50000), // Max 50km radius
          },
        },
        maxResultCount: Math.min(maxResults, 20),
        rankPreference: "POPULARITY",
        languageCode: "en",
      };

      // Add price level filter if specified
      if (minPrice !== undefined || maxPrice !== undefined) {
        requestBody.priceLevel = {
          minLevel: minPrice || 0,
          maxLevel: maxPrice || 4,
        };
      }

      // Add open now filter if specified
      if (openNow !== undefined) {
        requestBody.includedPrimaryTypes = types;
        requestBody.openNow = openNow;
      }

      console.log("Google Places Nearby Search:", JSON.stringify(requestBody, null, 2));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(`${this.BASE_URL}/places:searchNearby`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.types,places.location,places.shortFormattedAddress,places.rating,places.priceLevel,places.userRatingCount,places.businessStatus",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Places API Error:", response.status, errorText);
        throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.places || !Array.isArray(data.places)) {
        console.warn("No places found in Google Places API response");
        return [];
      }

      return data.places.map((place: any) => this.transformToBasicPlace(place));

    } catch (error) {
      console.error("Error in searchNearby:", error);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Google Places API request timed out");
      }
      throw error;
    }
  }

  /**
   * Search for places using text query
   */
  static async searchByText(params: TextSearchParams): Promise<GooglePlaceBasic[]> {
    try {
      if (!this.API_KEY) {
        throw new Error("Google Maps API key not configured");
      }

      await this.checkRateLimit();

      const {
        query,
        location,
        radius,
        types = [],
        maxResults = this.DEFAULT_MAX_RESULTS
      } = params;

      const requestBody: any = {
        textQuery: query,
        maxResultCount: Math.min(maxResults, 20),
        languageCode: "en",
      };

      // Add location bias if provided
      if (location && radius) {
        requestBody.locationBias = {
          circle: {
            center: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
            radius: Math.min(radius, 50000),
          },
        };
      }

      // Add type filter if specified
      if (types.length > 0) {
        requestBody.includedType = types[0]; // New API only supports one type per request
      }

      console.log("Google Places Text Search:", JSON.stringify(requestBody, null, 2));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(`${this.BASE_URL}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.types,places.location,places.shortFormattedAddress,places.rating,places.priceLevel,places.userRatingCount,places.businessStatus",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Places API Error:", response.status, errorText);
        throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.places || !Array.isArray(data.places)) {
        console.warn("No places found in Google Places API response");
        return [];
      }

      return data.places.map((place: any) => this.transformToBasicPlace(place));

    } catch (error) {
      console.error("Error in searchByText:", error);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Google Places API request timed out");
      }
      throw error;
    }
  }

  /**
   * Get detailed information about a specific place
   */
  static async getPlaceDetails(placeId: string): Promise<GooglePlaceDetailed | null> {
    try {
      if (!this.API_KEY) {
        throw new Error("Google Maps API key not configured");
      }

      await this.checkRateLimit();

      const fullPlaceId = placeId.startsWith("places/") ? placeId : `places/${placeId}`;

      console.log(`Fetching place details for: ${fullPlaceId}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(`${this.BASE_URL}/${fullPlaceId}`, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": this.API_KEY,
          "X-Goog-FieldMask": "id,displayName,types,location,formattedAddress,rating,priceLevel,userRatingCount,businessStatus,currentOpeningHours,photos,reviews,website,nationalPhoneNumber,geometry",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Place not found: ${placeId}`);
          return null;
        }
        const errorText = await response.text();
        console.error("Google Places API Error:", response.status, errorText);
        throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
      }

      const place = await response.json();
      return this.transformToDetailedPlace(place);

    } catch (error) {
      console.error("Error in getPlaceDetails:", error);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Google Places API request timed out");
      }
      throw error;
    }
  }

  /**
   * Get multiple places with additional filtering for recommendations
   */
  static async getRecommendationCandidates(params: NearbySearchParams): Promise<GooglePlaceBasic[]> {
    try {
      // Enhanced search with multiple type categories for better diversity
      const searchPromises = [];

      if (params.types && params.types.length > 0) {
        // Search with user's preferred types
        searchPromises.push(this.searchNearby(params));
      } else {
        // Search popular categories if no types specified
        const popularTypes = [
          ["restaurant", "cafe", "meal_takeaway"],
          ["tourist_attraction", "museum", "park"],
          ["shopping_mall", "grocery_store", "store"],
          ["gym", "spa", "beauty_salon"]
        ];

        for (const typeGroup of popularTypes) {
          searchPromises.push(this.searchNearby({
            ...params,
            types: typeGroup,
            maxResults: Math.ceil(params.maxResults || this.DEFAULT_MAX_RESULTS / popularTypes.length)
          }));
        }
      }

      const results = await Promise.allSettled(searchPromises);
      const allPlaces: GooglePlaceBasic[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          allPlaces.push(...result.value);
        } else {
          console.warn(`Search ${index} failed:`, result.reason);
        }
      });

      // Remove duplicates and sort by rating
      const uniquePlaces = this.removeDuplicatePlaces(allPlaces);
      return this.sortPlacesByQuality(uniquePlaces).slice(0, params.maxResults || this.DEFAULT_MAX_RESULTS);

    } catch (error) {
      console.error("Error in getRecommendationCandidates:", error);
      throw error;
    }
  }

  /**
   * Get place photos
   */
  static async getPlacePhotoUrl(photoReference: string, maxWidth = 400, maxHeight = 300): Promise<string> {
    try {
      if (!this.API_KEY) {
        throw new Error("Google Maps API key not configured");
      }

      // Handle both new and legacy photo references
      if (!photoReference.includes("/")) {
        // Legacy photo reference - use legacy API
        return `${this.LEGACY_BASE_URL}/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${this.API_KEY}`;
      }

      // New API photo reference
      return `${this.BASE_URL}/${photoReference}/media?maxWidthPx=${maxWidth}&maxHeightPx=${maxHeight}&key=${this.API_KEY}`;

    } catch (error) {
      console.error("Error generating photo URL:", error);
      return "";
    }
  }

  // Private helper methods

  private static convertPriceLevel(priceLevel: any): number | undefined {
    if (priceLevel === undefined || priceLevel === null) {
      return undefined;
    }
    
    // If it's already a number, return it
    if (typeof priceLevel === 'number') {
      return priceLevel;
    }
    
    // Convert string price levels from new API to numbers
    const priceLevelMap: { [key: string]: number } = {
      'PRICE_LEVEL_FREE': 0,
      'PRICE_LEVEL_INEXPENSIVE': 1,
      'PRICE_LEVEL_MODERATE': 2,
      'PRICE_LEVEL_EXPENSIVE': 3,
      'PRICE_LEVEL_VERY_EXPENSIVE': 4,
    };
    
    return priceLevelMap[priceLevel] ?? undefined;
  }

  private static async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinute = 60 * 1000;

    if (now - this.lastResetTime > oneMinute) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = oneMinute - (now - this.lastResetTime);
      console.warn(`Rate limit reached. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }

    this.requestCount++;
  }

  private static transformToBasicPlace(place: any): GooglePlaceBasic {
    // Extract place ID from resource name
    let placeId = place.id || "";
    if (place.name && place.name.startsWith("places/")) {
      placeId = place.name.replace("places/", "");
    }

    return {
      placeId,
      name: place.displayName?.text || "Unknown Place",
      types: place.types || [],
      location: {
        latitude: place.location?.latitude || 0,
        longitude: place.location?.longitude || 0,
      },
      vicinity: place.shortFormattedAddress,
      rating: place.rating,
      priceLevel: this.convertPriceLevel(place.priceLevel),
      userRatingsTotal: place.userRatingCount,
      businessStatus: place.businessStatus,
    };
  }

  private static transformToDetailedPlace(place: any): GooglePlaceDetailed {
    const basicPlace = this.transformToBasicPlace(place);

    return {
      ...basicPlace,
      formattedAddress: place.formattedAddress || "",
      phoneNumber: place.nationalPhoneNumber,
      website: place.websiteUri,
      openingHours: place.currentOpeningHours ? {
        openNow: place.currentOpeningHours.openNow || false,
        periods: place.currentOpeningHours.periods || [],
        weekdayText: place.currentOpeningHours.weekdayDescriptions || [],
      } : undefined,
      photos: place.photos?.map((photo: any) => ({
        photoReference: photo.name || "",
        height: photo.heightPx || 0,
        width: photo.widthPx || 0,
      })) || [],
      reviews: place.reviews?.map((review: any) => ({
        authorName: review.authorAttribution?.displayName || "Anonymous",
        rating: review.rating || 0,
        text: review.text?.text || "",
        time: new Date(review.publishTime).getTime() || Date.now(),
      })) || [],
      geometry: {
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
        },
        viewport: place.viewport || {
          northeast: { lat: 0, lng: 0 },
          southwest: { lat: 0, lng: 0 },
        },
      },
    };
  }

  private static removeDuplicatePlaces(places: GooglePlaceBasic[]): GooglePlaceBasic[] {
    const seen = new Set<string>();
    return places.filter(place => {
      const key = `${place.placeId}_${place.name}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private static sortPlacesByQuality(places: GooglePlaceBasic[]): GooglePlaceBasic[] {
    return places.sort((a, b) => {
      // Primary sort by rating (higher is better)
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (Math.abs(ratingDiff) > 0.1) {
        return ratingDiff;
      }

      // Secondary sort by number of ratings (more is better)
      const ratingCountDiff = (b.userRatingsTotal || 0) - (a.userRatingsTotal || 0);
      if (Math.abs(ratingCountDiff) > 10) {
        return ratingCountDiff;
      }

      return 0;
    });
  }

  /**
   * Validate if API key is configured and working
   */
  static async validateApiKey(): Promise<boolean> {
    try {
      if (!this.API_KEY) {
        return false;
      }

      // Test with a simple request
      const response = await fetch(`${this.BASE_URL}/places:searchNearby`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.API_KEY,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({
          includedTypes: ["restaurant"],
          locationRestriction: {
            circle: {
              center: { latitude: 40.7128, longitude: -74.0060 },
              radius: 1000,
            },
          },
          maxResultCount: 1,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error("API key validation failed:", error);
      return false;
    }
  }

  /**
   * Get current API usage statistics
   */
  static getUsageStats() {
    const now = Date.now();
    const timeUntilReset = 60000 - (now - this.lastResetTime);
    
    return {
      requestCount: this.requestCount,
      maxRequests: this.MAX_REQUESTS_PER_MINUTE,
      timeUntilReset,
      rateLimitReached: this.requestCount >= this.MAX_REQUESTS_PER_MINUTE,
    };
  }
} 