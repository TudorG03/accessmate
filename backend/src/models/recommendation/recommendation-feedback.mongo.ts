import mongoose, { Document, Schema } from "mongoose";

export interface IRecommendationFeedback extends Document {
  userId: mongoose.Types.ObjectId;
  recommendationId?: mongoose.Types.ObjectId; // reference to cached recommendation (optional)
  placeId: string; // Google Places ID
  placeName: string;
  placeTypes: string[];
  action: "viewed" | "visited" | "dismissed" | "saved" | "shared" | "clicked"; // user action
  feedback: {
    explicit?: {
      rating?: number; // 1-5 star rating
      liked?: boolean; // thumbs up/down
      comment?: string; // user comment
    };
    implicit: {
      dwellTime?: number; // time spent viewing recommendation (seconds)
      clickDepth?: number; // how many details they explored
      sessionPosition?: number; // position in recommendation list
    };
  };
  context: {
    userLocation: {
      type: string;
      coordinates: number[]; // [longitude, latitude] when action occurred
    };
    timestamp: Date;
    timeOfDay: number; // hour of day (0-23)
    dayOfWeek: number; // day of week (0-6)
    deviceType?: "mobile" | "tablet" | "desktop";
    sessionId?: string; // to group related actions
  };
  outcome?: {
    actualVisit?: {
      confirmed: boolean; // did they actually visit the place
      visitDuration?: number; // minutes spent at location
      followUpActions?: string[]; // what they did after (review, photo, etc.)
    };
    satisfaction?: {
      score: number; // 1-5 satisfaction with recommendation
      wouldRecommend?: boolean; // would recommend to others
    };
  };
  metadata: {
    recommendationScore?: number; // original ML score
    recommendationReasoning?: string[]; // why it was recommended
    userProfileVersion?: number; // version of user profile when recommended
    modelVersion?: string; // ML model version used
  };
}

const explicitFeedbackSchema = new Schema({
  rating: { 
    type: Number, 
    min: 1, 
    max: 5,
    validate: {
      validator: (rating: number) => Number.isInteger(rating) && rating >= 1 && rating <= 5,
      message: "Rating must be an integer between 1 and 5"
    }
  },
  liked: { type: Boolean },
  comment: { 
    type: String, 
    maxlength: 500,
    trim: true
  },
}, { _id: false });

const implicitFeedbackSchema = new Schema({
  dwellTime: { 
    type: Number, 
    min: 0,
    validate: {
      validator: (time: number) => time >= 0,
      message: "Dwell time must be non-negative"
    }
  },
  clickDepth: { 
    type: Number, 
    min: 0,
    validate: {
      validator: (depth: number) => Number.isInteger(depth) && depth >= 0,
      message: "Click depth must be a non-negative integer"
    }
  },
  sessionPosition: { 
    type: Number, 
    min: 1,
    validate: {
      validator: (pos: number) => Number.isInteger(pos) && pos >= 1,
      message: "Session position must be a positive integer"
    }
  },
}, { _id: false });

const actualVisitSchema = new Schema({
  confirmed: { type: Boolean, required: true },
  visitDuration: { 
    type: Number, 
    min: 0,
    validate: {
      validator: (duration: number) => duration >= 0,
      message: "Visit duration must be non-negative"
    }
  },
  followUpActions: { type: [String], default: [] },
}, { _id: false });

const satisfactionSchema = new Schema({
  score: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5,
    validate: {
      validator: (score: number) => Number.isInteger(score) && score >= 1 && score <= 5,
      message: "Satisfaction score must be an integer between 1 and 5"
    }
  },
  wouldRecommend: { type: Boolean },
}, { _id: false });

const contextSchema = new Schema({
  userLocation: {
    type: { type: String, enum: ["Point"], default: "Point", required: true },
    coordinates: { type: [Number], required: true },
  },
  timestamp: { type: Date, required: true, default: Date.now },
  timeOfDay: { 
    type: Number, 
    required: true,
    validate: {
      validator: (hour: number) => Number.isInteger(hour) && hour >= 0 && hour <= 23,
      message: "timeOfDay must be an integer between 0 and 23"
    }
  },
  dayOfWeek: { 
    type: Number, 
    required: true,
    validate: {
      validator: (day: number) => Number.isInteger(day) && day >= 0 && day <= 6,
      message: "dayOfWeek must be an integer between 0 and 6"
    }
  },
  deviceType: { 
    type: String, 
    enum: ["mobile", "tablet", "desktop"],
    lowercase: true
  },
  sessionId: { 
    type: String,
    trim: true,
    maxlength: 100
  },
}, { _id: false });

const metadataSchema = new Schema({
  recommendationScore: { 
    type: Number, 
    min: 0, 
    max: 1,
    validate: {
      validator: (score: number) => score >= 0 && score <= 1,
      message: "Recommendation score must be between 0 and 1"
    }
  },
  recommendationReasoning: { type: [String], default: [] },
  userProfileVersion: { 
    type: Number, 
    min: 1,
    validate: {
      validator: (version: number) => Number.isInteger(version) && version >= 1,
      message: "User profile version must be a positive integer"
    }
  },
  modelVersion: { 
    type: String,
    trim: true,
    maxlength: 50
  },
}, { _id: false });

