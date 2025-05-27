import mongoose from "npm:mongoose@^6.7";

export interface IMarker {
  userId: mongoose.Types.ObjectId;
  location: {
    latitude: number;
    longitude: number;
  };
  obstacleType: string;
  obstacleScore: number;
  notThere: number;
  description?: string;
  images?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  distance?: number;
}

const markerSchema = new mongoose.Schema<IMarker>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  location: {
    latitude: {
      type: Number,
      required: true,
      validate: {
        validator: function (v: number) {
          return v >= -90 && v <= 90;
        },
        message: "Latitude must be between -90 and 90 degrees",
      },
    },
    longitude: {
      type: Number,
      required: true,
      validate: {
        validator: function (v: number) {
          return v >= -180 && v <= 180;
        },
        message: "Longitude must be between -180 and 180 degrees",
      },
    },
  },
  obstacleType: { type: String, required: true },
  obstacleScore: { type: Number, default: 1 },
  notThere: { type: Number, default: 0 },
  description: { type: String },
  images: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IMarker>("Marker", markerSchema);
