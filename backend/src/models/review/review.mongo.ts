import mongoose, { Schema, Document } from "mongoose";

export interface IReview extends Document {
    userId: mongoose.Types.ObjectId;
    location: {
        latitude: number;
        longitude: number;
    };
    locationName: string;
    generalRating: number;
    accessibilityRating: number;
    description: string;
    images: string[];
    questions: {
        ramp: boolean;
        wideDoors: boolean;
        elevator: boolean;
        adaptedToilets: boolean;
    };
}

const reviewSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    locationName: { type: String, required: true },
    generalRating: { type: Number, required: true, min: 1, max: 5 },
    accessibilityRating: { type: Number, required: true, min: 1, max: 5 },
    description: { type: String },
    images: [{ type: String }],
    questions: {
        ramp: { type: String },
        wideDoors: { type: String },
        elevator: { type: String },
        adaptedToilets: { type: String }
    }
});

export default mongoose.model<IReview>("Review", reviewSchema);
