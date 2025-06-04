import { Context, RouterContext } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import Review, { IReview } from "../../models/review/review.mongo.ts";
import { UserRole } from "../../models/auth/auth.mongo.ts";

interface CreateReviewRequest {
  placeId: string; // Google Places API ID
  location: {
    latitude: number;
    longitude: number;
  };
  locationName: string;
  accessibilityRating: number;
  description?: string;
  images?: string[];
  questions: {
    ramp: boolean;
    wideDoors: boolean;
    elevator: boolean;
    adaptedToilets: boolean;
  };
}

interface UpdateReviewRequest {
  locationName?: string;
  accessibilityRating?: number;
  description?: string;
  images?: string[];
  questions?: {
    ramp?: boolean;
    wideDoors?: boolean;
    elevator?: boolean;
    adaptedToilets?: boolean;
  };
}

const handleError = (ctx: Context, error: unknown, message: string) => {
  console.error(message, error);
  ctx.response.status = 500;
  ctx.response.body = {
    message: "Server error",
    error: error instanceof Error ? error.message : String(error),
  };
};

export const getAllReviews = async (ctx: Context) => {
  try {
    const reviews = await Review.find({})
      .populate("userId", "displayName email")
      .sort({ createdAt: -1 });

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Reviews retrieved successfully",
      reviews,
    };
  } catch (error) {
    handleError(ctx, error, "Get all reviews error:");
  }
};

export const getUserReviews = async (ctx: RouterContext<"/user/:userId">) => {
  try {
    const { userId } = ctx.params;
    const authUser = ctx.state.user;

    // Check if user has permission to view these reviews
    if (
      authUser.role !== UserRole.ADMIN &&
      authUser.role !== UserRole.MODERATOR &&
      authUser.userId !== userId
    ) {
      ctx.response.status = 403;
      ctx.response.body = { message: "Unauthorized to view these reviews" };
      return;
    }

    const reviews = await Review.find({ userId })
      .populate("userId", "displayName email")
      .sort({ createdAt: -1 });

    ctx.response.status = 200;
    ctx.response.body = {
      message: "User reviews retrieved successfully",
      reviews,
    };
  } catch (error) {
    handleError(ctx, error, "Get user reviews error:");
  }
};

export const getLocationReviews = async (ctx: Context) => {
  try {
    const lat = ctx.request.url.searchParams.get("lat");
    const lng = ctx.request.url.searchParams.get("lng");

    if (!lat || !lng) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Latitude and longitude are required" };
      return;
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      ctx.response.status = 400;
      ctx.response.body = { message: "Invalid latitude or longitude format" };
      return;
    }

    // Define a small tolerance for coordinate matching (approximately a few meters)
    const COORD_TOLERANCE = 0.0001;

    // Find reviews within the coordinate tolerance
    const reviews = await Review.find({
      "location.latitude": {
        $gte: latitude - COORD_TOLERANCE,
        $lte: latitude + COORD_TOLERANCE,
      },
      "location.longitude": {
        $gte: longitude - COORD_TOLERANCE,
        $lte: longitude + COORD_TOLERANCE,
      },
    })
      .populate("userId", "displayName email")
      .sort({ createdAt: -1 });

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Location reviews retrieved successfully",
      reviews,
    };
  } catch (error) {
    handleError(ctx, error, "Get location reviews error:");
  }
};

export const getPlaceReviews = async (ctx: RouterContext<"/place/:placeId">) => {
  try {
    const { placeId } = ctx.params;

    if (!placeId) {
      ctx.response.status = 400;
      ctx.response.body = { message: "PlaceId is required" };
      return;
    }

    // Find reviews for this specific place
    const reviews = await Review.find({ placeId })
      .populate("userId", "displayName email")
      .sort({ createdAt: -1 });

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Place reviews retrieved successfully",
      reviews,
    };
  } catch (error) {
    handleError(ctx, error, "Get place reviews error:");
  }
};

