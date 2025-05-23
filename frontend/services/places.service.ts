/**
 * Service for handling Google Places API interactions
 */
import Constants from "expo-constants";
import { useLocationStore } from "../stores/location/location.store";

// Default location (can be set to a popular location in your target city)
const DEFAULT_LOCATION = {
    latitude: 40.7128, // New York City as example
    longitude: -74.0060,
};

// Get API key from environment variables
const GOOGLE_MAPS_API_KEY =
    Constants.expoConfig?.extra?.googleMapsPlacesApiKey || "";

// Base URL for Places API (new)
const PLACES_API_BASE_URL = "https://places.googleapis.com/v1";

// Types for place search results
export interface PlacePrediction {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
}

export interface PlaceDetails {
    place_id: string;
    name: string;
    formatted_address: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
    rating?: number;
    user_ratings_total?: number;
    opening_hours?: {
        open_now: boolean;
        weekday_text?: string[];
    };
    photos?: Array<{
        photo_reference: string;
        height: number;
        width: number;
        html_attributions: string[];
    }>;
    types?: string[];
    website?: string;
    formatted_phone_number?: string;
    price_level?: number;
}

/**
 * Search for places using Google Places API (new)
 * @param query The search query
 * @returns Array of place predictions
 */
export async function searchPlaces(query: string): Promise<PlacePrediction[]> {
    try {
        if (!query.trim()) {
            return [];
        }

        if (!GOOGLE_MAPS_API_KEY) {
            console.warn("Google Maps API key is not configured");
            return useMockPlacesData(query);
        }

        console.log(
            "Places API Key:",
            GOOGLE_MAPS_API_KEY.substring(0, 5) + "...",
        );

        // Build the request body according to the Places API (new) documentation
        const requestBody = {
            input: query, // Changed from textQuery to input as per the documentation
            languageCode: "en",
        };

        console.log("Places API Request:", JSON.stringify(requestBody));

        // Using the new Places API for text search
        const response = await fetch(
            `${PLACES_API_BASE_URL}/places:autocomplete`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                    "X-Goog-FieldMask":
                        "suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
                },
                body: JSON.stringify(requestBody),
            },
        );

        console.log("Places API Response Status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Places API Error Response:", errorText);
            throw new Error(`Places API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(
            "Places API Response Data:",
            JSON.stringify(data).substring(0, 200) + "...",
        );

        // Transform the new API format to match our existing interface
        if (data.suggestions && Array.isArray(data.suggestions)) {
            return data.suggestions
                .filter((suggestion: any) => suggestion.placePrediction) // Only process place predictions
                .map((suggestion: any) => {
                    const placePrediction = suggestion.placePrediction;
                    return {
                        place_id: placePrediction.placeId ||
                            placePrediction.place.split("/").pop(),
                        description: placePrediction.text?.text || "",
                        structured_formatting: {
                            main_text:
                                placePrediction.structuredFormat?.mainText
                                    ?.text || "",
                            secondary_text:
                                placePrediction.structuredFormat?.secondaryText
                                    ?.text || "",
                        },
                    };
                });
        }

        return [];
    } catch (error) {
        console.error("Error searching places:", error);
        // Fallback to mock data on error
        return useMockPlacesData(query);
    }
}

/**
 * Get details for a place by ID using Places API (new)
 * @param placeId The Google Place ID
 * @returns Place details including location coordinates
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    try {
        if (!GOOGLE_MAPS_API_KEY) {
            console.warn("Google Maps API key is not configured");
            return useMockPlaceDetails(placeId);
        }

        console.log(`Fetching details for place ID: ${placeId}`);

        // The new Places API (v1) requires a fully qualified place ID
        // If the place ID doesn't start with "places/", prefix it
        const fullPlaceId = placeId.startsWith("places/")
            ? placeId
            : `places/${placeId}`;

        // Using the new Places API for place details
        const response = await fetch(
            `${PLACES_API_BASE_URL}/${fullPlaceId}`,
            {
                method: "GET",
                headers: {
                    "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                    "X-Goog-FieldMask":
                        "id,displayName,formattedAddress,location,rating,userRatingCount,currentOpeningHours,photos,types,websiteUri,nationalPhoneNumber,priceLevel",
                },
            },
        );

        console.log("Place Details API Response Status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Place Details API Error Response:", errorText);
            throw new Error(`Places Details API error: ${response.status}`);
        }

        const placeData = await response.json();

        // Log photo data specifically to understand its structure
        if (placeData.photos && Array.isArray(placeData.photos)) {
            console.log(
                `Found ${placeData.photos.length} photos in place details`,
            );
            if (placeData.photos.length > 0) {
                console.log(
                    "First photo data:",
                    JSON.stringify(placeData.photos[0]).substring(0, 200),
                );
            }
        } else {
            console.log("No photos found in place details");
        }

        // Transform the new API format to match our existing interface
        const result: PlaceDetails = {
            place_id: placeData.id || placeId,
            name: placeData.displayName?.text || "",
            formatted_address: placeData.formattedAddress || "",
            geometry: {
                location: {
                    lat: placeData.location?.latitude || 0,
                    lng: placeData.location?.longitude || 0,
                },
            },
            rating: placeData.rating,
            user_ratings_total: placeData.userRatingCount,
            website: placeData.websiteUri,
            formatted_phone_number: placeData.nationalPhoneNumber,
            price_level: placeData.priceLevel,
            types: placeData.types,
        };

        // Handle opening hours if available
        if (placeData.currentOpeningHours) {
            result.opening_hours = {
                open_now: placeData.currentOpeningHours.openNow || false,
                weekday_text:
                    placeData.currentOpeningHours.weekdayDescriptions || [],
            };
        }

        // Handle photos if available
        if (placeData.photos && Array.isArray(placeData.photos)) {
            // Extract photo references from the photos array
            result.photos = placeData.photos.map((photo: any) => {
                // In the new Places API, the photo reference is the full name string
                // We need to check the structure to ensure we're using the right format
                if (typeof photo === "object") {
                    const photoRef = photo.name || "";
                    console.log(
                        `Extracted photo reference: ${
                            photoRef.substring(0, 30)
                        }...`,
                    );

                    return {
                        photo_reference: photoRef,
                        height: photo.heightPx || 0,
                        width: photo.widthPx || 0,
                        html_attributions:
                            photo.authorAttributions?.map((attr: any) =>
                                attr.uri
                            ) || [],
                    };
                } else {
                    console.warn(`Unexpected photo format: ${typeof photo}`);
                    return {
                        photo_reference: "",
                        height: 0,
                        width: 0,
                        html_attributions: [],
                    };
                }
            }).filter((photo: any) => photo.photo_reference); // Filter out any empty photo references

            console.log(
                `Extracted ${
                    result.photos?.length || 0
                } valid photo references`,
            );
        }

        return result;
    } catch (error) {
        console.error("Error getting place details:", error);
        // Fallback to mock data on error
        return useMockPlaceDetails(placeId);
    }
}

/**
 * Get directions between two locations
 * @param origin Starting location coordinates
 * @param destination Ending location coordinates
 * @param transportMode 'walking' | 'driving' (default: 'walking')
 * @returns Array of coordinate points for the route
 */
export async function getDirections(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    transportMode: "walking" | "driving" = "walking",
): Promise<
    {
        points: Array<{ latitude: number; longitude: number }>;
        distance: number;
        duration: string;
        steps: Array<{
            instructions: string;
            distance: string;
            duration: string;
            startLocation: { latitude: number; longitude: number };
            endLocation: { latitude: number; longitude: number };
        }>;
    }
> {
    // Use the Directions API key
    const DIRECTIONS_API_KEY =
        Constants.expoConfig?.extra?.googleMapsDirectionsApiKey || "";

    if (!DIRECTIONS_API_KEY) {
        throw new Error("Google Maps Directions API key is not configured");
    }

    console.log(`Getting directions with transport mode: ${transportMode}`);

    const apiUrl =
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=${transportMode}&key=${DIRECTIONS_API_KEY}`;
    console.log(
        `API URL (without key): ${
            apiUrl.replace(DIRECTIONS_API_KEY, "API_KEY")
        }`,
    );

    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error(`Directions API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK") {
        throw new Error(`Directions API returned status: ${data.status}`);
    }

    // Parse the route from the response
    const route = data.routes[0];
    const leg = route.legs[0];

    // Extract steps with instructions
    const steps = leg.steps.map((step: any) => ({
        instructions: step.html_instructions,
        distance: step.distance.text,
        duration: step.duration.text,
        startLocation: {
            latitude: step.start_location.lat,
            longitude: step.start_location.lng,
        },
        endLocation: {
            latitude: step.end_location.lat,
            longitude: step.end_location.lng,
        },
    }));

    // Decode the polyline to get route points
    const points = decodePolyline(route.overview_polyline.points).map(
        ([lat, lng]) => ({ latitude: lat, longitude: lng }),
    );

    // Extract distance in kilometers
    // Google Maps API returns distance in meters
    const distanceInKm = leg.distance.value / 1000;

    console.log(
        `Directions result: ${points.length} points, ${
            distanceInKm.toFixed(2)
        } km, mode=${transportMode}`,
    );

    return {
        points,
        distance: distanceInKm,
        duration: leg.duration.text,
        steps,
    };
}

// Helper function to decode Google's polyline format
function decodePolyline(encoded: string): Array<[number, number]> {
    const poly: Array<[number, number]> = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encoded.length) {
        let b, shift = 0, result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlat = (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlng = (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);
        lng += dlng;

        poly.push([lat / 1e5, lng / 1e5]);
    }

    return poly;
}

// Mock data functions for fallback
function useMockPlacesData(query: string): PlacePrediction[] {
    if (query.toLowerCase().includes("new")) {
        return [
            {
                place_id: "place_id_1",
                description: "New York, NY, USA",
                structured_formatting: {
                    main_text: "New York",
                    secondary_text: "NY, USA",
                },
            },
            {
                place_id: "place_id_2",
                description: "New Orleans, LA, USA",
                structured_formatting: {
                    main_text: "New Orleans",
                    secondary_text: "LA, USA",
                },
            },
        ];
    }
    return [];
}

function useMockPlaceDetails(placeId: string): PlaceDetails {
    if (placeId === "place_id_1") {
        return {
            place_id: "place_id_1",
            name: "New York",
            formatted_address: "New York, NY, USA",
            geometry: {
                location: {
                    lat: 40.7128,
                    lng: -74.0060,
                },
            },
            rating: 4.7,
            user_ratings_total: 15000,
            opening_hours: {
                open_now: true,
            },
            types: ["locality", "political"],
            formatted_phone_number: "+1 212-555-1234",
            website: "https://www.nyc.gov/",
        };
    } else {
        return {
            place_id: "place_id_2",
            name: "New Orleans",
            formatted_address: "New Orleans, LA, USA",
            geometry: {
                location: {
                    lat: 29.9511,
                    lng: -90.0715,
                },
            },
            rating: 4.5,
            user_ratings_total: 8500,
            opening_hours: {
                open_now: true,
            },
            types: ["locality", "political"],
            formatted_phone_number: "+1 504-555-5678",
            website: "https://www.neworleans.com/",
        };
    }
}

/**
 * Get a photo for a place using the Places API (new)
 * @param photoName The photo reference name from the Place API
 * @param maxWidth The maximum width of the photo (optional)
 * @param maxHeight The maximum height of the photo (optional)
 * @returns The URL for the photo
 */
export async function getPlacePhoto(
    photoName: string,
    maxWidth: number = 400,
    maxHeight: number = 300,
): Promise<string> {
    try {
        if (!GOOGLE_MAPS_API_KEY) {
            console.warn("Google Maps API key is not configured");
            return "";
        }

        // Check if the photo reference is valid
        if (
            !photoName || typeof photoName !== "string" || photoName.length < 5
        ) {
            console.warn(`Invalid photo reference: ${photoName}`);
            return "";
        }

        console.log(`Fetching photo with reference: ${photoName}`);

        // In the new Places API (v1), we have to handle both legacy and new style photo references

        // If this is a legacy style photo reference (doesn't contain '/'), we need to use the legacy API
        if (!photoName.includes("/")) {
            console.log("Using legacy Places API for photo");
            // Use the legacy API endpoint for old-style photo references
            const legacyUrl =
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoName}&key=${GOOGLE_MAPS_API_KEY}`;
            console.log(
                `Returning legacy URL: ${legacyUrl.substring(0, 70)}...`,
            );
            return legacyUrl;
        }

        console.log(
            `Using new Places API for photo: ${photoName.substring(0, 20)}...`,
        );

        // Direct URL with API key
        const directUrl =
            `${PLACES_API_BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&maxHeightPx=${maxHeight}&key=${GOOGLE_MAPS_API_KEY}`;

        console.log(`Returning direct URL: ${directUrl.substring(0, 70)}...`);
        return directUrl;
    } catch (error) {
        console.error("Error fetching place photo:", error);
        return "";
    }
}

