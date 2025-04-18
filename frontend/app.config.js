import 'dotenv/config';

export default {
  name: "AccessMate",
  slug: "accessmate",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/logo-icon-black.png",
  userInterfaceStyle: "light",
  scheme: "accessmate",
  splash: {
    image: "./assets/images/logo-icon-black.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.csie.accessmate",
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "AccessMate needs your location to show accessible routes near you",
      NSLocationAlwaysAndWhenInUseUsageDescription: "AccessMate needs your location to show accessible routes near you",
      UIBackgroundModes: ["location", "fetch"]
    },
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/logo-icon-black.png",
      backgroundColor: "#FFFFFF"
    },
    package: "com.csie.accessmate",
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION"
    ],
    config: {
      googleMaps: {
        apiKey: "AIzaSyBG96VAS_AAWczreNLUU8xD9htO51O8zU8"
      }
    }
  },
  web: {
    favicon: "./assets/images/logo-icon-white.png"
  },
  extra: {
    // API configuration
    apiPort: process.env.BACKEND_PORT || '3000',
    // For development on a physical device, you'll need to replace this with your computer's IP address
    apiHost: process.env.API_HOST || 'localhost',
    // Set this to false in production
    enableDebugTools: true,
    // Google Maps API Keys
    googleMapsDirectionsApiKey: process.env.GOOGLE_MAPS_DIRECTIONS_API_KEY,
    googleMapsPlacesApiKey: process.env.GOOGLE_MAPS_PLACES_API_KEY
  }
}; 