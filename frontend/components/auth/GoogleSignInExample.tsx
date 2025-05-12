import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GoogleSignInButton from './GoogleSignInButton';

const GoogleSignInExample = () => {
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const handleSignInSuccess = () => {
        setStatus('Successfully signed in with Google!');
        setError(null);
    };

    const handleSignInError = (error: Error) => {
        setStatus('Failed to sign in');
        setError(error.message);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Sign in with Google</Text>

            <GoogleSignInButton
                onSuccess={handleSignInSuccess}
                onError={handleSignInError}
            />

            {status ? (
                <Text style={styles.status}>{status}</Text>
            ) : null}

            {error ? (
                <Text style={styles.error}>{error}</Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    status: {
        marginTop: 20,
        fontSize: 16,
        color: 'green',
    },
    error: {
        marginTop: 10,
        fontSize: 14,
        color: 'red',
    },
});

export default GoogleSignInExample; 