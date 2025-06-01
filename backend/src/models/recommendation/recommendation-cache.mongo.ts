import mongoose, { Document, Schema } from "mongoose";

export interface IRecommendationCache extends Document {
  userId: mongoose.Types.ObjectId;
  cacheKey: string; // unique identifier based on location, time, and user preferences
  recommendations: Array<{
    placeId: string;
    placeName: string;
    placeTypes: string[];
    location: {
      type: string;
      coordinates: number[]; // [longitude, latitude]
    };
    score: number; // recommendation score (0-1)
    reasoning: string[]; // why this was recommended
    googlePlaceData?: {
      rating?: number;
      priceLevel?: number;
      vicinity?: string;
      openingHours?: {
        openNow: boolean;
        periods?: Array<{
          open: { day: number; time: string };
          close?: { day: number; time: string };
        }>;
      };
    };
  }>;
  requestContext: {
    userLocation: {
      type: string;
      coordinates: number[]; // [longitude, latitude]
    };
    radius: number; // search radius in meters
    timestamp: Date; // when the request was made
    timeOfDay: number; // hour of day (0-23)
    dayOfWeek: number; // day of week (0-6)
  };
  generatedAt: Date;
  expiresAt: Date;
  hitCount: number; // how many times this cache was accessed
  lastAccessed: Date;
}

const googlePlaceDataSchema = new Schema({
  rating: { type: Number, min: 0, max: 5 },
  priceLevel: { type: Number, min: 0, max: 4 },
  vicinity: { type: String },
  openingHours: {
    openNow: { type: Boolean },
    periods: [{
      open: {
        day: { type: Number, min: 0, max: 6 },
        time: { type: String }
      },
      close: {
        day: { type: Number, min: 0, max: 6 },
        time: { type: String }
      }
    }]
  }
}, { _id: false });

const recommendationItemSchema = new Schema({
  placeId: { type: String, required: true },
  placeName: { type: String, required: true },
  placeTypes: { type: [String], required: true },
  location: {
    type: { type: String, enum: ["Point"], default: "Point", required: true },
    coordinates: { type: [Number], required: true },
  },
  score: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 1,
    validate: {
      validator: (score: number) => score >= 0 && score <= 1,
      message: "Score must be between 0 and 1"
    }
  },
  reasoning: { type: [String], default: [] },
  googlePlaceData: googlePlaceDataSchema,
}, { _id: false });

const requestContextSchema = new Schema({
  userLocation: {
    type: { type: String, enum: ["Point"], default: "Point", required: true },
    coordinates: { type: [Number], required: true },
  },
  radius: { type: Number, required: true, min: 100, max: 50000 }, // 100m to 50km
  timestamp: { type: Date, required: true },
  timeOfDay: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 23,
    validate: {
      validator: (hour: number) => Number.isInteger(hour) && hour >= 0 && hour <= 23,
      message: "timeOfDay must be an integer between 0 and 23"
    }
  },
  dayOfWeek: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 6,
    validate: {
      validator: (day: number) => Number.isInteger(day) && day >= 0 && day <= 6,
      message: "dayOfWeek must be an integer between 0 and 6"
    }
  },
}, { _id: false });

const recommendationCacheSchema: Schema = new Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  cacheKey: { 
    type: String, 
    required: true,
    unique: true 
  },
  recommendations: {
    type: [recommendationItemSchema],
    validate: {
      validator: (recommendations: unknown[]) => recommendations.length <= 50,
      message: "Cannot cache more than 50 recommendations"
    }
  },
  requestContext: {
    type: requestContextSchema,
    required: true
  },
  generatedAt: { type: Date, default: Date.now },
  expiresAt: { 
    type: Date, 
    required: true,
    default: () => new Date(Date.now() + 30 * 60 * 1000) // 30 minutes default
  },
  hitCount: { type: Number, default: 0 },
  lastAccessed: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: "recommendation_cache"
});

// Indexes for efficient queries
recommendationCacheSchema.index({ userId: 1, cacheKey: 1 });
recommendationCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
recommendationCacheSchema.index({ "requestContext.userLocation": "2dsphere" });
recommendationCacheSchema.index({ generatedAt: 1 });
recommendationCacheSchema.index({ lastAccessed: 1 });

// Pre-save middleware to update lastAccessed when hit count increases
recommendationCacheSchema.pre('save', function(next) {
  if (this.isModified('hitCount') && !this.isNew) {
    this.lastAccessed = new Date();
  }
  next();
});

// Static method to generate cache key
recommendationCacheSchema.statics.generateCacheKey = function(
  userId: string, 
  location: number[], 
  radius: number, 
  timeOfDay: number, 
  dayOfWeek: number
): string {
  // Round location to reduce cache key variations
  const roundedLat = Math.round(location[1] * 1000) / 1000; // 3 decimal places
  const roundedLng = Math.round(location[0] * 1000) / 1000;
  const roundedRadius = Math.round(radius / 500) * 500; // Round to nearest 500m
  
  return `${userId}_${roundedLng}_${roundedLat}_${roundedRadius}_${timeOfDay}_${dayOfWeek}`;
};

// Instance method to check if cache is expired
recommendationCacheSchema.methods.isExpired = function(): boolean {
  return this.expiresAt < new Date();
};

// Instance method to check if cache is fresh (less than 15 minutes old)
recommendationCacheSchema.methods.isFresh = function(): boolean {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  return this.generatedAt > fifteenMinutesAgo;
};

// Instance method to increment hit count
recommendationCacheSchema.methods.recordHit = function(): Promise<IRecommendationCache> {
  this.hitCount += 1;
  return this.save();
};

// Static method to cleanup expired cache entries
recommendationCacheSchema.statics.cleanupExpired = function(): Promise<any> {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to get cache statistics
recommendationCacheSchema.statics.getCacheStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        totalHits: { $sum: "$hitCount" },
        avgHitsPerEntry: { $avg: "$hitCount" },
        oldestEntry: { $min: "$generatedAt" },
        newestEntry: { $max: "$generatedAt" }
      }
    }
  ]);
};

export default mongoose.model<IRecommendationCache>("RecommendationCache", recommendationCacheSchema); 