import { Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { authMiddleware } from "../../middleware/auth.middleware.ts";
import {
  createMarker,
  deleteMarker,
  getMarkerById,
  getMarkers,
  getNearbyMarkers,
  updateMarker,
} from "./marker.controller.ts";

const markerRouter = new Router();

markerRouter
  .get("/", authMiddleware, getMarkers)
  .get("/nearby", authMiddleware, getNearbyMarkers)
  .get("/:id", authMiddleware, getMarkerById)
  .post("/", authMiddleware, createMarker)
  .put("/:id", authMiddleware, updateMarker)
  .delete("/:id", authMiddleware, deleteMarker);

export default markerRouter;
