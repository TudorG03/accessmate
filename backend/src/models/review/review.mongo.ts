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
  accessiblityScore: number,
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
    ramp: { type: String },
    wideDoors: { type: String },
    elevator: { type: String },
    adaptedToilets: { type: String },
  },
}, {
  timestamps: true,
});

export default mongoose.model<IReview>("Review", reviewSchema);
