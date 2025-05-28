import React, { useEffect } from 'react';
import { Alert, ToastAndroid, Platform } from 'react-native';
import ObstacleValidationModal from './ObstacleValidationModal';
import { useObstacleValidation } from '@/contexts/ObstacleValidationContext';
import { setObstacleValidationModal } from '@/services/notification-handler.service';

const ObstacleValidationWrapper: React.FC = () => {
    const {
        isVisible,
        validationData,
        hideValidationModal,
        onValidate,
        showValidationModal
    } = useObstacleValidation();

    // Register the modal function with the notification handler service
    useEffect(() => {
        setObstacleValidationModal(showValidationModal);
        console.log("🔔 Obstacle validation modal registered with notification handler");
    }, [showValidationModal]);

    // Cross-platform toast function
    const showToast = (message: string, duration: 'SHORT' | 'LONG' = 'LONG') => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, duration === 'SHORT' ? ToastAndroid.SHORT : ToastAndroid.LONG);
        } else {
            Alert.alert("", message, [{ text: "OK", style: "default" }]);
        }
    };

    const handleValidation = async (response: boolean | null) => {
        if (!validationData || !onValidate) return;

        try {
            // Call the validation callback (now async)
            await onValidate(response, validationData.markerIds, validationData.obstacleType);

            // Show appropriate feedback to user
            showValidationFeedback(response, validationData.obstacleType);
        } catch (error) {
            console.error('❌ Error handling validation response:', error);

            showToast("Sorry, there was an error processing your response. Your feedback is still valuable to us!");
        }
    };

    const showValidationFeedback = (response: boolean | null, obstacleType: string) => {
        const obstacleTypeName = obstacleType
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());

        if (response === true) {
            // User confirmed the obstacle still exists
            console.log("📱 User acknowledged existence confirmation");
            showToast(
                `🙏 Thank you for confirming the ${obstacleTypeName.toLowerCase()} is still there! This helps maintain accurate accessibility data.`,
                'LONG'
            );
        } else if (response === false) {
            // User confirmed the obstacle no longer exists
            console.log("📱 User acknowledged removal confirmation");
            showToast(
                `🙏 Thank you for letting us know the ${obstacleTypeName.toLowerCase()} is gone! We're updating our records to help other users.`,
                'LONG'
            );
        } else {
            // User was unsure
            console.log("📱 User acknowledged unsure response");
            showToast(
                "Thanks for taking the time to check - your participation helps improve accessibility for everyone.",
                'LONG'
            );
        }
    };

    if (!validationData) return null;

    return (
        <ObstacleValidationModal
            visible={isVisible}
            onClose={hideValidationModal}
            obstacleType={validationData.obstacleType}
            markerCount={validationData.markerCount}
            timeAgo={validationData.timeAgo}
            onValidate={handleValidation}
        />
    );
};

export default ObstacleValidationWrapper; 