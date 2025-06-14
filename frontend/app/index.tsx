import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useRef } from "react";
import { Video, ResizeMode } from "expo-av";

export default function LandingPage() {
    const videoRef = useRef<Video>(null);

    useFocusEffect(
        useCallback(() => {
            const playVideo = async () => {
                if (videoRef.current) {
                    try {
                        // Reset the video to the beginning and play
                        await videoRef.current.stopAsync();
                        await videoRef.current.setPositionAsync(0);
                        await videoRef.current.playAsync();
                    } catch (error) {
                        console.log('Error playing video:', error);
                    }
                }
            };

            playVideo();

            // Cleanup function that runs when the screen goes out of focus
            return () => {
                // Optional: pause video when leaving screen to save resources
                if (videoRef.current) {
                    videoRef.current.pauseAsync().catch(err => console.log('Error pausing video:', err));
                }
            };
        }, [])
    );

    const navigateToLogin = () => {
        router.push('/login');
    };

    const navigateToRegister = () => {
        router.push('/register');
    };

    return (
        <View className="flex-1">
            {/* Background Video */}
            <Video
                ref={videoRef}
                source={require("../assets/videos/accessmate-landing-page.mp4")}
                style={StyleSheet.absoluteFillObject}
                resizeMode={ResizeMode.COVER}
                isLooping
                shouldPlay
                isMuted
            />

            {/* Content Overlay */}
            <SafeAreaView
                className="flex-1 bg-black/50"
            >
                <View className="flex-1 justify-between p-6">
                    {/* Top section with logo and tagline */}
                    <View className="flex flex-1 justify-center items-center">
                        <Image
                            source={require("../assets/images/accessmate-high-resolution-logo-white-transparent.png")}
                            className="w-4/5 h-24 mb-4"
                            resizeMode="contain"
                        />
                        <Text className="text-2xl font-bold text-center text-primary">
                            Navigate the world with confidence
                        </Text>
                    </View>

                    {/* Bottom section with buttons */}
                    <View className="flex flex-col space-y-4 mb-5">
                        <Pressable
                            className="py-4 rounded-lg bg-primary shadow-md mb-5"
                            onPress={navigateToLogin}
                        >
                            <Text className="text-center text-lg font-semibold text-white">
                                Log In
                            </Text>
                        </Pressable>

                        <Pressable
                            className="py-4 rounded-lg border-2 border-gray-300 bg-white/90 shadow"
                            onPress={navigateToRegister}
                        >
                            <Text className="text-center text-lg font-semibold text-gray-800">
                                Create Account
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
}
