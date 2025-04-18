
import { Platform } from "react-native";

export const getApiHost = () => {
    if (Platform.OS === "android") {
        return process.env.BACKEND_HOST_ANDROID || "http://10.0.2.2:";
    }
    return process.env.BACKEND_HOST_IOS || "http://localhost:";
};

export const getApiPort = () => process.env.BACKEND_PORT || "3000";
export const API_URL = `${getApiHost()}${getApiPort()}`;