export const createReview = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json() as CreateReviewRequest;
    const authUser = ctx.state.user;

    // Validate required fields
    if (
      !body.placeId || !body.location || !body.locationName || !body.accessibilityRating ||
      !body.questions
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        message:
          "PlaceId, location, locationName, accessibilityRating, and questions are required",
      };
      return;
    }

    // Validate accessibility rating
    if (body.accessibilityRating < 1 || body.accessibilityRating > 5) {
      ctx.response.status = 400;
      ctx.response.body = {
        message: "Accessibility rating must be between 1 and 5",
      };
      return;
    }

    // Calculate accessibility score based on answered questions
    let accessibilityScore = null; // Default minimum score

    // Count how many questions were answered as true
    let answeredQuestions = 0;
    let trueAnswers = 0;

    if (body.questions.ramp !== null) {
      answeredQuestions++;
      if (body.questions.ramp === true) trueAnswers++;
    }

    if (body.questions.wideDoors !== null) {
      answeredQuestions++;
      if (body.questions.wideDoors === true) trueAnswers++;
    }

    if (body.questions.elevator !== null) {
      answeredQuestions++;
      if (body.questions.elevator === true) trueAnswers++;
    }

    if (body.questions.adaptedToilets !== null) {
      answeredQuestions++;
      if (body.questions.adaptedToilets === true) trueAnswers++;
    }

    // If any questions were answered, calculate a score from 1-5
    if (answeredQuestions > 0) {
      // Calculate percentage of true answers and map to 1-5 scale
      const percentage = trueAnswers / answeredQuestions;
      // Map 0% to 1, 100% to 5
      accessibilityScore = Math.max(
        1,
        Math.min(5, Math.round(1 + percentage * 4)),
      );
    }

    const review = new Review({
      userId: authUser.userId,
      placeId: body.placeId,
      location: body.location,
      locationName: body.locationName,
      accessibilityRating: body.accessibilityRating,
      description: body.description,
      images: body.images || [],
      questions: body.questions,
      accessibilityScore: accessibilityScore,
    });

    await review.save();

    ctx.response.status = 201;
    ctx.response.body = {
      message: "Review created successfully",
      review,
    };
  } catch (error) {
    handleError(ctx, error, "Create review error:");
  }
};

export const updateReview = async (ctx: RouterContext<"/:reviewId">) => {
  try {
    const { reviewId } = ctx.params;
    const body = await ctx.request.body.json() as UpdateReviewRequest;
    const authUser = ctx.state.user;

    const review = await Review.findById(reviewId);
    if (!review) {
      ctx.response.status = 404;
      ctx.response.body = { message: "Review not found" };
      return;
    }

    // Check if user has permission to update this review
    if (
      authUser.role !== UserRole.ADMIN &&
      authUser.role !== UserRole.MODERATOR &&
      review.userId.toString() !== authUser.userId
    ) {
      ctx.response.status = 403;
      ctx.response.body = { message: "Unauthorized to update this review" };
      return;
    }

    // Update fields if provided
    if (body.locationName) review.locationName = body.locationName;
    if (body.accessibilityRating) {
      if (body.accessibilityRating < 1 || body.accessibilityRating > 5) {
        ctx.response.status = 400;
        ctx.response.body = {
          message: "Accessibility rating must be between 1 and 5",
        };
        return;
      }
      review.accessibilityRating = body.accessibilityRating;
    }
    if (body.description !== undefined) review.description = body.description;
    if (body.images) review.images = body.images;
    if (body.questions) {
      review.questions = {
        ...review.questions,
        ...body.questions,
      };

      // Recalculate accessibility score if questions were updated
      // Count how many questions are answered as true
      let answeredQuestions = 0;
      let trueAnswers = 0;

      if (review.questions.ramp !== null) {
        answeredQuestions++;
        if (review.questions.ramp === true) trueAnswers++;
      }

      if (review.questions.wideDoors !== null) {
        answeredQuestions++;
        if (review.questions.wideDoors === true) trueAnswers++;
      }

      if (review.questions.elevator !== null) {
        answeredQuestions++;
        if (review.questions.elevator === true) trueAnswers++;
      }

      if (review.questions.adaptedToilets !== null) {
        answeredQuestions++;
        if (review.questions.adaptedToilets === true) trueAnswers++;
      }

      // If any questions were answered, calculate a score from 1-5
      if (answeredQuestions > 0) {
        // Calculate percentage of true answers and map to 1-5 scale
        const percentage = trueAnswers / answeredQuestions;
        // Map 0% to 1, 100% to 5
        review.accessibilityScore = Math.max(
          1,
          Math.min(5, Math.round(1 + percentage * 4)),
        );
      } else {
        // Default to 1 if no questions answered
        review.accessibilityScore = 1;
      }
    }

    await review.save();

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Review updated successfully",
      review,
    };
  } catch (error) {
    handleError(ctx, error, "Update review error:");
  }
};

export const deleteReview = async (ctx: RouterContext<"/:reviewId">) => {
  try {
    const { reviewId } = ctx.params;
    const authUser = ctx.state.user;

    const review = await Review.findById(reviewId);
    if (!review) {
      ctx.response.status = 404;
      ctx.response.body = { message: "Review not found" };
      return;
    }

    // Check if user has permission to delete this review
    if (
      authUser.role !== UserRole.ADMIN &&
      authUser.role !== UserRole.MODERATOR &&
      review.userId.toString() !== authUser.userId
    ) {
      ctx.response.status = 403;
      ctx.response.body = { message: "Unauthorized to delete this review" };
      return;
    }

    await Review.findByIdAndDelete(reviewId);

    ctx.response.status = 200;
    ctx.response.body = { message: "Review deleted successfully" };
  } catch (error) {
    handleError(ctx, error, "Delete review error:");
  }
};
