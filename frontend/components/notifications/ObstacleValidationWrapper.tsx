import React, { useEffect, useRef } from 'react';
import { Alert, ToastAndroid, Platform } from 'react-native';
import ObstacleValidationModal from './ObstacleValidationModal';
import { useObstacleValidation } from '@/contexts/ObstacleValidationContext';
import { setObstacleValidationModal, clearObstacleValidationModal } from '@/services/notification-handler.service';
import { getNotificationConfig } from "@/config/notification.config";

// Get configuration instance
const config = getNotificationConfig();

const ObstacleValidationWrapper: React.FC = () => {
    const {
        isVisible,
        validationData,
        hideValidationModal,
        onValidate,
        showValidationModal
    } = useObstacleValidation();

    // Use ref to store stable reference to the modal function
    const modalFunctionRef = useRef(showValidationModal);
    modalFunctionRef.current = showValidationModal;

    // Register the modal function with the notification handler service
    useEffect(() => {
        // Only register the modal function - notifications are initialized elsewhere
        // to prevent duplicate initialization and double listeners
        try {
            // Register the modal function using stable reference
            setObstacleValidationModal((data, callback) => {
                modalFunctionRef.current(data, callback);
            });
        } catch (error) {
            console.warn('Failed to register obstacle validation modal:', error);
        }

        // Cleanup function
        return () => {
            clearObstacleValidationModal();
        };
    }, []); // No dependencies needed since we're not initializing notifications here

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
            showToast(config.ERROR_FEEDBACK_MESSAGE);
        }
    };

    const showValidationFeedback = (response: boolean | null, obstacleType: string) => {
        const feedbackMessage = config.getFeedbackMessage(response, obstacleType);
        showToast(feedbackMessage, 'LONG');
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