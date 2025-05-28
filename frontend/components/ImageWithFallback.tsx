import React, { useState } from 'react';
import { Image, View, Text, ImageStyle, StyleProp } from 'react-native';
import { useTheme } from '@/stores/theme/useTheme';
import { Ionicons } from '@expo/vector-icons';

interface ImageWithFallbackProps {
    uri: string;
    style?: StyleProp<ImageStyle>;
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    onLoad?: () => void;
    onError?: (error: any) => void;
    showFallback?: boolean;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
    uri,
    style,
    resizeMode = 'cover',
    onLoad,
    onError,
    showFallback = true
}) => {
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { isDark } = useTheme();

    const handleError = (error: any) => {
        console.log(`🖼️ Image error for URI: ${uri.substring(0, 100)}...`);
        console.log(`🖼️ Error details:`, error);
        setHasError(true);
        setIsLoading(false);
        onError?.(error);
    };

    const handleLoad = () => {
        console.log(`🖼️ Image loaded successfully: ${uri.substring(0, 50)}...`);
        setIsLoading(false);
        setHasError(false);
        onLoad?.();
    };

    // Validate URI
    const isValidUri = uri && typeof uri === 'string' && uri.length > 0;
    const isBase64 = isValidUri && uri.startsWith('data:image/');
    const isFile = isValidUri && uri.startsWith('file://');
    const isHttp = isValidUri && (uri.startsWith('http://') || uri.startsWith('https://'));

    if (!isValidUri || hasError) {
        if (!showFallback) return null;

        return (
            <View
                style={[
                    style,
                    {
                        backgroundColor: isDark ? '#374151' : '#f3f4f6',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }
                ]}
            >
                <Ionicons
                    name="image-outline"
                    size={24}
                    color={isDark ? '#9ca3af' : '#6b7280'}
                />
                <Text
                    style={{
                        color: isDark ? '#9ca3af' : '#6b7280',
                        fontSize: 12,
                        marginTop: 4
                    }}
                >
                    No Image
                </Text>
            </View>
        );
    }

    return (
        <Image
            source={{ uri }}
            style={style}
            resizeMode={resizeMode}
            onLoad={handleLoad}
            onError={handleError}
            fadeDuration={300}
        />
    );
}; 