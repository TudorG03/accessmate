/**
 * Service for handling Google Places API interactions
 */
import Constants from "expo-constants";

// Get API key from environment variables
const GOOGLE_MAPS_API_KEY =
    Constants.expoConfig?.extra?.googleMapsPlacesApiKey || "";

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
}

/**
 * Search for places using Google Places Autocomplete API
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

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${
                encodeURIComponent(query)
            }&types=geocode&key=${GOOGLE_MAPS_API_KEY}`,
        );

        if (!response.ok) {
            throw new Error(`Places API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
            console.warn("Places API returned status:", data.status);
            return useMockPlacesData(query);
        }

        return data.predictions || [];
    } catch (error) {
        console.error("Error searching places:", error);
        // Fallback to mock data on error
        return useMockPlacesData(query);
    }
}

/**
 * Get details for a place by ID
 * @param placeId The Google Place ID
 * @returns Place details including location coordinates
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    try {
        if (!GOOGLE_MAPS_API_KEY) {
            console.warn("Google Maps API key is not configured");
            return useMockPlaceDetails(placeId);
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry&key=${GOOGLE_MAPS_API_KEY}`,
        );

        if (!response.ok) {
            throw new Error(`Places Details API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== "OK") {
            console.warn("Places Details API returned status:", data.status);
            return useMockPlaceDetails(placeId);
        }

        return data.result;
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

        const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;

        poly.push([lat * 1e-5, lng * 1e-5]);
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
        };
    }
}
