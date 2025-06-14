export enum UserRole {
  USER = "user",
  MODERATOR = "moderator",
  ADMIN = "admin",
}

export enum TransportMethod {
  WHEELCHAIR = "wheelchair",
  WALKING = "walking",
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
  hasWideDoors?: boolean;
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
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
