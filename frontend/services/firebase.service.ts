import { initializeApp } from "firebase/app";
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCredential,
    signOut as firebaseSignOut,
    User as FirebaseUser,
} from "firebase/auth";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { Platform } from "react-native";

// Initialize WebBrowser for OAuth redirects
WebBrowser.maybeCompleteAuthSession();

// Your Firebase configuration
// Replace these values with your actual Firebase config values
const firebaseConfig = {
    apiKey: process.env.API_KEY,
    authDomain: process.env.AUTH_DOMAIN,
    projectId: process.env.PROJECT_ID,
    storageBucket: process.env.STORAGE_BUCKET,
    messagingSenderId: process.env.MESSAGING_SENDER_ID,
    appId: process.env.APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Configure Google Auth
const useGoogleAuth = () => {
    const [request, response, promptAsync] = Google.useAuthRequest({
        clientId:
            "290945619828-vlh4puq9rsdv50f8m55i04vgta93mi7d.apps.googleusercontent.com", // Web client ID
        androidClientId:
            "290945619828-uk2lgg074a3fcvrj42forbab4lgsqfss.apps.googleusercontent.com", // From Google Cloud Console
    });

    return {
        request,
        response,
        promptAsync,
    };
};

// Function to sign in with Google
const signInWithGoogle = async (idToken: string) => {
    try {
        // Create a Google credential with the token
        const googleCredential = GoogleAuthProvider.credential(idToken);

        // Sign in to Firebase with the Google credential
        const userCredential = await signInWithCredential(
            auth,
            googleCredential,
        );
        return userCredential.user;
    } catch (error) {
        console.error("Error signing in with Google:", error);
        throw error;
    }
};

// Function to sign out
const signOut = async () => {
    return firebaseSignOut(auth);
};

// Listen for authentication state changes
const subscribeToAuthChanges = (
    callback: (user: FirebaseUser | null) => void,
) => {
    return onAuthStateChanged(auth, callback);
};

// Get current user
const getCurrentUser = () => {
    return auth.currentUser;
};

export const FirebaseService = {
    auth,
    useGoogleAuth,
    signInWithGoogle,
    signOut,
    subscribeToAuthChanges,
    getCurrentUser,
};

export default FirebaseService;
