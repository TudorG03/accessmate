import { load } from "https://deno.land/std@0.170.0/dotenv/mod.ts";
import mongoConnect from "./config/mongo.ts";
import app from "./app.ts";

await load({ export: true });

const PORT = parseInt(Deno.env.get("PORT") || "3000");
const HOST = Deno.env.get("HOST") || "0.0.0.0";

async function startServer() {
  try {
    await mongoConnect();

    app.listen({ port: PORT, hostname: HOST });
    console.log(`Server running on ${HOST}:${PORT}`);
  } catch (error) {
    console.error("Failed to start server:", error);
    Deno.exit(1);
  }
}

startServer();