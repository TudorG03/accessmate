import React, { ReactNode } from 'react';
import { StatusBar } from 'react-native';
import { useTheme } from '../stores/theme/useTheme';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { isDark, colors } = useTheme();
  
  return (
    <>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.background} 
      />
      {children}
    </>
  );
} 