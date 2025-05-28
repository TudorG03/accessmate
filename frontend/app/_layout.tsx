import "../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "../components/AuthProvider";
import { ThemeProvider } from "../components/ThemeProvider";
import { LocationProvider } from "../components/LocationProvider";
import { ObstacleValidationProvider } from "../contexts/ObstacleValidationContext";
import ObstacleValidationWrapper from "../components/notifications/ObstacleValidationWrapper";

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ObstacleValidationProvider>
          <LocationProvider>
            <Stack screenOptions={{ headerShown: false }} />
            <ObstacleValidationWrapper />
          </LocationProvider>
        </ObstacleValidationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}