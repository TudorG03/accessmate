import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { DistanceUnit } from '@/types/auth.types';
import { useTheme } from '@/stores/theme/useTheme';
import useAuth from '@/stores/auth/hooks/useAuth';

export const UnitPreferenceSelector = () => {
    const { user, updateUser } = useAuth();
    const { colors, styles } = useTheme();

    const handleUnitChange = (unit: DistanceUnit) => {
        if (user) {
            updateUser(user.id, {
                preferences: {
                    ...user.preferences,
                    preferedUnit: unit
                }
            });
        }
    };

    return (
        <View className="mb-2">
            <Text className="text-sm mb-2" style={styles.text}>Distance Unit</Text>
            <View className="flex-row">
                <Pressable
                    onPress={() => handleUnitChange(DistanceUnit.KILOMETERS)}
                    className={`flex-1 py-2 rounded-l-lg justify-center items-center border`}
                    style={{
                        backgroundColor: user?.preferences?.preferedUnit === DistanceUnit.KILOMETERS
                            ? colors.primary
                            : colors.background,
                        borderColor: colors.border,
                    }}
                >
                    <Text
                        style={{
                            color: user?.preferences?.preferedUnit === DistanceUnit.KILOMETERS
                                ? 'white'
                                : colors.text
                        }}
                    >
                        Kilometers
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => handleUnitChange(DistanceUnit.MILES)}
                    className={`flex-1 py-2 rounded-r-lg justify-center items-center border`}
                    style={{
                        backgroundColor: user?.preferences?.preferedUnit === DistanceUnit.MILES
                            ? colors.primary
                            : colors.background,
                        borderColor: colors.border,
                    }}
                >
                    <Text
                        style={{
                            color: user?.preferences?.preferedUnit === DistanceUnit.MILES
                                ? 'white'
                                : colors.text
                        }}
                    >
                        Miles
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}; 