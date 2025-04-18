// Database connection configuration
import mongoose from "npm:mongoose@^6.7";
import { config } from "https://deno.land/x/dotenv/mod.ts";

// Load environment variables
const env = config();

// Get MongoDB connection string from environment or use default
const MONGODB_URI = env.MONGO_URI || "mongodb://localhost:27017/accessmate";

// Connect to MongoDB
export async function connect() {
  try {
    console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

// Close MongoDB connection
export async function disconnect() {
  try {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("MongoDB disconnection error:", error);
  }
}

export default { connect, disconnect };
