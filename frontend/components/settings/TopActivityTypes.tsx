import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import useAuth from "@/stores/auth/hooks/useAuth";
import api from "@/services/api.service";

interface TopActivityTypesProps {
    colors: any; // Theme colors
    styles: any; // Theme styles
}

interface ActivityEntry {
    type: string;
    count: number;
}

const TopActivityTypes: React.FC<TopActivityTypesProps> = ({ colors, styles }) => {
    const { user } = useAuth();
    const [topActivities, setTopActivities] = useState<ActivityEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchTopActivities = async () => {
            if (!user || !user.id) return;

            setLoading(true);
            try {
                // Fetch user's navigation history
                const response = await api.get(`/api/navigation-history/user/${user.id}`);

                if (response.data && response.data.history) {
                    // Process all place types to count frequency
                    const typeCounts: Record<string, number> = {};

                    response.data.history.forEach((entry: any) => {
                        if (entry.placeTypes && Array.isArray(entry.placeTypes)) {
                            entry.placeTypes.forEach((type: string) => {
                                typeCounts[type] = (typeCounts[type] || 0) + 1;
                            });
                        }
                    });
                    
                    // Convert to array, sort by count, and take top 5
                    const sortedActivities = Object.entries(typeCounts)
                        .map(([type, count]) => ({ type, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5);

                    setTopActivities(sortedActivities);
                }
            } catch (error) {
                console.error('Error fetching top activities:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTopActivities();
    }, [user]);

    // Format type string for display
    const formatActivityType = (type: string): string => {
        return type
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    if (loading) {
        return (
            <View className="p-4 rounded-lg mb-6" style={styles.card}>
                <Text className="text-lg font-bold mb-4" style={styles.text}>
                    Your Top Activities
                </Text>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    if (topActivities.length === 0) {
        return (
            <View className="p-4 rounded-lg mb-6" style={styles.card}>
                <Text className="text-lg font-bold mb-2" style={styles.text}>
                    Your Top Activities
                </Text>
                <Text style={styles.secondaryText}>No activity data yet. Start exploring!</Text>
            </View>
        );
    }

    return (
        <View className="p-4 rounded-lg mb-6" style={styles.card}>
            <Text className="text-lg font-bold mb-4" style={styles.text}>
                Your Top Activities
            </Text>

            {topActivities.map((activity, index) => (
                <View key={activity.type} className="flex-row items-center mb-3">
                    <View
                        className="w-8 h-8 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: colors.primary }}
                    >
                        <Text className="text-white font-bold">{index + 1}</Text>
                    </View>
                    <View className="flex-1">
                        <Text style={styles.text}>{formatActivityType(activity.type)}</Text>
                        <Text style={styles.secondaryText}>{activity.count} visits</Text>
                    </View>
                </View>
            ))}
        </View>
    );
};

export default TopActivityTypes; 