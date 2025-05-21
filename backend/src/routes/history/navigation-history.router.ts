import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  addNavigationHistory,
  clearUserNavigationHistory,
  getPlaceTypeFrequency,
  getUserNavigationHistory,
} from "./navigation-history.controller.ts";
import { authMiddleware } from "../../middleware/auth.middleware.ts";

const router = new Router();

// POST - Add new navigation history entry
router.post("/", authMiddleware, addNavigationHistory);

// GET - Retrieve user's navigation history
router.get("/user/:userId", authMiddleware, getUserNavigationHistory);

// GET - Get place type frequency for a user
router.get(
  "/user/:userId/place-types",
  authMiddleware,
  getPlaceTypeFrequency,
);

// DELETE - Clear user's navigation history
router.delete(
  "/user/:userId",
  authMiddleware,
  clearUserNavigationHistory,
);

export default router;
