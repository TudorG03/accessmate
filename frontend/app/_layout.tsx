import "../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "../components/AuthProvider";
import { ThemeProvider } from "../components/ThemeProvider";
import { LocationProvider } from "../components/LocationProvider";

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocationProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </LocationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}