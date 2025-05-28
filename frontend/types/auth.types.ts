export enum UserRole {
  USER = "user",
  MODERATOR = "moderator",
  ADMIN = "admin",
}

export enum TransportMethod {
  WALKING = "walking",
  WHEELCHAIR = "wheelchair",
  PUBLIC_TRANSPORT = "public_transport",
  CAR = "car",
}

export enum Budget {
  FREE = "free",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}
export interface PlaceType {
  value: string;
  label: string;
}

export enum DistanceUnit {
  KILOMETERS = "kilometers",
  MILES = "miles",
}

interface BaseLocation {
  latitude: number;
  longitude: number;
}

interface AccessibilityRequirements {
  wheelchairAccessible?: boolean;
  hasElevator?: boolean;
  hasRamp?: boolean;
  hasAccessibleBathroom?: boolean;
}

export interface UserPreferences {
  activityTypes: PlaceType[];
  transportMethod: TransportMethod;
  budget: Budget;
  baseLocation: BaseLocation;
  searchRadius: number;
  preferedUnit: DistanceUnit;
  accessibilityRequirements?: AccessibilityRequirements;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  profilePicture?: string; // Base64 encoded image string
  role: UserRole;
  preferences: UserPreferences;
  isActive: boolean;
}
