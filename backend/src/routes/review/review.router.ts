import { Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import {
  createReview,
  deleteReview,
  getAllReviews,
  getLocationReviews,
  getUserReviews,
  updateReview,
} from "./review.controller.ts";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/auth.middleware.ts";
import { UserRole } from "../../models/auth/auth.mongo.ts";

const routerReview = new Router();

// Get all reviews (admin/moderator only)
routerReview.get(
  "/",
  authMiddleware,
  requireRole([UserRole.ADMIN, UserRole.MODERATOR]),
  getAllReviews,
);

// Get reviews by user ID
routerReview.get(
  "/user/:userId",
  authMiddleware,
  getUserReviews,
);

// Get reviews by location using query parameters (public)
routerReview.get(
  "/location",
  getLocationReviews,
);

// Create a new review (authenticated users)
routerReview.post(
  "/",
  authMiddleware,
  createReview,
);

// Update a review
routerReview.put(
  "/:reviewId",
  authMiddleware,
  updateReview,
);

// Delete a review
routerReview.delete(
  "/:reviewId",
  authMiddleware,
  deleteReview,
);

export default routerReview;
