import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ObstacleValidationData {
    obstacleType: string;
    markerIds: string[];
    markerCount: number;
    timeAgo?: string;
}

interface ObstacleValidationContextType {
    showValidationModal: (data: ObstacleValidationData, onValidate: (response: boolean | null, markerIds: string[], obstacleType: string) => Promise<void>) => void;
    hideValidationModal: () => void;
    isVisible: boolean;
    validationData: ObstacleValidationData | null;
    onValidate: ((response: boolean | null, markerIds: string[], obstacleType: string) => void) | null;
}

const ObstacleValidationContext = createContext<ObstacleValidationContextType | undefined>(undefined);

interface ObstacleValidationProviderProps {
    children: ReactNode;
}

export const ObstacleValidationProvider: React.FC<ObstacleValidationProviderProps> = ({ children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [validationData, setValidationData] = useState<ObstacleValidationData | null>(null);
    const [onValidate, setOnValidate] = useState<((response: boolean | null, markerIds: string[], obstacleType: string) => Promise<void>) | null>(null);

    const showValidationModal = (
        data: ObstacleValidationData,
        validateCallback: (response: boolean | null, markerIds: string[], obstacleType: string) => Promise<void>
    ) => {
        setValidationData(data);
        setOnValidate(() => validateCallback);
        setIsVisible(true);
    };

    const hideValidationModal = () => {
        setIsVisible(false);
        setValidationData(null);
        setOnValidate(null);
    };

    const handleValidate = async (response: boolean | null) => {
        if (onValidate && validationData) {
            try {
                await onValidate(response, validationData.markerIds, validationData.obstacleType);
            } catch (error) {
                // Silent error handling
            }
        }
        hideValidationModal();
    };

    return (
        <ObstacleValidationContext.Provider
            value={{
                showValidationModal,
                hideValidationModal,
                isVisible,
                validationData,
                onValidate: handleValidate,
            }}
        >
            {children}
        </ObstacleValidationContext.Provider>
    );
};

export const useObstacleValidation = () => {
    const context = useContext(ObstacleValidationContext);
    if (context === undefined) {
        throw new Error('useObstacleValidation must be used within an ObstacleValidationProvider');
    }
    return context;
}; 