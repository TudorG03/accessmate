import { env } from "../config/env.ts";

if (!process.env.GOOGLE_MAPS_API_KEY) {
  process.env.GOOGLE_MAPS_API_KEY = env.GOOGLE_MAPS_API_KEY;
}
