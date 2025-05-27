# Location-Based Notification System

This system provides comprehensive location tracking and notification
capabilities for the AccessMate app. It automatically tracks user location and
triggers notifications when users enter specific geographical areas.

## ✨ Features

- **Continuous Location Tracking**: Automatically tracks user location in
  real-time
- **Geofencing Notifications**: Trigger notifications when users enter defined
  areas
- **Smart Debouncing**: Prevents notification spam with intelligent timing
- **Background Processing**: Works seamlessly without blocking the UI
- **Accessibility Focus**: Optimized for accessibility-related notifications

## 🚀 Auto-Initialization

The system is automatically initialized when the app starts through the
`LocationProvider`:

1. **Fresh Location Fetch**: Gets current GPS location on every app start
2. **Continuous Tracking**: Starts background location tracking
3. **Notification Setup**: Initializes the notification monitoring system

## 📱 Usage Examples

### Basic Obstacle Alert

```typescript
import {
    addLocationNotification,
    createObstacleNotification,
} from "@/services/location-notifications.service";

// Add an obstacle alert
const obstacleLocation = { latitude: 44.4616, longitude: 26.0731 };
const notification = createObstacleNotification(
    obstacleLocation,
    "Construction barrier",
);
addLocationNotification(notification);
```

### Destination Proximity Alert

```typescript
import {
    addLocationNotification,
    createDestinationNotification,
} from "@/services/location-notifications.service";

// Alert when approaching destination
const destinationLocation = { latitude: 44.4616, longitude: 26.0731 };
const notification = createDestinationNotification(
    destinationLocation,
    "Metro Station",
);
addLocationNotification(notification);
```

### Custom Notification

```typescript
import {
    addLocationNotification,
    LocationNotificationConfig,
} from "@/services/location-notifications.service";

const customNotification: LocationNotificationConfig = {
    id: "custom-alert-1",
    title: "Accessible Entrance Nearby",
    body:
        "There is a wheelchair-accessible entrance 50 meters ahead on your right.",
    triggerRadius: 75, // meters
    targetLocation: { latitude: 44.4616, longitude: 26.0731 },
    categoryId: "location-based",
    data: {
        type: "accessibility",
        entranceType: "wheelchair-ramp",
        direction: "right",
    },
};

addLocationNotification(customNotification);
```

## 🎯 Use Cases for AccessMate

### 1. Obstacle Warnings

```typescript
// When user reports an obstacle, notify others approaching it
const reportObstacle = (location: MarkerLocation, obstacleType: string) => {
    const notification = createObstacleNotification(location, obstacleType);
    addLocationNotification(notification);
};
```

### 2. Navigation Assistance

```typescript
// During navigation, alert about upcoming waypoints
const addNavigationAlert = (waypoint: MarkerLocation, description: string) => {
    const notification: LocationNotificationConfig = {
        id: `nav-${Date.now()}`,
        title: "Navigation Alert",
        body: description,
        triggerRadius: 50,
        targetLocation: waypoint,
        data: { type: "navigation" },
    };
    addLocationNotification(notification);
};
```

### 3. Accessibility Features

```typescript
// Alert about nearby accessible facilities
const addAccessibilityAlert = (
    location: MarkerLocation,
    facilityType: string,
) => {
    const notification: LocationNotificationConfig = {
        id: `access-${Date.now()}`,
        title: "Accessible Facility Nearby",
        body: `${facilityType} available nearby`,
        triggerRadius: 100,
        targetLocation: location,
        data: { type: "accessibility", facilityType },
    };
    addLocationNotification(notification);
};
```

## 🔧 API Reference

### Core Functions

#### `addLocationNotification(config: LocationNotificationConfig)`

Adds a new location-based notification trigger.

#### `removeLocationNotification(id: string)`

Removes a specific notification trigger.

#### `clearAllLocationNotifications()`

Removes all active notification triggers.

### Configuration Types

```typescript
interface LocationNotificationConfig {
    id: string; // Unique identifier
    title: string; // Notification title
    body: string; // Notification message
    triggerRadius: number; // Trigger distance in meters
    targetLocation: MarkerLocation; // Target coordinates
    categoryId?: string; // Notification category
    data?: Record<string, any>; // Custom data payload
}
```

### Helper Functions

#### `createObstacleNotification(location, obstacleType)`

Creates a pre-configured obstacle warning notification.

#### `createDestinationNotification(location, destinationName)`

Creates a pre-configured destination proximity notification.

## ⚙️ Configuration

### Trigger Radius Guidelines

- **Obstacles**: 50-75 meters (gives time to react)
- **Destinations**: 100-150 meters (advance notice)
- **Accessibility Features**: 75-100 meters (discovery range)

### Debouncing

- **Minimum Interval**: 5 minutes between same notification triggers
- **Prevents Spam**: Automatic duplicate prevention
- **Smart Timing**: Only triggers when meaningful

## 📊 Monitoring

The system provides detailed logging:

```
🔔 LocationNotificationService: Initializing...
🔔 Starting location monitoring for notifications...
🔔 Adding location trigger: obstacle-123 at 44.4616, 26.0731
🔔 Location update received: 44.4615, 26.0730
🔔 Triggering location notification: obstacle-123
✅ Location notification sent: Accessibility Alert
```

## 🔄 Integration with Existing Systems

The notification system integrates seamlessly with:

- **Location Store**: Automatically receives location updates
- **Navigation System**: Can add waypoint notifications
- **Obstacle Detection**: Can alert about reported obstacles
- **User Preferences**: Respects notification settings

## 🛠️ Advanced Usage

### Dynamic Notification Management

```typescript
import { locationNotificationService } from "@/services/location-notifications.service";

// Get all active triggers
const activeTriggers = locationNotificationService.getActiveTriggers();

// Temporarily disable a trigger
locationNotificationService.setTriggerActive("obstacle-123", false);

// Re-enable it later
locationNotificationService.setTriggerActive("obstacle-123", true);
```

### Custom Distance Calculations

The system uses the Haversine formula for accurate distance calculations between
geographical points, accounting for Earth's curvature.

## 🔔 Notification Categories

The system sets up notification categories with action buttons:

- **View Details**: Opens app to show more information
- **Dismiss**: Dismisses the notification

## 🎯 Best Practices

1. **Meaningful Radius**: Choose trigger distances that give users time to react
2. **Clear Messages**: Write concise, actionable notification text
3. **Unique IDs**: Use descriptive, unique identifiers for notifications
4. **Clean Up**: Remove notifications when no longer needed
5. **Test Thoroughly**: Test with different movement patterns and speeds

This system provides a solid foundation for implementing location-aware
accessibility features in your app!
