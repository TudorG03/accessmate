import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PlacesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-2xl font-bold mb-4 text-center">Accessible Places</Text>
        <Text className="text-gray-600 text-center">
          List of wheelchair accessible venues and locations will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
} 