import mongoose, { Document, Schema } from "mongoose";

export interface INavigationHistory extends Document {
  userId: mongoose.Types.ObjectId;
  placeId: string;
  placeName: string;
  placeTypes: string[];
  location: {
    type: string;
    coordinates: number[];
  };
  timestamp: Date;
}

const navigationHistorySchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  placeId: { type: String, required: true },
  placeName: { type: String, required: true },
  placeTypes: { type: [String], required: true },
  location: {
    type: { type: String, enum: ["Point"], default: "Point", required: true },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
  },
  timestamp: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Index for efficient queries
navigationHistorySchema.index({ userId: 1, placeTypes: 1 });

// Add a 2dsphere index on the location field for geospatial queries
navigationHistorySchema.index({ location: "2dsphere" });

export default mongoose.model<INavigationHistory>(
  "NavigationHistory",
  navigationHistorySchema,
);
