import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../stores/theme/useTheme';
import { Ionicons } from '@expo/vector-icons';

export default function UnauthorizedScreen() {
  const { colors, isDark } = useTheme();
  
  const goBack = () => {
    router.back();
  };

  const goHome = () => {
    router.replace('/');
  };

  return (
    <SafeAreaView 
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <View className="flex-1 justify-center items-center p-6">
        <View 
          className="w-full max-w-md rounded-lg shadow-md p-6"
          style={{ 
            backgroundColor: colors.card,
            shadowColor: colors.shadow,
            shadowOpacity: 0.1,
            elevation: 2
          }}
        >
          <View className="items-center mb-4">
            <Ionicons 
              name="alert-circle" 
              size={60} 
              color={colors.error} 
            />
          </View>
          
          <Text 
            className="text-2xl font-bold mb-4 text-center"
            style={{ color: colors.error }}
          >
            Access Denied
          </Text>
          
          <Text 
            className="mb-6 text-center"
            style={{ color: colors.secondaryText }}
          >
            You don't have permission to access this page. Please contact an administrator if you believe this is an error.
          </Text>
          
          <View className="flex-row justify-center space-x-4">
            <TouchableOpacity 
              onPress={goBack}
              className="px-4 py-2 rounded-md"
              style={{ backgroundColor: isDark ? colors.card : colors.border }}
            >
              <Text 
                className="font-medium"
                style={{ color: colors.text }}
              >
                Go Back
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={goHome}
              className="px-4 py-2 rounded-md"
              style={{ backgroundColor: colors.button }}
            >
              <Text 
                className="font-medium"
                style={{ color: colors.buttonText }}
              >
                Go Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
} 