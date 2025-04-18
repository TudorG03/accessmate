import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../stores/theme/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';

export default function ThemeTestScreen() {
  const { classes, currentTheme, colors } = useTheme();
  
  return (
    <SafeAreaView className={`flex-1 ${classes.background}`}>
      <ScrollView className="flex-1">
        <View className="p-6">
          <Text className={`text-3xl font-bold mb-6 ${classes.text}`}>
            Theme Settings
          </Text>
          
          <View className={`rounded-lg mb-6 p-4 ${classes.card}`}>
            <Text className={`${classes.text}`}>
              Current theme: {currentTheme}
            </Text>
          </View>
          
          <ThemeToggle />
          
          {/* Test components with various styles */}
          <View className="mt-8 space-y-6">
            <Text className={`text-xl font-semibold mb-2 ${classes.text}`}>
              Component Examples
            </Text>
            
            <View className={`p-4 rounded-lg ${classes.card}`}>
              <Text className={`text-lg font-bold ${classes.text}`}>Card Component</Text>
              <Text className={`mt-2 ${classes.secondaryText}`}>This is sample text in a card</Text>
            </View>
            
            <View className={`p-4 rounded-lg ${classes.input}`}>
              <Text className={`${classes.text}`}>Input Component</Text>
            </View>
            
            <View className={`p-4 rounded-lg ${classes.button}`}>
              <Text className={`text-center ${classes.buttonText}`}>Button Component</Text>
            </View>
            
            <View className="mt-4">
              <Text className={`text-lg font-bold mb-2 ${classes.text}`}>Color Palette</Text>
              
              <View className="flex-row flex-wrap">
                {Object.entries(colors).slice(0, 10).map(([name, color]) => (
                  <View key={name} className="w-1/2 p-2">
                    <View 
                      style={{ backgroundColor: color }} 
                      className="h-12 rounded-md mb-1"
                    />
                    <Text className={`text-xs ${classes.secondaryText}`}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 