/**
 * Interface for nearby places search parameters
 */
export interface NearbyPlacesParams {
    location: {
        latitude: number;
        longitude: number;
    };
    radius: number; // in kilometers
    types: string[];
    maxResults?: number;
}

/**
 * Interface for nearby place results
 */
export interface NearbyPlace {
    id: string;
    name: string;
    types: string[];
    address?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    distance?: number;
    photo?: string;
    rating?: number;
    userRatingsTotal?: number;
}

/**
 * Search for nearby places using Google Places API (new)
 * @param params The search parameters
 * @returns Array of nearby places
 */
export async function getNearbyPlaces(
    params: NearbyPlacesParams,
): Promise<NearbyPlace[]> {
    try {
        if (!GOOGLE_MAPS_API_KEY) {
            console.warn("Google Maps API key is not configured");
            return [];
        }

        const { location, radius, types, maxResults = 10 } = params;

        let effectiveLocation = location;

        // Check for invalid coordinates (0,0 or very close to it)
        if (
            Math.abs(location.latitude) < 0.000001 &&
            Math.abs(location.longitude) < 0.000001
        ) {
            console.warn(
                "Invalid coordinates detected (0,0). App should use location store's value.",
            );

            // Instead of using default location, we should retrieve the persisted location
            // Use the getLastKnownLocation method from the location store
            // Note: Components calling this method should first call ensureValidLocation
            // from useLocation() hook to ensure a valid location is available

            const { getLastKnownLocation } = useLocationStore.getState();
            effectiveLocation = getLastKnownLocation();

            console.log(
                "Using stored location for nearby search:",
                effectiveLocation,
            );
        }

        // Print full request parameters for debugging
        console.log(
            "Places API request params:",
            JSON.stringify({
                location: effectiveLocation,
                radius,
                types,
                maxResults,
            }),
        );

        // Build the request body according to the Places API (new) documentation
        const requestBody = {
            includedTypes: types.length > 0 ? types : ["restaurant"],
            locationRestriction: {
                circle: {
                    center: {
                        latitude: effectiveLocation.latitude,
                        longitude: effectiveLocation.longitude,
                    },
                    radius: radius * 1000, // Convert km to meters (API expects meters)
                },
            },
            maxResultCount: maxResults,
        };

        console.log(
            "Nearby Places API Request Body:",
            JSON.stringify(requestBody),
        );

        const response = await fetch(
            `${PLACES_API_BASE_URL}/places:searchNearby`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                    "X-Goog-FieldMask":
                        "places.name,places.displayName,places.formattedAddress,places.location,places.types,places.photos,places.rating,places.userRatingCount",
                },
                body: JSON.stringify(requestBody),
            },
        );

        console.log("Nearby Places API Response Status:", response.status);

        // Log headers for debugging
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value: string, key: string) => {
            responseHeaders[key] = value;
        });
        console.log("Response headers:", JSON.stringify(responseHeaders));

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Places API Error Response:", errorText);
            throw new Error(`Places API error: ${response.status}`);
        }

        // Try to parse the JSON response directly
        let data;
        try {
            data = await response.json();
            console.log(
                "Parsed response data:",
                JSON.stringify(data).substring(0, 500) + "...",
            );

            // Log the structure of the first place for debugging
            if (data.places && data.places.length > 0) {
                console.log(
                    "First place structure:",
                    JSON.stringify(data.places[0], null, 2),
                );
            }
        } catch (e) {
            console.error("Failed to parse response as JSON:", e);

            // Try to get the raw text as a fallback
            try {
                const responseText = await response.text();
                console.log(
                    "Raw response text:",
                    responseText.substring(0, 200) +
                        (responseText.length > 200 ? "..." : ""),
                );
                if (!responseText || responseText === "{}") {
                    console.warn("Empty response from Places API");
                    return getMockNearbyPlaces();
                }
            } catch (textError) {
                console.error("Failed to get response text:", textError);
            }

            return getMockNearbyPlaces();
        }

        // Transform the API response to match our interface
        if (data.places && Array.isArray(data.places)) {
            console.log(`Found ${data.places.length} places in response`);
            return data.places.map((place: any, index: number) => {
                // Log the entire place object for debugging
                console.log(`Place ${index}:`, JSON.stringify(place, null, 2));

                // Extract place ID from the resource name (format: "places/ChIJ...")
                let placeId = null;
                if (place.name && typeof place.name === "string") {
                    // The name field contains the resource name like "places/ChIJd8BlQ2BZwokRAFUEcm_qrcA"
                    // We need to extract just the place ID part after "places/"
                    if (place.name.startsWith("places/")) {
                        placeId = place.name.replace("places/", "");
                    } else {
                        placeId = place.name;
                    }
                }

                // If we still don't have a valid place ID, generate a fallback
                if (!placeId || placeId.length < 10) {
                    console.warn(
                        `Invalid place ID for ${place.displayName?.text}:`,
                        placeId,
                    );
                    placeId = `anonymous_place_${
                        Math.random().toString(36).substring(2, 11)
                    }`;
                }

                console.log(
                    `Extracted place ID: ${placeId} for place: ${place.displayName?.text}`,
                );

                // For debugging photos
                if (place.photos) {
                    console.log(
                        `Place ${place.displayName?.text} has ${place.photos.length} photos`,
                    );
                    if (place.photos.length > 0) {
                        console.log(
                            `First photo data:`,
                            JSON.stringify(place.photos[0]).substring(0, 100),
                        );
                    }
                } else {
                    console.log(
                        `Place ${place.displayName?.text} has no photos`,
                    );
                }

                return {
                    id: placeId,
                    name: place.displayName?.text || "Unknown Place",
                    types: place.types || [],
                    address: place.formattedAddress,
                    location: place.location
                        ? {
                            latitude: place.location.latitude,
                            longitude: place.location.longitude,
                        }
                        : undefined,
                    photo: place.photos &&
                            Array.isArray(place.photos) &&
                            place.photos.length > 0 &&
                            place.photos[0].name
                        ? place.photos[0].name
                        : undefined,
                    rating: place.rating,
                    userRatingsTotal: place.userRatingCount,
                };
            });
        } else {
            console.warn("No places found in API response");
            // If we don't have a valid response, return mock data for testing
            return getMockNearbyPlaces();
        }
    } catch (error) {
        console.error("Error fetching nearby places:", error);
        // Return mock data on error
        return getMockNearbyPlaces();
    }
}

