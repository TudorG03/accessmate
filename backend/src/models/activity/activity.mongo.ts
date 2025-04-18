import mongoose, { Schema, Document } from "mongoose";

export interface IActivity extends Document {
    name: string;
    date: Date;
    type: string;
    location: {
        latitude: number;
        longitude: number;
    };
    price: string;
    details: string;
}

const activitySchema: Schema = new Schema({
    name: { type: String, required: true },
    date: { type: Date, required: true },
    type: { type: String, required: true },
    location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    price: { type: String, required: true },
    details: { type: String, required: true }
});

export default mongoose.model<IActivity>("Activity", activitySchema);
