import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Switch, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from '@react-native-picker/picker';
import { PlaceType, Budget, DistanceUnit, TransportMethod, UserPreferences } from "@/types/auth.types";
import useAuth from "@/stores/auth/hooks/useAuth";
import api from "@/services/api.service";
import LocationSearchBar from "@/components/location/LocationSearchBar";

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
    const [locationName, setLocationName] = useState<string>('');
    const [searchRadius, setSearchRadius] = useState<number>(5);
    const [wheelchairAccessible, setWheelchairAccessible] = useState<boolean>(false);
    const [hasElevator, setHasElevator] = useState<boolean>(false);
    const [hasRamp, setHasRamp] = useState<boolean>(false);
    const [hasAccessibleBathroom, setHasAccessibleBathroom] = useState<boolean>(false);
    const [hasWideDoors, setHasWideDoors] = useState<boolean>(false);

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
                console.log('🌐 Fetching place types from API...');
                const response = await api.get('/api/type');
                console.log('🌐 API Response:', response);
                console.log('🌐 Response Data:', response.data);

                if (response.data && response.data.success) {
                    console.log('✅ Place types loaded:', response.data.types?.length || 0);
                    setPlaceTypes(response.data.types || []);
                } else if (response.data && response.data.types) {
                    // Handle different response structure
                    console.log('✅ Place types loaded (alt structure):', response.data.types?.length || 0);
                    setPlaceTypes(response.data.types || []);
                } else if (response.data && Array.isArray(response.data)) {
                    // Handle direct array response
                    console.log('✅ Place types loaded (direct array):', response.data.length || 0);
                    setPlaceTypes(response.data);
                } else {
                    console.warn('⚠️ Unexpected API response structure:', response.data);
                    // Fallback: create some test data
                    const fallbackTypes = [
                        { value: 'restaurant', label: 'Restaurant' },
                        { value: 'park', label: 'Park' },
                        { value: 'museum', label: 'Museum' },
                        { value: 'cafe', label: 'Cafe' },
                        { value: 'library', label: 'Library' },
                        { value: 'gym', label: 'Gym' },
                    ];
                    console.log('🔄 Using fallback data:', fallbackTypes.length);
                    setPlaceTypes(fallbackTypes);
                }
            } catch (error: any) {
                console.error('❌ Error fetching place types:', error);
                console.error('❌ Error details:', {
                    message: error instanceof Error ? error.message : 'Unknown error',
                    status: error?.response?.status,
                    data: error?.response?.data
                });

                // Fallback: create some test data
                const fallbackTypes = [
                    { value: 'restaurant', label: 'Restaurant' },
                    { value: 'park', label: 'Park' },
                    { value: 'museum', label: 'Museum' },
                    { value: 'cafe', label: 'Cafe' },
                    { value: 'library', label: 'Library' },
                    { value: 'gym', label: 'Gym' },
                ];
                console.log('🔄 Using fallback data due to error:', fallbackTypes.length);
                setPlaceTypes(fallbackTypes);
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
            setLocationName(''); // Will be set when location is selected
            setSearchRadius(user.preferences.searchRadius || 5);

            if (user.preferences.accessibilityRequirements) {
                setWheelchairAccessible(user.preferences.accessibilityRequirements.wheelchairAccessible || false);
                setHasElevator(user.preferences.accessibilityRequirements.hasElevator || false);
                setHasRamp(user.preferences.accessibilityRequirements.hasRamp || false);
                setHasAccessibleBathroom(user.preferences.accessibilityRequirements.hasAccessibleBathroom || false);
                setHasWideDoors(user.preferences.accessibilityRequirements.hasWideDoors || false);
            }
        }
    }, [user, visible]);

    // Handle location selection from the search bar
    const handleLocationSelected = (selectedLocation: {
        name: string,
        address: string,
        coordinates: { latitude: number, longitude: number }
    }) => {
        setLocation(selectedLocation.coordinates);
        setLocationName(selectedLocation.address);
        console.log('Location selected:', selectedLocation);
    };

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
                    hasAccessibleBathroom,
                    hasWideDoors
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

                    {/* Location - Outside of main ScrollView to avoid nesting */}
                    <View className="mb-6">
                        <Text className="text-lg font-bold mb-2" style={styles.text}>Base Location</Text>
                        <LocationSearchBar
                            onLocationSelected={handleLocationSelected}
                            placeholder="Search for your base location..."
                        />
                        {locationName && (
                            <Text className="mt-2 text-sm" style={styles.secondaryText}>
                                Selected: {locationName}
                            </Text>
                        )}
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
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
                            <View className="relative" style={{ zIndex: 1000 }}>
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
                                            console.log('🔍 Search changed:', text);
                                            console.log('🔍 Available types:', placeTypes.length);
                                            setSearchQuery(text);
                                            setShowDropdown(!!text);
                                        }}
                                        placeholder="Search for activity types..."
                                        placeholderTextColor={colors.secondaryText}
                                        onFocus={() => setShowDropdown(!!searchQuery)}
                                    />

                                    <View className="absolute right-3 top-3">
                                        {loading ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Ionicons
                                                name="search"
                                                size={20}
                                                color={colors.secondaryText}
                                            />
                                        )}
                                    </View>
                                </View>

                                {/* Debug info */}
                                {__DEV__ && (
                                    <View style={{ marginTop: 4, padding: 8, backgroundColor: 'rgba(255,0,0,0.1)' }}>
                                        <Text style={{ fontSize: 10, color: 'red' }}>
                                            Debug: show={showDropdown.toString()}, query="{searchQuery}", filtered={filteredPlaceTypes.length}, total={placeTypes.length}
                                        </Text>
                                        <Text style={{ fontSize: 10, color: 'blue' }}>
                                            Loading: {loading.toString()}, Visible: {visible.toString()}
                                        </Text>
                                        {placeTypes.length > 0 && (
                                            <Text style={{ fontSize: 10, color: 'green' }}>
                                                Sample types: {placeTypes.slice(0, 3).map(t => t.label).join(', ')}
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* Force show dropdown for testing - REMOVE AFTER DEBUGGING */}
                                {__DEV__ && searchQuery && placeTypes.length > 0 && (
                                    <View
                                        style={{
                                            marginTop: 4,
                                            backgroundColor: 'yellow',
                                            padding: 8,
                                            borderRadius: 4,
                                        }}
                                    >
                                        <Text style={{ fontSize: 12, color: 'black' }}>
                                            FORCE TEST - Total types: {placeTypes.length}, Should show: {filteredPlaceTypes.length}
                                        </Text>
                                    </View>
                                )}

                                {/* Dropdown for suggestions */}
                                {(showDropdown && filteredPlaceTypes.length > 0) && (
                                    <View
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            marginTop: 4,
                                            maxHeight: 160,
                                            backgroundColor: colors.surface,
                                            borderColor: colors.border,
                                            borderWidth: 1,
                                            borderRadius: 8,
                                            zIndex: 1001,
                                            elevation: 15,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.3,
                                            shadowRadius: 5,
                                        }}
                                    >
                                        {filteredPlaceTypes.slice(0, 6).map((type) => (
                                            <Pressable
                                                key={type.value}
                                                style={{
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 12,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: colors.border
                                                }}
                                                onPress={() => {
                                                    console.log('🏷️ Selected:', type.label);
                                                    togglePlaceType(type);
                                                }}
                                            >
                                                <Text style={styles.text}>{type.label}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}

                                {/* TEST: Always show first 3 types when searching - REMOVE AFTER DEBUGGING */}
                                {__DEV__ && searchQuery && placeTypes.length > 0 && (
                                    <View
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            marginTop: 60, // Below the yellow test box
                                            backgroundColor: 'lightblue',
                                            borderWidth: 2,
                                            borderColor: 'blue',
                                            borderRadius: 8,
                                            zIndex: 1002,
                                            elevation: 20,
                                        }}
                                    >
                                        <Text style={{ padding: 8, fontWeight: 'bold', color: 'black' }}>
                                            TEST DROPDOWN (remove after debug):
                                        </Text>
                                        {placeTypes.slice(0, 3).map((type) => (
                                            <Pressable
                                                key={`test-${type.value}`}
                                                style={{
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 8,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: 'blue'
                                                }}
                                                onPress={() => {
                                                    console.log('🧪 TEST Selected:', type.label);
                                                    togglePlaceType(type);
                                                }}
                                            >
                                                <Text style={{ color: 'black' }}>{type.label}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Transport Method */}
                        <View className="mb-6">
                            <Text className="text-lg font-bold mb-2" style={styles.text}>Transport Method</Text>
                            <View style={[styles.input, { borderColor: colors.border, borderWidth: 1, borderRadius: 8 }]}>
                                <Picker
                                    selectedValue={transportMethod}
                                    onValueChange={setTransportMethod}
                                    style={{ color: colors.text }}
                                >
                                    <Picker.Item label="Walking" value={TransportMethod.WALKING} />
                                    <Picker.Item label="Wheelchair" value={TransportMethod.WHEELCHAIR} />
                                    <Picker.Item label="Public Transport" value={TransportMethod.PUBLIC_TRANSPORT} />
                                    <Picker.Item label="Car" value={TransportMethod.CAR} />
                                </Picker>
                            </View>
                        </View>

                        {/* Budget */}
                        <View className="mb-6">
                            <Text className="text-lg font-bold mb-2" style={styles.text}>Budget</Text>
                            <View style={[styles.input, { borderColor: colors.border, borderWidth: 1, borderRadius: 8 }]}>
                                <Picker
                                    selectedValue={budget}
                                    onValueChange={setBudget}
                                    style={{ color: colors.text }}
                                >
                                    <Picker.Item label="Free" value={Budget.FREE} />
                                    <Picker.Item label="Low (€)" value={Budget.LOW} />
                                    <Picker.Item label="Medium (€€)" value={Budget.MEDIUM} />
                                    <Picker.Item label="High (€€€)" value={Budget.HIGH} />
                                </Picker>
                            </View>
                        </View>

                        {/* Search Radius */}
                        <View className="mb-6">
                            <Text className="text-lg font-bold mb-2" style={styles.text}>Search Radius</Text>
                            <View style={[styles.input, { borderColor: colors.border, borderWidth: 1, borderRadius: 8 }]}>
                                <Picker
                                    selectedValue={searchRadius}
                                    onValueChange={setSearchRadius}
                                    style={{ color: colors.text }}
                                >
                                    <Picker.Item label="1 km" value={1} />
                                    <Picker.Item label="2 km" value={2} />
                                    <Picker.Item label="5 km" value={5} />
                                    <Picker.Item label="10 km" value={10} />
                                    <Picker.Item label="20 km" value={20} />
                                    <Picker.Item label="50 km" value={50} />
                                </Picker>
                            </View>
                        </View>

                        {/* Accessibility Requirements */}
                        <View className="mb-8">
                            <Text className="text-lg font-bold mb-4" style={styles.text}>Accessibility Requirements</Text>

                            <View className="space-y-4">
                                <View className="flex-row justify-between items-center py-2">
                                    <Text style={styles.text}>Wheelchair Accessible</Text>
                                    <Switch
                                        value={wheelchairAccessible}
                                        onValueChange={setWheelchairAccessible}
                                        thumbColor={wheelchairAccessible ? colors.primary : colors.surface}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                    />
                                </View>

                                <View className="flex-row justify-between items-center py-2">
                                    <Text style={styles.text}>Has Elevator</Text>
                                    <Switch
                                        value={hasElevator}
                                        onValueChange={setHasElevator}
                                        thumbColor={hasElevator ? colors.primary : colors.surface}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                    />
                                </View>

                                <View className="flex-row justify-between items-center py-2">
                                    <Text style={styles.text}>Has Ramp</Text>
                                    <Switch
                                        value={hasRamp}
                                        onValueChange={setHasRamp}
                                        thumbColor={hasRamp ? colors.primary : colors.surface}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                    />
                                </View>

                                <View className="flex-row justify-between items-center py-2">
                                    <Text style={styles.text}>Accessible Bathroom</Text>
                                    <Switch
                                        value={hasAccessibleBathroom}
                                        onValueChange={setHasAccessibleBathroom}
                                        thumbColor={hasAccessibleBathroom ? colors.primary : colors.surface}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                    />
                                </View>

                                <View className="flex-row justify-between items-center py-2">
                                    <Text style={styles.text}>Wide Doors</Text>
                                    <Switch
                                        value={hasWideDoors}
                                        onValueChange={setHasWideDoors}
                                        thumbColor={hasWideDoors ? colors.primary : colors.surface}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Save Button */}
                        <Pressable
                            className="py-4 rounded-lg mb-8"
                            style={{ backgroundColor: colors.primary }}
                            onPress={savePreferences}
                        >
                            <Text className="text-center text-white font-semibold text-lg">
                                Save Preferences
                            </Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

export default PreferencesModal; 