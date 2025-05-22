import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Switch, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from '@react-native-picker/picker';
import { PlaceType, Budget, DistanceUnit, TransportMethod, UserPreferences } from "@/types/auth.types";
import useAuth from "@/stores/auth/hooks/useAuth";
import api from "@/services/api.service";

interface PreferencesModalProps {
    visible: boolean;
    onClose: () => void;
    colors: any; // Theme colors
    styles: any; // Theme styles
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ visible, onClose, colors, styles }) => {
    const { user, updateUserPreferences } = useAuth();

    // Initialize preferences from user data
    const [activityTypes, setActivityTypes] = useState<PlaceType[]>([]);
    const [transportMethod, setTransportMethod] = useState<TransportMethod>(TransportMethod.WALKING);
    const [budget, setBudget] = useState<Budget>(Budget.MEDIUM);
    const [location, setLocation] = useState({ latitude: 0, longitude: 0 });
    const [searchRadius, setSearchRadius] = useState<number>(5);
    const [wheelchairAccessible, setWheelchairAccessible] = useState<boolean>(false);
    const [hasElevator, setHasElevator] = useState<boolean>(false);
    const [hasRamp, setHasRamp] = useState<boolean>(false);
    const [hasAccessibleBathroom, setHasAccessibleBathroom] = useState<boolean>(false);

    // State for place types from API
    const [placeTypes, setPlaceTypes] = useState<PlaceType[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // Fetch place types from API
    useEffect(() => {
        const fetchPlaceTypes = async () => {
            setLoading(true);
            try {
                const response = await api.get('/api/type');
                if (response.data && response.data.success) {
                    setPlaceTypes(response.data.types);
                }
            } catch (error) {
                console.error('Error fetching place types:', error);
            } finally {
                setLoading(false);
            }
        };

        if (visible) {
            fetchPlaceTypes();
        }
    }, [visible]);

    // Load preferences when user data changes or modal opens
    useEffect(() => {
        if (user?.preferences) {
            setActivityTypes(user.preferences.activityTypes || []);
            setTransportMethod(user.preferences.transportMethod || TransportMethod.WALKING);
            setBudget(user.preferences.budget || Budget.MEDIUM);
            setLocation(user.preferences.baseLocation || { latitude: 0, longitude: 0 });
            setSearchRadius(user.preferences.searchRadius || 5);

            if (user.preferences.accessibilityRequirements) {
                setWheelchairAccessible(user.preferences.accessibilityRequirements.wheelchairAccessible || false);
                setHasElevator(user.preferences.accessibilityRequirements.hasElevator || false);
                setHasRamp(user.preferences.accessibilityRequirements.hasRamp || false);
                setHasAccessibleBathroom(user.preferences.accessibilityRequirements.hasAccessibleBathroom || false);
            }
        }
    }, [user, visible]);

    const savePreferences = async () => {
        try {
            const updatedPreferences: UserPreferences = {
                activityTypes,
                transportMethod,
                budget,
                baseLocation: location,
                searchRadius,
                preferedUnit: user?.preferences?.preferedUnit || DistanceUnit.KILOMETERS,
                accessibilityRequirements: {
                    wheelchairAccessible,
                    hasElevator,
                    hasRamp,
                    hasAccessibleBathroom
                }
            };

            await updateUserPreferences(updatedPreferences);
            onClose();
        } catch (error) {
            console.error('Error saving preferences:', error);
            // Implement error handling here - could add a Toast/Alert
        }
    };

    // Filter place types based on search query
    const filteredPlaceTypes = searchQuery
        ? placeTypes.filter(type =>
            type.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !activityTypes.some(at => at.value === type.value)
        )
        : [];

    // Toggle a place type in the selection
    const togglePlaceType = (type: PlaceType) => {
        if (activityTypes.some(t => t.value === type.value)) {
            setActivityTypes(activityTypes.filter(t => t.value !== type.value));
        } else {
            setActivityTypes([...activityTypes, type]);
        }
        setSearchQuery('');
        setShowDropdown(false);
    };

    // Remove a selected place type
    const removePlaceType = (type: PlaceType) => {
        setActivityTypes(activityTypes.filter(t => t.value !== type.value));
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <SafeAreaView className="flex-1" style={[styles.background, { opacity: 0.98 }]}>
                <View className="flex-1 p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-xl font-bold" style={styles.text}>My Preferences</Text>
                        <Pressable key="close-modal-button" onPress={onClose}>
                            <Ionicons name="close" size={28} color={colors.text} />
                        </Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Activity Types */}
                        <View className="mb-6">
                            <Text className="text-lg font-bold mb-2" style={styles.text}>Activity Types</Text>

                            {/* Selected types */}
                            <View className="flex-row flex-wrap mb-2">
                                {activityTypes.length > 0 && activityTypes.map((type) => (
                                    <Pressable
                                        key={type.value}
                                        className="mr-2 mb-2 px-3 py-2 rounded-full flex-row items-center"
                                        style={{ backgroundColor: colors.primary }}
                                        onPress={() => removePlaceType(type)}
                                    >
                                        <Text style={{ color: 'white', marginRight: 5 }}>
                                            {type.label}
                                        </Text>
                                        <Ionicons name="close-circle" size={16} color="white" />
                                    </Pressable>
                                ))}
                            </View>

                            {/* Search input */}
                            <View className="relative">
                                <View style={{ position: 'relative' }}>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                color: colors.text,
                                                borderColor: colors.border,
                                                borderWidth: 1,
                                                borderRadius: 8,
                                                padding: 12,
                                                paddingRight: 40
                                            }
                                        ]}
                                        value={searchQuery}
                                        onChangeText={(text) => {
                                            setSearchQuery(text);
                                            setShowDropdown(!!text);
                                        }}
                                        placeholder="Search for activity types..."
                                        placeholderTextColor={colors.secondaryText}
                                        onFocus={() => setShowDropdown(!!searchQuery)}
                                    />
                                    {loading ? (
                                        <ActivityIndicator
                                            key="loading-indicator"
                                            style={{ position: 'absolute', right: 12, top: 12 }}
                                            color={colors.primary}
                                            size="small"
                                        />
                                    ) : (
                                        searchQuery && (
                                            <Pressable
                                                key="clear-search-button"
                                                style={{ position: 'absolute', right: 12, top: 12 }}
                                                onPress={() => {
                                                    setSearchQuery('');
                                                    setShowDropdown(false);
                                                }}
                                            >
                                                <Ionicons name="close-circle" size={20} color={colors.secondaryText} />
                                            </Pressable>
                                        )
                                    )}
                                </View>

                                {/* Dropdown */}
                                {showDropdown && filteredPlaceTypes.length > 0 && (
                                    <View
                                        style={{
                                            maxHeight: 200,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            borderRadius: 8,
                                            marginTop: 4,
                                            backgroundColor: styles.card.backgroundColor,
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }}>
                                            {filteredPlaceTypes.map((item) => (
                                                <Pressable
                                                    key={item.value}
                                                    style={{
                                                        padding: 12,
                                                        borderBottomWidth: 1,
                                                        borderBottomColor: colors.border
                                                    }}
                                                    onPress={() => togglePlaceType(item)}
                                                >
                                                    <Text style={styles.text}>{item.label}</Text>
                                                </Pressable>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Transport Method */}
                        <View className="mb-6">
                            <Text className="text-lg font-bold mb-2" style={styles.text}>Transport Method</Text>
                            <View style={[{ borderRadius: 8, overflow: 'hidden' }, styles.card]}>
                                <Picker
                                    selectedValue={transportMethod}
                                    onValueChange={(value) => setTransportMethod(value)}
                                    dropdownIconColor={colors.text}
                                    style={[{ color: colors.text }, styles.input]}
                                >
                                    <Picker.Item key="walking" label="Walking" value={TransportMethod.WALKING} />
                                    <Picker.Item key="wheelchair" label="Wheelchair" value={TransportMethod.WHEELCHAIR} />
                                    <Picker.Item key="public_transport" label="Public Transport" value={TransportMethod.PUBLIC_TRANSPORT} />
                                    <Picker.Item key="car" label="Car" value={TransportMethod.CAR} />
                                </Picker>
                            </View>
                        </View>

                        {/* Budget */}
                        <View className="mb-6">
                            <Text className="text-lg font-bold mb-2" style={styles.text}>Budget</Text>
                            <View style={[{ borderRadius: 8, overflow: 'hidden' }, styles.card]}>
                                <Picker
                                    selectedValue={budget}
                                    onValueChange={(value) => setBudget(value)}
                                    dropdownIconColor={colors.text}
                                    style={[{ color: colors.text }, styles.input]}
                                >
                                    <Picker.Item key="free" label="Free" value={Budget.FREE} />
                                    <Picker.Item key="low" label="Low" value={Budget.LOW} />
                                    <Picker.Item key="medium" label="Medium" value={Budget.MEDIUM} />
                                    <Picker.Item key="high" label="High" value={Budget.HIGH} />
                                </Picker>
                            </View>
                        </View>

                        {/* Search Radius */}
                        <View className="mb-6">
                            <Text className="text-lg font-bold mb-2" style={styles.text}>Search Radius (km)</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12 }]}
                                keyboardType="numeric"
                                value={searchRadius.toString()}
                                onChangeText={(text) => setSearchRadius(parseInt(text) || 0)}
                                placeholder="Search Radius in km"
                                placeholderTextColor={colors.secondaryText}
                            />
                        </View>

                        {/* Accessibility Requirements */}
                        <View className="mb-6">
                            <Text className="text-lg font-bold mb-2" style={styles.text}>Accessibility Requirements</Text>

                            <View key="wheelchair-accessible" className="flex-row justify-between items-center mb-3">
                                <Text style={styles.text}>Wheelchair Accessible</Text>
                                <Switch
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                    thumbColor="white"
                                    onValueChange={setWheelchairAccessible}
                                    value={wheelchairAccessible}
                                />
                            </View>

                            <View key="has-elevator" className="flex-row justify-between items-center mb-3">
                                <Text style={styles.text}>Has Elevator</Text>
                                <Switch
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                    thumbColor="white"
                                    onValueChange={setHasElevator}
                                    value={hasElevator}
                                />
                            </View>

                            <View key="has-ramp" className="flex-row justify-between items-center mb-3">
                                <Text style={styles.text}>Has Ramp</Text>
                                <Switch
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                    thumbColor="white"
                                    onValueChange={setHasRamp}
                                    value={hasRamp}
                                />
                            </View>

                            <View key="accessible-bathroom" className="flex-row justify-between items-center">
                                <Text style={styles.text}>Accessible Bathroom</Text>
                                <Switch
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                    thumbColor="white"
                                    onValueChange={setHasAccessibleBathroom}
                                    value={hasAccessibleBathroom}
                                />
                            </View>
                        </View>

                        {/* Save Button */}
                        <Pressable
                            key="save-preferences-button"
                            className="py-4 rounded-lg mt-4 mb-10"
                            style={{ backgroundColor: colors.primary }}
                            onPress={savePreferences}
                        >
                            <Text className="text-center text-white font-medium">Save Preferences</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

export default PreferencesModal; 