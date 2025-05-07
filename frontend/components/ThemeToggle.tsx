import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../stores/theme/useTheme';
import { ThemeMode } from '../stores/theme/theme.store';

export function ThemeToggle() {
  const { themeMode, setThemeMode, colors, isDark, classes, styles, refreshTheme } = useTheme();
  // Local state to force rerenders
  const [_, forceUpdate] = useState(0);

  // Debug log when theme changes
  useEffect(() => {
    console.log(`ThemeToggle rendered with theme: ${themeMode}, isDark: ${isDark}`);
  }, [themeMode, isDark]);

  const options: Array<{ value: ThemeMode; label: string; icon: string }> = [
    { value: 'light', label: 'Light', icon: 'sunny' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'system', label: 'System', icon: 'phone-portrait' },
  ];

  const handleThemeChange = (newTheme: ThemeMode) => {
    console.log(`Changing theme to: ${newTheme} (current: ${themeMode}, isDark: ${isDark})`);
    setThemeMode(newTheme);

    // Force a refresh after a short delay
    setTimeout(() => {
      console.log('Forcing component update');
      forceUpdate(prev => prev + 1);
      refreshTheme();
    }, 50);
  };

  return (
    <View className="px-4 py-4">
      <Text className="text-base font-bold text-lg mb-3" style={styles.text}>
        Appearance
      </Text>

      <View className="flex-row rounded-lg overflow-hidden border"
        style={{ borderColor: colors.border }}
      >
        {options.map((option) => {
          const isActive = themeMode === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => handleThemeChange(option.value)}
              className="flex-1 flex-row items-center justify-center py-3"
              style={{
                borderWidth: isActive ? 2 : 0,
                borderColor: colors.primary,
                backgroundColor: isActive
                  ? (isDark ? colors.card : colors.background)
                  : 'transparent'
              }}
            >
              <Ionicons
                name={option.icon as any}
                size={18}
                color={isActive ? colors.primary : colors.secondaryText}
                style={{ marginRight: 4 }}
              />
              <Text style={{ color: isActive ? colors.primary : colors.secondaryText }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
} 