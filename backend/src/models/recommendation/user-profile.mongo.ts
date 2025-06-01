import mongoose, { Document, Schema } from "mongoose";

export interface IUserProfile extends Document {
  userId: mongoose.Types.ObjectId;
  categoryPreferences: Map<string, number>; // placeType -> preference score (0-1)
  temporalPreferences: {
    hourOfDay: number[]; // Array of 24 numbers (activity level by hour)
    dayOfWeek: number[]; // Array of 7 numbers (activity level by day)
  };
  locationPreferences: {
    preferredRadius: number; // in meters
    frequentAreas: Array<{
      center: {
        type: string;
        coordinates: number[]; // [longitude, latitude]
      };
      visitCount: number;
      radius: number; // in meters
    }>;
  };
  totalVisits: number;
  lastUpdated: Date;
  version: number; // for handling concurrent updates
}

const frequentAreaSchema = new Schema({
  center: {
    type: { type: String, enum: ["Point"], default: "Point", required: true },
    coordinates: { type: [Number], required: true },
  },
  visitCount: { type: Number, required: true, default: 1 },
  radius: { type: Number, required: true, default: 1000 }, // 1km default
}, { _id: false });

const userProfileSchema: Schema = new Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    unique: true 
  },
  categoryPreferences: {
    type: Map,
    of: Number,
    default: new Map(),
  },
  temporalPreferences: {
    hourOfDay: { 
      type: [Number], 
      default: () => new Array(24).fill(0),
      validate: {
        validator: (arr: number[]) => arr.length === 24,
        message: "hourOfDay must have exactly 24 elements"
      }
    },
    dayOfWeek: { 
      type: [Number], 
      default: () => new Array(7).fill(0),
      validate: {
        validator: (arr: number[]) => arr.length === 7,
        message: "dayOfWeek must have exactly 7 elements"
      }
    },
  },
  locationPreferences: {
    preferredRadius: { type: Number, default: 5000 }, // 5km default
    frequentAreas: [frequentAreaSchema],
  },
  totalVisits: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
}, {
  timestamps: true,
  collection: "user_profiles"
});

// Indexes for efficient queries
userProfileSchema.index({ userId: 1 });
userProfileSchema.index({ lastUpdated: 1 });
userProfileSchema.index({ "locationPreferences.frequentAreas.center": "2dsphere" });

// Pre-save middleware to update lastUpdated and increment version
userProfileSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastUpdated = new Date();
    this.version += 1;
  }
  next();
});

// Method to check if profile needs update (older than 24 hours)
userProfileSchema.methods.needsUpdate = function(): boolean {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.lastUpdated < oneDayAgo;
};

// Method to get top preferred categories
userProfileSchema.methods.getTopCategories = function(limit = 5): string[] {
  const entries = Array.from(this.categoryPreferences.entries()) as [string, number][];
  const categories = entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(entry => entry[0]);
  
  return categories;
};

// Method to get active hours (above average activity)
userProfileSchema.methods.getActiveHours = function(): number[] {
  const avgActivity = this.temporalPreferences.hourOfDay.reduce((a: number, b: number) => a + b, 0) / 24;
  return this.temporalPreferences.hourOfDay
    .map((activity: number, hour: number) => ({ hour, activity }))
    .filter(({ activity }: { activity: number }) => activity > avgActivity)
    .map(({ hour }: { hour: number }) => hour);
};

export default mongoose.model<IUserProfile>("UserProfile", userProfileSchema); 