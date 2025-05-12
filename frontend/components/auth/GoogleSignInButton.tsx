import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FirebaseService from '@/services/firebase.service';
import { useAuthStore } from '@/stores/auth/auth.store';
import * as WebBrowser from 'expo-web-browser';

// Ensure we close any WebBrowser sessions on component load
WebBrowser.maybeCompleteAuthSession();

interface GoogleSignInButtonProps {
    label?: string;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

const GoogleSignInButton = ({
    label = "Sign in with Google",
    onSuccess,
    onError
}: GoogleSignInButtonProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const { useGoogleAuth, signInWithGoogle } = FirebaseService;
    const loginWithGoogle = useAuthStore(state => state.loginWithGoogle);

    // Get the Google authentication hook
    const { request, response, promptAsync } = useGoogleAuth();

    // Handle the response from Google Sign In
    useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            handleSignIn(id_token);
        } else if (response?.type === 'error') {
            setIsLoading(false);
            onError?.(new Error(response.error?.message || "Google Sign In failed"));
        }
    }, [response]);

    const handleSignIn = async (idToken: string) => {
        try {
            setIsLoading(true);

            // Then authenticate with our backend, passing the ID token
            await loginWithGoogle(idToken);

            setIsLoading(false);
            onSuccess?.();
        } catch (error) {
            setIsLoading(false);
            console.error('Google sign in error:', error);
            onError?.(error instanceof Error ? error : new Error('Failed to sign in with Google'));
        }
    };

    const handlePress = async () => {
        if (isLoading) return;
        setIsLoading(true);

        try {
            await promptAsync();
            // Loading state will be managed by the response useEffect
        } catch (error) {
            setIsLoading(false);
            console.error('Error starting Google Sign In:', error);
            onError?.(error instanceof Error ? error : new Error('Failed to start Google Sign In'));
        }
    };

    return (
        <TouchableOpacity
            style={styles.button}
            onPress={handlePress}
            disabled={isLoading || !request}
        >
            {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
            ) : (
                <>
                    <Ionicons name="logo-google" size={24} color="#ffffff" style={styles.icon} />
                    <Text style={styles.text}>{label}</Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4285F4',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 4,
        marginVertical: 10,
    },
    icon: {
        marginRight: 12,
    },
    text: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default GoogleSignInButton; 