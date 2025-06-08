import mongoose from "npm:mongoose@^6.7";
import { load } from "https://deno.land/std/dotenv/mod.ts";

await load({ export: true });

const ADMIN_USER = Deno.env.get("MONGO_ATLAS_ADMIN_USER");
const ADMIN_PASS = Deno.env.get("MONGO_ATLAS_ADMIN_PASS");

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error("MongoDB credentials not found in environment variables");
  throw new Error("MongoDB credentials not found in environment variables");
}

const MONGO_ATLAS_CONNECTION_STRING =
  `mongodb+srv://${ADMIN_USER}:${ADMIN_PASS}@accessmate.cfvut.mongodb.net/?retryWrites=true&w=majority&appName=AccessMate`;

export default async function mongoConnect() {
  try {
    await mongoose.connect(MONGO_ATLAS_CONNECTION_STRING, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });
    console.log("Connected to MongoDB Atlas");
    return mongoose.connection;
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}
