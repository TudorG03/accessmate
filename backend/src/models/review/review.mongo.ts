import mongoose, { Document, Schema } from "mongoose";

export interface IReview extends Document {
  userId: mongoose.Types.ObjectId;
  location: {
    latitude: number;
    longitude: number;
  };
  locationName: string;
  accessibilityRating: number;
  description: string;
  images: string[];
  accessibilityScore: number;
  questions: {
    ramp: boolean;
    wideDoors: boolean;
    elevator: boolean;
    adaptedToilets: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  locationName: { type: String, required: true },
  accessibilityRating: { type: Number, required: true, min: 1, max: 5 },
  description: { type: String },
  images: [{ type: String }],
  accessibilityScore: { type: Number, min: 1, max: 5 },
  questions: {
    ramp: { type: Boolean, default: null },
    wideDoors: { type: Boolean, default: null },
    elevator: { type: Boolean, default: null },
    adaptedToilets: { type: Boolean, default: null },
  },
}, {
  timestamps: true,
});

export default mongoose.model<IReview>("Review", reviewSchema);
