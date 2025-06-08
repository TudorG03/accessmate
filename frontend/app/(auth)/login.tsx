import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Image,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../stores/theme/useTheme";
import useAuth from "../../stores/auth/hooks/useAuth";
import { validateEmail, sanitizeInput } from '@/utils/validation.utils';

export default function LoginScreen() {
    const { isDark, setThemeMode } = useTheme();
    const { login, isLoading, error, clearError } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState({
        email: '',
        password: '',
    });

    // Auto-clear errors after 5 seconds
    useEffect(() => {
        if (localError || error) {
            const timer = setTimeout(() => {
                setLocalError(null);
                clearError();
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [localError, error, clearError]);

    const handleLogin = async () => {
        try {
            // Clear any previous errors
            clearError();
            setLocalError(null);

            // Validation
            let hasErrors = false;
            const errors = { email: '', password: '' };

            // Email validation
            const emailValidation = validateEmail(email);
            if (!emailValidation.isValid) {
                errors.email = emailValidation.message || '';
                hasErrors = true;
            }

            // Password validation (just check if provided for login)
            if (!password.trim()) {
                errors.password = "Password is required";
                hasErrors = true;
            }

            if (hasErrors) {
                setValidationErrors(errors);
                return;
            }

            await login(email, password);
        } catch (err) {
            console.error("Login error:", err);
            setLocalError(err instanceof Error ? err.message : "An unexpected error occurred");
        }
    };

    // Input handlers with validation
    const handleEmailChange = (text: string) => {
        const sanitizedText = sanitizeInput(text);
        setEmail(sanitizedText);

        if (validationErrors.email) {
            const validation = validateEmail(sanitizedText);
            setValidationErrors(prev => ({
                ...prev,
                email: validation.isValid ? '' : validation.message || ''
            }));
        }
    };

    const handlePasswordChange = (text: string) => {
        setPassword(text);

        if (validationErrors.password) {
            setValidationErrors(prev => ({
                ...prev,
                password: text.trim() ? '' : 'Password is required'
            }));
        }
    };

    const navigateToRegister = () => {
        clearError();
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
    const errorBgColor = isDark ? "bg-red-900/10" : "bg-red-500/10";
    const errorTextColor = isDark ? "text-red-400" : "text-red-600";

    return (
        <SafeAreaView className={`flex-1 ${bgColor}`}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
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
                        <View className="items-center mb-20">
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
                                        onChangeText={handleEmailChange}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        className={`py-3 px-4 rounded-xl border ${inputBgColor} ${textColor} ${borderColor}`}
                                        placeholderTextColor={isDark ? "#BBBBBB" : "#666666"}
                                    />
                                    {validationErrors.email && (
                                        <Text className={`text-xs mt-1 ml-1 ${errorTextColor}`}>
                                            {validationErrors.email}
                                        </Text>
                                    )}
                                </View>

                                <View className="mb-6">
                                    <View className="flex-row items-center mb-1 ml-1">
                                        <Ionicons name="lock-closed-outline" size={16} color={isDark ? "#BBBBBB" : "#666666"} />
                                        <Text className={`text-xs ml-1 ${secondaryTextColor}`}>Password</Text>
                                    </View>
                                    <TextInput
                                        placeholder="Enter your password"
                                        value={password}
                                        onChangeText={handlePasswordChange}
                                        secureTextEntry={true}
                                        className={`py-3 px-4 rounded-xl border ${inputBgColor} ${textColor} ${borderColor}`}
                                        placeholderTextColor={isDark ? "#BBBBBB" : "#666666"}
                                    />
                                    {validationErrors.password && (
                                        <Text className={`text-xs mt-1 ml-1 ${errorTextColor}`}>
                                            {validationErrors.password}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>

                        <View className="mt-auto">
                            {/* Error display section */}
                            {(localError || error) && (
                                <View className={`mb-4 p-3 rounded-lg ${errorBgColor}`}>
                                    <Text className={`text-center font-semibold ${errorTextColor}`}>
                                        {(() => {
                                            // Handle local validation errors first
                                            if (localError) return localError;

                                            // Process backend errors with context
                                            if (error) {
                                                // Check for error prefix format like "Authentication Error: Invalid credentials"
                                                const errorParts = error.split(': ');
                                                if (errorParts.length > 1) {
                                                    // Return the second part (the actual message)
                                                    return errorParts[1];
                                                }
                                                // No prefix, just return as is
                                                return error;
                                            }

                                            return "Login failed";
                                        })()}
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
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
} 