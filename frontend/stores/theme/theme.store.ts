import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";
import { Appearance, ColorSchemeName } from "react-native";

const storage = new MMKV();

const mmkvStorage = {
    setItem: (name: string, value: string) => {
        return storage.set(name, value);
    },
    getItem: (name: string) => {
        const value = storage.getString(name);
        return value ?? null;
    },
    removeItem: (name: string) => {
        return storage.delete(name);
    },
};

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
    themeMode: ThemeMode;
    systemTheme: ColorSchemeName;
    _forceUpdateCounter: number;

    get currentTheme(): "light" | "dark";

    get isDark(): boolean;
    get themeClasses(): {
        background: string;
        text: string;
        secondaryText: string;
        card: string;
        input: string;
        button: string;
        buttonText: string;
    };

    setThemeMode: (mode: ThemeMode) => void;
    setSystemTheme: (theme: ColorSchemeName) => void;

    refreshTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            themeMode: "system",
            systemTheme: Appearance.getColorScheme() || "light",
            _forceUpdateCounter: 0,

            get currentTheme(): "light" | "dark" {
                const { themeMode, systemTheme, _forceUpdateCounter } = get();
                if (themeMode === "system") {
                    return systemTheme === "dark" ? "dark" : "light";
                }
                return themeMode;
            },

            get isDark(): boolean {
                const { themeMode, systemTheme } = get();
                let actualTheme = themeMode;
                if (themeMode === "system") {
                    actualTheme = systemTheme === "dark" ? "dark" : "light";
                }

                const result = actualTheme === "dark";
                return result;
            },

            get themeClasses(): {
                background: string;
                text: string;
                secondaryText: string;
                card: string;
                input: string;
                button: string;
                buttonText: string;
            } {
                const isDark = get().isDark;

                return {
                    background: isDark
                        ? "bg-dark-background"
                        : "bg-light-background",
                    text: isDark ? "text-dark-text" : "text-light-text",
                    secondaryText: isDark
                        ? "text-dark-secondaryText"
                        : "text-light-secondaryText",
                    card: isDark ? "bg-dark-card" : "bg-light-card",
                    input: isDark
                        ? "bg-dark-input border-dark-border"
                        : "bg-light-input border-light-border",
                    button: "bg-primary",
                    buttonText: "text-white",
                };
            },

            setThemeMode: (mode: ThemeMode) => {
                set({
                    themeMode: mode,
                    _forceUpdateCounter: get()._forceUpdateCounter + 1,
                });

                setTimeout(() => {
                    const state = get();
                }, 0);
            },

            setSystemTheme: (theme: ColorSchemeName) => {
                set({
                    systemTheme: theme,
                    _forceUpdateCounter: get()._forceUpdateCounter + 1,
                });

                setTimeout(() => {
                    const state = get();
                }, 0);
            },

            refreshTheme: () => {
                set({ _forceUpdateCounter: get()._forceUpdateCounter + 1 });
            },
        }),
        {
            name: "theme-storage",
            storage: createJSONStorage(() => mmkvStorage),
            partialize: (state) => ({
                themeMode: state.themeMode,
                systemTheme: state.systemTheme,
            }),
        },
    ),
);