// Function to get mock nearby places data for testing
function getMockNearbyPlaces(): NearbyPlace[] {
    return [
        {
            id: "mock1",
            name: "Accessible Restaurant 1",
            types: ["restaurant", "wheelchair_accessible_entrance"],
            address: "123 Main St",
            location: { latitude: 40.7128, longitude: -74.0060 },
            distance: 1.2,
            rating: 4.5,
            userRatingsTotal: 120,
        },
        {
            id: "mock2",
            name: "Accessible Cafe 2",
            types: [
                "cafe",
                "wheelchair_accessible_entrance",
                "wheelchair_accessible_restroom",
            ],
            address: "456 Park Ave",
            location: { latitude: 40.7115, longitude: -74.0070 },
            distance: 1.5,
            rating: 4.2,
            userRatingsTotal: 85,
        },
        {
            id: "mock3",
            name: "Accessible Museum",
            types: [
                "museum",
                "wheelchair_accessible_entrance",
                "wheelchair_accessible_parking",
            ],
            address: "789 Broadway",
            location: { latitude: 40.7140, longitude: -74.0080 },
            distance: 1.8,
            rating: 4.7,
            userRatingsTotal: 210,
        },
        {
            id: "mock4",
            name: "Accessible Park",
            types: [
                "park",
                "wheelchair_accessible_entrance",
                "wheelchair_accessible_parking",
            ],
            address: "321 River Dr",
            location: { latitude: 40.7150, longitude: -74.0090 },
            distance: 2.1,
            rating: 4.8,
            userRatingsTotal: 300,
        },
    ];
}