const recommendationFeedbackSchema: Schema = new Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  recommendationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "RecommendationCache"
  },
  placeId: { 
    type: String, 
    required: true,
    trim: true
  },
  placeName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  placeTypes: { 
    type: [String], 
    required: true,
    validate: {
      validator: (types: string[]) => types.length > 0,
      message: "At least one place type is required"
    }
  },
  action: { 
    type: String, 
    required: true,
    enum: ["viewed", "visited", "dismissed", "saved", "shared", "clicked"],
    lowercase: true
  },
  feedback: {
    explicit: explicitFeedbackSchema,
    implicit: {
      type: implicitFeedbackSchema,
      required: true
    },
  },
  context: {
    type: contextSchema,
    required: true
  },
  outcome: {
    actualVisit: actualVisitSchema,
    satisfaction: satisfactionSchema,
  },
  metadata: {
    type: metadataSchema,
    default: {}
  },
}, {
  timestamps: true,
  collection: "recommendation_feedback"
});

// Indexes for efficient queries
recommendationFeedbackSchema.index({ userId: 1, action: 1 });
recommendationFeedbackSchema.index({ placeId: 1 });
recommendationFeedbackSchema.index({ "context.timestamp": 1 });
recommendationFeedbackSchema.index({ userId: 1, "context.timestamp": -1 });
recommendationFeedbackSchema.index({ action: 1, "context.timestamp": -1 });
recommendationFeedbackSchema.index({ "context.userLocation": "2dsphere" });
recommendationFeedbackSchema.index({ recommendationId: 1 });

// Compound index for analytics queries
recommendationFeedbackSchema.index({ 
  userId: 1, 
  action: 1, 
  "context.timeOfDay": 1, 
  "context.dayOfWeek": 1 
});

// Static method to get user feedback statistics
recommendationFeedbackSchema.statics.getUserFeedbackStats = function(userId: string) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: "$action",
        count: { $sum: 1 },
        avgRating: { $avg: "$feedback.explicit.rating" },
        avgSatisfaction: { $avg: "$outcome.satisfaction.score" },
        avgDwellTime: { $avg: "$feedback.implicit.dwellTime" }
      }
    },
    {
      $group: {
        _id: null,
        totalActions: { $sum: "$count" },
        actionBreakdown: {
          $push: {
            action: "$_id",
            count: "$count",
            avgRating: "$avgRating",
            avgSatisfaction: "$avgSatisfaction",
            avgDwellTime: "$avgDwellTime"
          }
        }
      }
    }
  ]);
};

// Static method to get place feedback summary
recommendationFeedbackSchema.statics.getPlaceFeedbackSummary = function(placeId: string) {
  return this.aggregate([
    { $match: { placeId } },
    {
      $group: {
        _id: null,
        totalFeedback: { $sum: 1 },
        avgRating: { $avg: "$feedback.explicit.rating" },
        avgSatisfaction: { $avg: "$outcome.satisfaction.score" },
        visitConfirmationRate: {
          $avg: { $cond: [{ $eq: ["$outcome.actualVisit.confirmed", true] }, 1, 0] }
        },
        actionCounts: {
          $push: {
            action: "$action",
            timestamp: "$context.timestamp"
          }
        }
      }
    },
    {
      $addFields: {
        actionBreakdown: {
          $reduce: {
            input: "$actionCounts",
            initialValue: {},
            in: {
              $mergeObjects: [
                "$$value",
                {
                  $arrayToObject: [[{
                    k: "$$this.action",
                    v: { $add: [{ $ifNull: [{ $getField: { field: "$$this.action", input: "$$value" } }, 0] }, 1] }
                  }]]
                }
              ]
            }
          }
        }
      }
    }
  ]);
};

// Instance method to check if feedback is positive
recommendationFeedbackSchema.methods.isPositiveFeedback = function(): boolean {
  const positiveActions = ["visited", "saved", "shared"];
  const explicitPositive = this.feedback.explicit?.liked === true || 
                          (this.feedback.explicit?.rating && this.feedback.explicit.rating >= 4);
  const satisfactionPositive = this.outcome?.satisfaction?.score && this.outcome.satisfaction.score >= 4;
  
  return positiveActions.includes(this.action) || explicitPositive || satisfactionPositive;
};

// Instance method to get feedback weight for learning
recommendationFeedbackSchema.methods.getFeedbackWeight = function(): number {
  // Weight feedback based on action type and recency
  const actionWeights = {
    visited: 1.0,
    saved: 0.8,
    shared: 0.7,
    clicked: 0.5,
    viewed: 0.3,
    dismissed: 0.6 // negative feedback is valuable
  };
  
  const baseWeight = actionWeights[this.action as keyof typeof actionWeights] || 0.1;
  
  // Decay weight based on age (more recent feedback is more valuable)
  const ageInDays = (Date.now() - this.context.timestamp.getTime()) / (1000 * 60 * 60 * 24);
  const decayFactor = Math.exp(-ageInDays / 30); // 30-day half-life
  
  return baseWeight * decayFactor;
};

export default mongoose.model<IRecommendationFeedback>("RecommendationFeedback", recommendationFeedbackSchema); 