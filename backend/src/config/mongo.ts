import mongoose from "npm:mongoose@^6.7";

// Try to load dotenv for local development, but don't fail if it doesn't work (like in Deno Deploy)
try {
  const { load } = await import("https://deno.land/std/dotenv/mod.ts");
  await load({ export: true });
} catch {
  // Dotenv loading failed - likely in production environment like Deno Deploy
  // Environment variables should be set directly in the deployment platform
  console.log("Dotenv not loaded - using environment variables directly");
}

const ADMIN_USER = Deno.env.get("MONGO_ATLAS_ADMIN_USER");
const ADMIN_PASS = Deno.env.get("MONGO_ATLAS_ADMIN_PASS");

console.log("Environment check:");
console.log("ADMIN_USER exists:", !!ADMIN_USER);
console.log("ADMIN_PASS exists:", !!ADMIN_PASS);

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error("MongoDB credentials not found in environment variables");
  console.error("Available env vars:", Object.keys(Deno.env.toObject()));
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
