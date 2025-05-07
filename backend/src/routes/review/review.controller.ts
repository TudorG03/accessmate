import { Context, RouterContext } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import Review, { IReview } from "../../models/review/review.mongo.ts";
import { UserRole } from "../../models/auth/auth.mongo.ts";

interface CreateReviewRequest {
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

export const getLocationReviews = async (
  ctx: RouterContext<"/location/:locationId">,
) => {
  try {
    const { locationId } = ctx.params;

    const reviews = await Review.find({ locationId })
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

export const createReview = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json() as CreateReviewRequest;
    const authUser = ctx.state.user;

    // Validate required fields
    if (
      !body.location || !body.locationName || !body.accessibilityRating ||
      !body.questions
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        message:
          "Location, locationName, accessibilityRating, and questions are required",
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

    const review = new Review({
      userId: authUser.userId,
      location: body.location,
      locationName: body.locationName,
      accessibilityRating: body.accessibilityRating,
      description: body.description,
      images: body.images || [],
      questions: body.questions,
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
