import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../stores/theme/useTheme";
import useAuth from "../../stores/auth/hooks/useAuth";
import { validateEmail, validatePassword, validateDisplayName, validateUsername, sanitizeInput, sanitizeAndTrim } from '@/utils/validation.utils';

export default function RegisterScreen() {
    const { isDark, setThemeMode } = useTheme();
    const { register, isLoading, error, clearError } = useAuth();

    const [username, setUsername] = useState("");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        username: '',
    });

    useEffect(() => {
        if (localError || error) {
            const timer = setTimeout(() => {
                setLocalError(null);
                clearError();
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [localError, error, clearError]);

    const handleRegister = async () => {
        try {
            clearError();
            setLocalError(null);

            let hasErrors = false;
            const errors = { email: '', password: '', confirmPassword: '', fullName: '', username: '' };

            const emailValidation = validateEmail(email);
            if (!emailValidation.isValid) {
                errors.email = emailValidation.message || '';
                hasErrors = true;
            }

            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                errors.password = passwordValidation.message || '';
                hasErrors = true;
            }

            if (!confirmPassword.trim()) {
                errors.confirmPassword = "Please confirm your password";
                hasErrors = true;
            } else if (password !== confirmPassword) {
                errors.confirmPassword = "Passwords do not match";
                hasErrors = true;
            }

            const fullNameValidation = validateDisplayName(fullName);
            if (!fullNameValidation.isValid) {
                errors.fullName = fullNameValidation.message || '';
                hasErrors = true;
            }

            const usernameValidation = validateUsername(username);
            if (!usernameValidation.isValid) {
                errors.username = usernameValidation.message || '';
                hasErrors = true;
            }

            if (hasErrors) {
                setValidationErrors(errors);
                return;
            }

            await register(email, password, fullName);
        } catch (err) {
            console.error("Registration error:", err);
            setLocalError(err instanceof Error ? err.message : "An unexpected error occurred");
        }
    };

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
            const validation = validatePassword(text);
            setValidationErrors(prev => ({
                ...prev,
                password: validation.isValid ? '' : validation.message || ''
            }));
        }

        if (confirmPassword && validationErrors.confirmPassword) {
            setValidationErrors(prev => ({
                ...prev,
                confirmPassword: text !== confirmPassword ? 'Passwords do not match' : ''
            }));
        }
    };

    const handleConfirmPasswordChange = (text: string) => {
        setConfirmPassword(text);

        if (validationErrors.confirmPassword) {
            setValidationErrors(prev => ({
                ...prev,
                confirmPassword: text !== password ? 'Passwords do not match' : ''
            }));
        }
    };

    const handleFullNameChange = (text: string) => {
        const sanitizedText = sanitizeInput(text);
        setFullName(sanitizedText);

        if (validationErrors.fullName) {
            const validation = validateDisplayName(sanitizedText);
            setValidationErrors(prev => ({
                ...prev,
                fullName: validation.isValid ? '' : validation.message || ''
            }));
        }
    };

    const handleUsernameChange = (text: string) => {
        const sanitizedText = sanitizeAndTrim(text);
        setUsername(sanitizedText);

        if (validationErrors.username) {
            const validation = validateUsername(sanitizedText);
            setValidationErrors(prev => ({
                ...prev,
                username: validation.isValid ? '' : validation.message || ''
            }));
        }
    };

    const navigateToLogin = () => {
        router.push("/login");
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
    const secondaryColor = isDark ? "bg-secondary" : "bg-[#5C8374]";
    const errorBgColor = isDark ? "bg-red-900/10" : "bg-red-500/10";
    const errorTextColor = isDark ? "text-red-400" : "text-red-600";

    return (
        <SafeAreaView className={`flex-1 ${bgColor}`}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    className="px-6"
                    showsVerticalScrollIndicator={false}
                >
                    <View className="flex-1 justify-between py-6">
                        <View>
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

                            {/* Title section - centered with gold/green colors */}
                            <View className="items-center mb-24">
                                <Text className={`text-4xl font-semibold mb-2 text-center ${primaryColor}`}>
                                    New here?
                                </Text>
                                <Text className={`text-3xl font-semibold text-center ${isDark ? 'text-secondary' : 'text-[#5C8374]'}`}>
                                    Tell us more about{"\n"}yourself...
                                </Text>
                            </View>

                            {/* Form inputs */}
                            <View className="flex flex-1">
                                <View className="mb-6">
                                    <View className="flex-row items-center mb-1 ml-1">
                                        <Ionicons name="person-outline" size={16} color={isDark ? "#BBBBBB" : "#666666"} />
                                        <Text className={`text-xs ml-1 ${secondaryTextColor}`}>Username</Text>
                                    </View>
                                    <TextInput
                                        placeholder="Pick a username"
                                        value={username}
                                        onChangeText={handleUsernameChange}
                                        className={`py-3 px-4 rounded-xl border ${inputBgColor} ${textColor} ${borderColor}`}
                                        placeholderTextColor={isDark ? "#BBBBBB" : "#666666"}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                    {validationErrors.username && (
                                        <Text className={`text-xs mt-1 ml-1 ${errorTextColor}`}>
                                            {validationErrors.username}
                                        </Text>
                                    )}
                                </View>

                                <View className="mb-6">
                                    <View className="flex-row items-center mb-1 ml-1">
                                        <Ionicons name="person" size={16} color={isDark ? "#BBBBBB" : "#666666"} />
                                        <Text className={`text-xs ml-1 ${secondaryTextColor}`}>Full Name</Text>
                                    </View>
                                    <TextInput
                                        placeholder="Your full name"
                                        value={fullName}
                                        onChangeText={handleFullNameChange}
                                        className={`py-3 px-4 rounded-xl border ${inputBgColor} ${textColor} ${borderColor}`}
                                        placeholderTextColor={isDark ? "#BBBBBB" : "#666666"}
                                    />
                                    {validationErrors.fullName && (
                                        <Text className={`text-xs mt-1 ml-1 ${errorTextColor}`}>
                                            {validationErrors.fullName}
                                        </Text>
                                    )}
                                </View>

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
                                        placeholder="Create a password"
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

                                <View>
                                    <View className="flex-row items-center mb-1 ml-1">
                                        <Ionicons name="shield-checkmark-outline" size={16} color={isDark ? "#BBBBBB" : "#666666"} />
                                        <Text className={`text-xs ml-1 ${secondaryTextColor}`}>Confirm Password</Text>
                                    </View>
                                    <TextInput
                                        placeholder="Confirm your password"
                                        value={confirmPassword}
                                        onChangeText={handleConfirmPasswordChange}
                                        secureTextEntry={true}
                                        className={`py-3 px-4 rounded-xl border ${inputBgColor} ${textColor} ${borderColor}`}
                                        placeholderTextColor={isDark ? "#BBBBBB" : "#666666"}
                                    />
                                    {validationErrors.confirmPassword && (
                                        <Text className={`text-xs mt-1 ml-1 ${errorTextColor}`}>
                                            {validationErrors.confirmPassword}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>

                        <View className="mt-10">
                            {/* Error display section */}
                            {(localError || error) && (
                                <View className={`mb-4 p-3 rounded-lg ${errorBgColor}`}>
                                    <Text className={`text-center font-semibold ${errorTextColor}`}>
                                        {(() => {
                                            // Handle local validation errors first
                                            if (localError) return localError;

                                            // Process backend errors with context
                                            if (error) {
                                                // Check for error prefix format like "Validation Error: Password must be..."
                                                const errorParts = error.split(': ');
                                                if (errorParts.length > 1) {
                                                    // Return the second part (the actual message)
                                                    return errorParts[1];
                                                }
                                                // No prefix, just return as is
                                                return error;
                                            }

                                            return "Registration failed";
                                        })()}
                                    </Text>
                                </View>
                            )}

                            {/* Create account button - in green/mint color in both modes */}
                            <Pressable
                                onPress={handleRegister}
                                className={`py-4 rounded-xl mb-4 shadow-md ${secondaryColor}`}
                                disabled={isLoading}
                            >
                                <Text className={`text-center font-semibold text-base ${isDark ? 'text-black' : 'text-white'}`}>
                                    {isLoading ? "Creating Account..." : "Create Account"}
                                </Text>
                            </Pressable>

                            {/* Already have an account link */}
                            <Pressable onPress={navigateToLogin} className="py-2">
                                <Text className={`text-center ${secondaryTextColor}`}>
                                    Already have an account?{" "}
                                    <Text className={`font-semibold ${isDark ? 'text-secondary' : 'text-primary'}`}>Sign in</Text>
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
} 