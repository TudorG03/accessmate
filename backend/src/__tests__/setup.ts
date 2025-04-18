import { config } from "https://deno.land/x/dotenv@v3.2.0/mod.ts";
import { MongoClient } from "https://deno.land/x/mongo@v0.31.1/mod.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

// Load test environment variables
const env = await config({
  path: "./.env.test",
  export: true,
});

// Validate required environment variables
const requiredEnvVars = [
  "MONGODB_TEST_URI",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
  "PORT",
  "COOKIE_SECRET",
  "BCRYPT_SALT_ROUNDS",
  "TEST_MODE",
];

for (const envVar of requiredEnvVars) {
  if (!env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

console.log("Environment loaded:", {
  hasMongoUri: !!env.MONGODB_TEST_URI,
  testMode: env.TEST_MODE,
  mongoUri: env.MONGODB_TEST_URI
});

// Use the same database as the main application
const MONGODB_URI = env.MONGODB_TEST_URI;
if (!MONGODB_URI) {
  throw new Error(
    "MONGODB_TEST_URI environment variable is not set in .env.test file",
  );
}

const TEST_MODE = env.TEST_MODE === "true";

console.log("Connecting to MongoDB Atlas...");

// Test data
export const testUsers = {
  admin: {
    email: "test_admin@test.com",
    password: "admin123",
    displayName: "Test Admin User",
    role: "admin",
  },
  moderator: {
    email: "test_moderator@test.com",
    password: "mod123",
    displayName: "Test Moderator User",
    role: "moderator",
  },
  user: {
    email: "test_user@test.com",
    password: "user123",
    displayName: "Test Regular User",
    role: "user",
  },
};

// MongoDB connection helper
async function connectToMongoDB() {
  const client = new MongoClient();
  try {
    console.log("Connecting to MongoDB Atlas...");
    await client.connect(env.MONGODB_TEST_URI as string);
    console.log("Successfully connected to MongoDB Atlas");
    return client;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

// Create a test user
export async function createTestUser(userData: typeof testUsers.admin) {
  let client: MongoClient | null = null;
  try {
    client = await connectToMongoDB();
    const db = client.database();
    const users = db.collection("users");

    // Add test prefix to email to avoid conflicts
    const testUser = {
      ...userData,
      email: `test_${Date.now()}_${userData.email}`,
    };

    console.log(`Creating test user: ${testUser.email}`);
    const result = await users.insertOne(testUser);
    console.log(`Created test user with ID: ${result.$oid}`);
    return result;
  } catch (error) {
    console.error("Failed to create test user:", error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Clean up test database
export async function cleanupTestDatabase() {
  if (env.TEST_MODE !== "true") {
    throw new Error("Tests must be run in test mode");
  }

  let client: MongoClient | null = null;
  try {
    client = await connectToMongoDB();
    const db = client.database();
    const users = db.collection("users");

    console.log("Cleaning up test users...");
    const result = await users.deleteMany({ email: /^test_/ });
    console.log(`Deleted ${result} test users`);
    return result;
  } catch (error) {
    console.error("Failed to clean up test database:", error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Helper function for authenticated requests
export async function makeAuthenticatedRequest(
  url: string,
  method: string,
  token: string,
  body?: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

// Helper function for requests with cookies
export async function makeRequestWithCookies(
  url: string,
  method: string,
  cookies: string[],
  body?: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies.join("; "),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  return response;
}

// Export test utilities
export { assertEquals, assertExists };
