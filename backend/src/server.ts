import mongoConnect from "./config/mongo.ts";
import app from "./app.ts";

const PORT = parseInt(Deno.env.get("PORT") || "3000");
const HOST = Deno.env.get("HOST") || "0.0.0.0";

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoConnect();

    // Start the server
    app.listen({ port: PORT, hostname: HOST });
    console.log(`Server running on ${HOST}:${PORT}`);
  } catch (error) {
    console.error("Failed to start server:", error);
    Deno.exit(1);
  }
}

startServer();
