import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../stores/theme/useTheme";
import useAuth from "../../stores/auth/hooks/useAuth";

export default function LoginScreen() {
    const { isDark, setThemeMode } = useTheme();
    const { login, isLoading, error } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        await login(email, password);
        // Navigation is now handled in the auth store
    };

    const navigateToRegister = () => {
        router.push("/register");
    };

    const toggleTheme = () => {
        setThemeMode(isDark ? "light" : "dark");
    };

    // Tailwind dynamic colors
    const bgColor = isDark ? "bg-dark-background" : "bg-light-background";
    const textColor = isDark ? "text-white" : "text-black";
    const secondaryTextColor = isDark ? "text-gray-300" : "text-gray-500";
    const inputBgColor = isDark ? "bg-dark-input" : "bg-light-input";
    const borderColor = isDark ? "border-dark-border" : "border-light-border";
    const primaryColor = "text-primary";
    const secondaryColor = isDark ? "bg-secondary" : "bg-primary";
    const errorBgColor = isDark ? "bg-red-900/10" : "bg-red-500/10";
    const errorTextColor = isDark ? "text-red-400" : "text-red-600";

    return (
        <SafeAreaView className={`flex-1 ${bgColor}`}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <View className="flex-1 px-6 py-6">
                    {/* Header with theme toggle and logo */}
                    <View className="flex-row justify-between items-center mb-10">
                        {/* Logo */}
                        <Image
                            source={isDark
                                ? require('../../assets/images/logo-icon-white.png')
                                : require('../../assets/images/logo-icon-black.png')
                            }
                            className="w-10 h-10"
                            resizeMode="contain"
                        />

                        {/* Theme toggle button */}
                        <Pressable
                            onPress={toggleTheme}
                            className={`p-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-black/5'}`}
                        >
                            <Ionicons
                                name={isDark ? "sunny" : "moon"}
                                size={22}
                                color={isDark ? "#FDB813" : "#6E6E6E"}
                            />
                        </Pressable>
                    </View>

                    {/* Title section */}
                    <View className="items-center mb-24">
                        <Text className={`text-4xl font-semibold mb-2 text-center ${primaryColor}`}>
                            Welcome back!
                        </Text>
                        <Text className={`text-3xl font-semibold text-center ${isDark ? 'text-secondary' : 'text-[#5C8374]'}`}>
                            Sign in to continue
                        </Text>
                    </View>

                    {/* Content Container - using flex-1 to center the form */}
                    <View className="flex-1 justify-center">
                        {/* Form inputs */}
                        <View className="space-y-6">
                            <View className="mb-6">
                                <View className="flex-row items-center mb-1 ml-1">
                                    <Ionicons name="mail-outline" size={16} color={isDark ? "#BBBBBB" : "#666666"} />
                                    <Text className={`text-xs ml-1 ${secondaryTextColor}`}>Email</Text>
                                </View>
                                <TextInput
                                    placeholder="Your email address"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    className={`py-3 px-4 rounded-xl border ${inputBgColor} ${textColor} ${borderColor}`}
                                    placeholderTextColor={isDark ? "#BBBBBB" : "#666666"}
                                />
                            </View>

                            <View className="mb-6">
                                <View className="flex-row items-center mb-1 ml-1">
                                    <Ionicons name="lock-closed-outline" size={16} color={isDark ? "#BBBBBB" : "#666666"} />
                                    <Text className={`text-xs ml-1 ${secondaryTextColor}`}>Password</Text>
                                </View>
                                <TextInput
                                    placeholder="Enter your password"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={true}
                                    className={`py-3 px-4 rounded-xl border ${inputBgColor} ${textColor} ${borderColor}`}
                                    placeholderTextColor={isDark ? "#BBBBBB" : "#666666"}
                                />
                            </View>
                        </View>
                    </View>

                    <View className="mt-auto">
                        {/* Error message */}
                        {error && (
                            <View className={`mb-4 p-3 rounded-lg ${errorBgColor}`}>
                                <Text className={`text-center ${errorTextColor}`}>
                                    {error}
                                </Text>
                            </View>
                        )}

                        {/* Login button */}
                        <Pressable
                            onPress={handleLogin}
                            className={`py-4 rounded-xl mb-4 shadow-md ${isDark ? 'bg-secondary' : 'bg-[#5C8374]'}`}
                            disabled={isLoading}
                        >
                            <Text className={`text-center font-semibold text-base ${isDark ? 'text-black' : 'text-white'}`}>
                                {isLoading ? "Signing in..." : "Sign In"}
                            </Text>
                        </Pressable>

                        {/* Register link */}
                        <Pressable onPress={navigateToRegister} className="py-2">
                            <Text className={`text-center ${secondaryTextColor}`}>
                                Don't have an account?{" "}
                                <Text className={`font-semibold ${isDark ? 'text-secondary' : 'text-primary'}`}>Register</Text>
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
} 