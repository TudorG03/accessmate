import { Platform } from "react-native";

export const getApiHost = () => {
    if (Platform.OS === "android") {
        return process.env.BACKEND_HOST_ANDROID || "https://accessmate-backend.deno.dev/";
    }
    return process.env.BACKEND_HOST_IOS || "https://accessmate-backend.deno.dev/";
};

export const getApiPort = () => process.env.BACKEND_PORT || "3000";
// export const API_URL = `${getApiHost()}${getApiPort()}`;
export const API_URL = `${getApiHost()}`;

// Log the API URL for debugging
console.log("🔗 API Configuration:", {
    platform: Platform.OS,
    host: getApiHost(),
    port: getApiPort(),
    fullUrl: API_URL,
});
