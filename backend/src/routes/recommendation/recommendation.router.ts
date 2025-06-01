import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  getRecommendations,
  getRecommendationAnalytics,
  recordRecommendationFeedback,
  getUserRecommendationHistory,
  clearRecommendationCache,
} from "./recommendation.controller.ts";
import { authMiddleware } from "../../middleware/auth.middleware.ts";

const router = new Router();

// GET - Get personalized recommendations for a user
router.get("/user/:userId", authMiddleware, getRecommendations);

// GET - Get recommendation analytics for a user
router.get("/user/:userId/analytics", authMiddleware, getRecommendationAnalytics);

// GET - Get user's recommendation history
router.get("/user/:userId/history", authMiddleware, getUserRecommendationHistory);

// POST - Record recommendation feedback
router.post("/feedback", authMiddleware, recordRecommendationFeedback);

// DELETE - Clear recommendation cache for a user
router.delete("/user/:userId/cache", authMiddleware, clearRecommendationCache);

export default router; 