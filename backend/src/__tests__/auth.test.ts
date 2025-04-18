import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { Application } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.208.0/testing/bdd.ts";
import {
  cleanupTestDatabase,
  createTestUser,
  makeAuthenticatedRequest,
  makeRequestWithCookies,
  testUsers,
} from "./setup.ts";
import authRouter from "../routes/auth/auth.router.ts";
import { config } from "https://deno.land/x/dotenv@v3.2.0/mod.ts";

// Load environment variables
const env = await config({
  path: "./.env.test",
  export: true,
});

// Test configuration
const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Test state
let app: Application;
let server: any;
let adminToken: string;
let moderatorToken: string;
let userToken: string;

// Server setup and teardown
beforeAll(async () => {
  try {
    console.log("Setting up test server...");

    // Initialize application
    app = new Application();
    console.log("Application initialized");

    // Add error handling middleware
    app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err: unknown) {
        console.error("Server error:", err);
        ctx.response.status = 500;
        ctx.response.body = {
          error: err instanceof Error
            ? err.message
            : "An unknown error occurred",
        };
      }
    });
    console.log("Error handling middleware added");

    // Add routes
    console.log("Adding auth routes...");
    app.use(authRouter.routes());
    app.use(authRouter.allowedMethods());
    console.log("Auth routes added successfully");

    // Start server with timeout
    console.log(`Starting server on port ${TEST_PORT}...`);
    server = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, 10000);

      // Add error handler for the server
      const serverPromise = app.listen({ port: TEST_PORT });

      serverPromise
        .then((server) => {
          clearTimeout(timeout);
          console.log("Server promise resolved");
          resolve(server);
        })
        .catch((error) => {
          clearTimeout(timeout);
          console.error("Server promise rejected:", error);
          reject(error);
        });
    });

    console.log("Test server started successfully");
  } catch (error) {
    console.error("Failed to start test server:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    throw error;
  }
});

afterAll(async () => {
  try {
    console.log("Shutting down test server...");
    if (server) {
      await server.close();
      console.log("Test server shut down successfully");
    }
  } catch (error) {
    console.error("Failed to shut down test server:", error);
    throw error;
  }
});

beforeEach(async () => {
  try {
    console.log("Cleaning up test database...");
    await cleanupTestDatabase();
    console.log("Test database cleaned up successfully");
  } catch (error) {
    console.error("Failed to clean up test database:", error);
    throw error;
  }
});

// Test suites
describe("Auth Endpoints", () => {
  // Registration tests
  describe("POST /auth/register", () => {
    it("should register a new user successfully", async () => {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newuser@test.com",
          password: "password123",
          displayName: "New User",
        }),
      });

      assertEquals(response.status, 201);
      const data = await response.json();
      assertExists(data.user);
      assertExists(data.token);
      assertEquals(data.user.role, "user");
    });

    it("should not register user with existing email", async () => {
      await createTestUser(testUsers.user);

      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testUsers.user),
      });

      assertEquals(response.status, 400);
      const data = await response.json();
      assertEquals(data.message, "User already exists");
    });
  });

  // Login tests
  describe("POST /auth/login", () => {
    it("should login successfully with correct credentials", async () => {
      await createTestUser(testUsers.user);

      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUsers.user.email,
          password: testUsers.user.password,
        }),
      });

      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.accessToken);
      assertExists(data.user);
      userToken = data.accessToken;
    });

    it("should not login with incorrect credentials", async () => {
      await createTestUser(testUsers.user);

      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUsers.user.email,
          password: "wrongpassword",
        }),
      });

      assertEquals(response.status, 401);
      const data = await response.json();
      assertEquals(data.message, "Invalid credentials");
    });
  });

  // User management tests
  describe("GET /auth", () => {
    it("should allow admin to get all users", async () => {
      const admin = await createTestUser(testUsers.admin);
      const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUsers.admin.email,
          password: testUsers.admin.password,
        }),
      });
      const loginData = await loginResponse.json();
      adminToken = loginData.accessToken;

      const response = await makeAuthenticatedRequest(
        `${BASE_URL}/auth`,
        "GET",
        adminToken,
      );

      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(Array.isArray(data.users), true);
    });

    it("should not allow regular user to get all users", async () => {
      const user = await createTestUser(testUsers.user);
      const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUsers.user.email,
          password: testUsers.user.password,
        }),
      });
      const loginData = await loginResponse.json();
      userToken = loginData.accessToken;

      const response = await makeAuthenticatedRequest(
        `${BASE_URL}/auth`,
        "GET",
        userToken,
      );

      assertEquals(response.status, 403);
    });
  });

  // Profile update tests
  describe("PUT /auth/update/:id", () => {
    it("should allow user to update own profile", async () => {
      const user = await createTestUser(testUsers.user);
      const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUsers.user.email,
          password: testUsers.user.password,
        }),
      });
      const loginData = await loginResponse.json();
      userToken = loginData.accessToken;

      const response = await makeAuthenticatedRequest(
        `${BASE_URL}/auth/update/${user.$oid}`,
        "PUT",
        userToken,
        {
          displayName: "Updated Name",
        },
      );

      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(data.user.displayName, "Updated Name");
    });

    it("should not allow user to update other user's profile", async () => {
      const admin = await createTestUser(testUsers.admin);
      const user = await createTestUser(testUsers.user);
      const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUsers.user.email,
          password: testUsers.user.password,
        }),
      });
      const loginData = await loginResponse.json();
      userToken = loginData.accessToken;

      const response = await makeAuthenticatedRequest(
        `${BASE_URL}/auth/update/${admin.$oid}`,
        "PUT",
        userToken,
        {
          displayName: "Unauthorized Update",
        },
      );

      assertEquals(response.status, 403);
    });
  });

  // Token refresh tests
  describe("POST /auth/refresh-token", () => {
    it("should refresh token successfully", async () => {
      await createTestUser(testUsers.user);
      const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUsers.user.email,
          password: testUsers.user.password,
        }),
      });
      const loginData = await loginResponse.json();
      const refreshToken = loginData.refreshToken;

      const response = await makeRequestWithCookies(
        `${BASE_URL}/auth/refresh-token`,
        "POST",
        [`refreshToken=${refreshToken}`],
      );

      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.accessToken);
    });
  });

  // Logout tests
  describe("POST /auth/logout", () => {
    it("should logout successfully", async () => {
      await createTestUser(testUsers.user);
      const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUsers.user.email,
          password: testUsers.user.password,
        }),
      });
      const loginData = await loginResponse.json();
      userToken = loginData.accessToken;

      const response = await makeAuthenticatedRequest(
        `${BASE_URL}/auth/logout`,
        "POST",
        userToken,
      );

      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(data.message, "Logged out successfully");
    });
  });
});
