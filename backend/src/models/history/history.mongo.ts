import mongoose, { Schema, Document } from "mongoose";

export interface IHistory extends Document {
    userId: mongoose.Types.ObjectId;
    activities: mongoose.Types.ObjectId[];
    preferences: {
        activityTypes: string[];
        transportMethod: string;
        budget: string;
        baseLocation: {
            latitude: number;
            longitude: number;
        };
    };
}

const historySchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    activities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Activity", required: true }],
    preferences: {
        activityTypes: { type: [String], default: [] },
        transportMethod: { type: String, required: true },
        budget: { type: String, required: true },
        baseLocation: {
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true }
        }
    }
});

export default mongoose.model<IHistory>("History", historySchema);
