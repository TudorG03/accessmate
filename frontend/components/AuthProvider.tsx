import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import useAuth from '../stores/auth/hooks/useAuth';
import { useRole } from '../stores/auth/hooks/useRole';
import { redirectBasedOnRole } from './RoleBasedRedirect';

interface AuthProviderProps {
    children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [shouldRedirect, setShouldRedirect] = useState(false);
    const [targetRole, setTargetRole] = useState<any>(null);
    const { refreshToken, isAuthenticated } = useAuth();
    const { role } = useRole();

    // Initial auth check
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                if (isAuthenticated) {
                    console.log('Found stored credentials, refreshing token...');
                    const refreshed = await refreshToken();
                    
                    if (refreshed && role) {
                        console.log('Token refreshed successfully, preparing to redirect');
                        setTargetRole(role);
                        setShouldRedirect(true);
                    } else {
                        console.log('Token refresh failed, will redirect to login after mount');
                        setShouldRedirect(true);
                        setTargetRole(null);
                    }
                } else {
                    console.log('No stored credentials found');
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                setIsInitialized(true);
            }
        };

        initializeAuth();

        // Set up token refresh interval
        const refreshInterval = setInterval(() => {
            if (isAuthenticated) {
                refreshToken();
            }
        }, 25 * 60 * 1000);

        return () => clearInterval(refreshInterval);
    }, []);

    // Handle navigation after initial render
    useFocusEffect(
        useCallback(() => {
            // Only navigate if we're initialized and have a pending redirect
            if (isInitialized && shouldRedirect) {
                console.log('Layout mounted, now safe to redirect');
                // Small delay to ensure layout is fully ready
                const timer = setTimeout(() => {
                    if (targetRole) {
                        redirectBasedOnRole(targetRole);
                    } else {
                        router.replace('/login' as const);
                    }
                    setShouldRedirect(false);
                }, 100);
                
                return () => clearTimeout(timer);
            }
        }, [isInitialized, shouldRedirect, targetRole])
    );

    if (!isInitialized) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return <>{children}</>;
} 