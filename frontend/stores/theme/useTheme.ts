import { useEffect, useMemo, useState } from "react";
import { Appearance, Platform, StyleSheet } from "react-native";
import { ThemeMode, useThemeStore } from "./theme.store";

export type ColorTheme = {
    background: string;
    card: string;
    surface: string;
    text: string;
    secondaryText: string;
    border: string;
    input: string;
    inputText: string;

    primary: string; // Main brand color (amber/gold)
    secondary: string; // Secondary color (mint green)
    accent: string; // Accent color
    button: string; // Button background (context dependent)
    buttonText: string; // Button text color

    success: string;
    warning: string;
    error: string;
    info: string;

    tabBarBackground: string;
    tabBarInactive: string;
    tabBarActive: string;
    divider: string;
    shadow: string;

    themeSwitchIcon: string;
    link: string;
};

const lightColors: ColorTheme = {
    background: "#FFFFFF",
    card: "#F5F7FA",
    surface: "#FFFFFF",
    text: "#000000",
    secondaryText: "#666666",
    border: "#E0E0E0",
    input: "#FFFFFF",
    inputText: "#000000",

    primary: "#F1B24A", // Amber/gold color from the design
    secondary: "#7ED8C3", // Mint green color
    accent: "#C08417", // Darker amber
    button: "#F1B24A", // Amber button color
    buttonText: "#FFFFFF", // White text on buttons

    success: "#4CAF50",
    warning: "#FF9800",
    error: "#F44336",
    info: "#2196F3",

    tabBarBackground: "#FFFFFF",
    tabBarInactive: "#AAAAAA",
    tabBarActive: "#F1B24A",
    divider: "#E0E0E0",
    shadow: "#000000",

    themeSwitchIcon: "#000000", // Moon icon in the picture
    link: "#C08417", // Link colors (Already have an account)
};

const darkColors: ColorTheme = {
    background: "#232438", // Dark navy blue from the design
    card: "#2D2F45", // Slightly lighter navy for cards
    surface: "#2D2F45", // Surface elements in dark mode
    text: "#FFFFFF", // White text
    secondaryText: "#BBBBBB", // Lighter gray for secondary text
    border: "#3D3F50", // Subtle border color
    input: "#3D4059", // Input background from the design
    inputText: "#FFFFFF", // Input text color

    primary: "#F1B24A", // Same amber/gold as light theme for consistency
    secondary: "#7ED8C3", // Same mint green color as light theme
    accent: "#C08417", // Darker amber
    button: "#F1B24A", // Amber button in dark mode
    buttonText: "#232438", // Dark text on amber buttons

    success: "#4CAF50",
    warning: "#FF9800",
    error: "#F44336",
    info: "#2196F3",

    tabBarBackground: "#232438",
    tabBarInactive: "#AAAAAA",
    tabBarActive: "#F1B24A",
    divider: "#3D3F50",
    shadow: "#000000",

    themeSwitchIcon: "#FFFFFF", // Sun icon in the picture
    link: "#F1B24A", // Link colors in dark mode
};

export function useTheme() {
    const [, setForceUpdate] = useState(0);

    const {
        themeMode,
        setThemeMode,
        setSystemTheme,
        currentTheme,
        isDark,
        themeClasses,
        refreshTheme,
        _forceUpdateCounter,
    } = useThemeStore();

    const isActuallyDark = useMemo(() => {
        const actualTheme = themeMode === "system"
            ? Appearance.getColorScheme() === "dark" ? "dark" : "light"
            : themeMode;
        const result = actualTheme === "dark";
        console.log(
            `useTheme - Computing isDark: ${result} (mode: ${themeMode})`,
        );
        return result;
    }, [themeMode, _forceUpdateCounter]);

    const actualThemeClasses = useMemo(() => {
        const classes = {
            background: isActuallyDark
                ? "bg-dark-background"
                : "bg-light-background",
            text: isActuallyDark ? "text-dark-text" : "text-light-text",
            secondaryText: isActuallyDark
                ? "text-dark-secondaryText"
                : "text-light-secondaryText",
            card: isActuallyDark ? "bg-dark-card" : "bg-light-card",
            input: isActuallyDark
                ? "bg-dark-input border-dark-border"
                : "bg-light-input border-light-border",
            button: "bg-primary",
            buttonText: "text-white",
        };
        console.log(
            `useTheme - Theme classes computed with isDark: ${isActuallyDark}`,
        );
        return classes;
    }, [isActuallyDark, _forceUpdateCounter]);

    const actualColors = isActuallyDark ? darkColors : lightColors;

    const styles = useMemo(() => {
        return StyleSheet.create({
            background: {
                backgroundColor: actualColors.background,
            },
            text: {
                color: actualColors.text,
            },
            secondaryText: {
                color: actualColors.secondaryText,
            },
            card: {
                backgroundColor: actualColors.card,
            },
            input: {
                backgroundColor: actualColors.input,
                borderColor: actualColors.border,
            },
            button: {
                backgroundColor: actualColors.primary,
            },
            buttonText: {
                color: actualColors.buttonText,
            },
        });
    }, [actualColors]);

    useEffect(() => {
        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            console.log(`System theme changed to: ${colorScheme}`);
            setSystemTheme(colorScheme);
            setForceUpdate((prev) => prev + 1);
        });

        return () => subscription.remove();
    }, [setSystemTheme]);

    useEffect(() => {
        const updateTheme = async () => {
            console.log(
                `Theme changed to: ${currentTheme} (isActuallyDark: ${isActuallyDark})`,
            );
            setForceUpdate((prev) => prev + 1);

            if (Platform.OS === "web") {
                document.documentElement.classList.toggle(
                    "dark",
                    isActuallyDark,
                );
            }
        };

        updateTheme();
    }, [themeMode, _forceUpdateCounter, isActuallyDark]);

    const setThemeWithUpdate = (mode: ThemeMode) => {
        console.log(`Setting theme mode in hook: ${mode}`);
        setThemeMode(mode);
        setForceUpdate((prev) => prev + 1);
    };

    return {
        themeMode,
        isDark: isActuallyDark, // Use the computed value
        currentTheme: isActuallyDark ? "dark" : "light", // Use the computed value

        classes: actualThemeClasses, // Use the computed values

        styles,

        colors: actualColors, // Use the computed value

        setThemeMode: setThemeWithUpdate,
        refreshTheme,

        colorScheme: isActuallyDark ? "dark" : "light", // Use the computed value
    };
}
