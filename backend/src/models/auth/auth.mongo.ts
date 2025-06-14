import mongoose, { Document, Schema } from "npm:mongoose@^6.7";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  MODERATOR = "moderator",
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

export enum ActivityType {
  RESTAURANT = "restaurant",
  SHOPPING = "shopping",
  ENTERTAINMENT = "entertainment",
  CULTURE = "culture",
  SPORTS = "sports",
  EDUCATION = "education",
  HEALTHCARE = "healthcare",
  NATURE = "nature",
  OTHER = "other",
}

export enum DistanceUnit {
  KILOMETERS = "kilometers",
  MILES = "miles",
}

interface IUserPreferences {
  activityTypes: {
    value: string;
    label: string;
  }[];
  transportMethod: TransportMethod;
  budget: Budget;
  baseLocation: {
    latitude: number;
    longitude: number;
  };
  searchRadius: number;
  preferedUnit: DistanceUnit;
  accessibilityRequirements?: {
    wheelchairAccessible: boolean;
    hasElevator: boolean;
    hasRamp: boolean;
    hasAccessibleBathroom: boolean;
    hasWideDoors: boolean;
  };
}

export interface IUser extends Document {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  preferences: IUserPreferences;
  profilePicture?: string;
  refreshToken: string | null;
  refreshTokenExpiry: Date | null;
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    index: true,
  },
  password: {
    type: String,
    required: true,
    minlength: [8, "Password must be at least 8 characters long"],
    select: false, // Don't include password in queries by default
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, "Display name must be at least 2 characters long"],
    maxlength: [50, "Display name cannot exceed 50 characters"],
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER,
    index: true,
  },
  preferences: {
    activityTypes: {
      type: [{
        value: {
          type: String,
          required: true,
        },
        label: {
          type: String,
          required: true,
        },
      }],
      default: [],
      validate: {
        validator: function (v: { value: string; label: string }[]) {
          // Accept any string values instead of strict checking against enum
          return Array.isArray(v) &&
            v.every((item) =>
              typeof item === "object" &&
              typeof item.value === "string" &&
              typeof item.label === "string"
            );
        },
        message: "Each activity type must have a string value and label",
      },
    },
    transportMethod: {
      type: String,
      enum: Object.values(TransportMethod),
      default: TransportMethod.WHEELCHAIR,
    },
    budget: {
      type: String,
      enum: Object.values(Budget),
      default: Budget.FREE,
    },
    baseLocation: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90,
        default: 0,
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180,
        default: 0,
      },
    },
    searchRadius: {
      type: Number,
      default: 5,
      min: 1,
      max: 50,
    },
    preferedUnit: {
      type: String,
      enum: Object.values(DistanceUnit),
      default: DistanceUnit.KILOMETERS,
    },
    accessibilityRequirements: {
      wheelchairAccessible: { type: Boolean, default: false },
      hasElevator: { type: Boolean, default: false },
      hasRamp: { type: Boolean, default: false },
      hasAccessibleBathroom: { type: Boolean, default: false },
      hasWideDoors: { type: Boolean, default: false },
    },
  },
  profilePicture: {
    type: String,
    default: null,
  },
  refreshToken: {
    type: String,
    default: null,
  },
  refreshTokenExpiry: {
    type: Date,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true, // Cannot be modified after creation
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ "preferences.baseLocation": "2dsphere" });

userSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IUser>("User", userSchema);
