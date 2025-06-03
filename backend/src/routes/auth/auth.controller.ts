import { Context, RouterContext } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import User, {
  ActivityType,
  Budget,
  DistanceUnit,
  IUser,
  TransportMethod,
  UserRole,
} from "../../models/auth/auth.mongo.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../middleware/auth.middleware.ts";

// Password validation regex
// At least 8 characters long, at least one uppercase letter, one lowercase letter, and one number
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Function to validate password
function validatePassword(
  password: string,
): { isValid: boolean; message?: string } {
  if (!password) {
    return { isValid: false, message: "Password is required" };
  }

  if (!PASSWORD_REGEX.test(password)) {
    return {
      isValid: false,
      message:
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number",
    };
  }

  return { isValid: true };
}

// Function to validate email
function validateEmail(email: string): { isValid: boolean; message?: string } {
  if (!email) {
    return { isValid: false, message: "Email is required" };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      isValid: false,
      message: "Please enter a valid email address",
    };
  }

  return { isValid: true };
}

interface BaseLocation {
  latitude: number;
  longitude: number;
}

interface AccessibilityRequirements {
  wheelchairAccessible: boolean;
  hasElevator: boolean;
  hasRamp: boolean;
  hasAccessibleBathroom: boolean;
}

interface PlaceType {
  value: string;
  label: string;
}

interface UserPreferences {
  activityTypes: PlaceType[];
  transportMethod: TransportMethod;
  budget: Budget;
  baseLocation: BaseLocation;
  searchRadius: number;
  preferedUnit: DistanceUnit;
  accessibilityRequirements?: AccessibilityRequirements;
}

interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  preferences?: Partial<UserPreferences>;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface UpdateUserRequest {
  email?: string;
  password?: string;
  displayName?: string;
  preferences?: Partial<UserPreferences>;
  role?: UserRole;
  isActive?: boolean;
}

const refreshTokenExpiryTime: number = parseInt(
  Deno.env.get("JWT_REFRESH_EXPIRES_IN") || "7",
);

const handleError = (ctx: Context, error: unknown, message: string) => {
  console.error(message, error);
  ctx.response.status = 500;
  ctx.response.body = {
    message: "Server error",
    error: error instanceof Error ? error.message : String(error),
  };
};

export const refreshToken = async (ctx: Context) => {
  try {
    console.log("Refresh token attempt received:", ctx.request.url.href);
    console.log("Refresh request headers:", ctx.request.headers);
    console.log(
      "Cookies received:",
      await ctx.cookies.get("refreshToken") || "None",
    );

    const refreshToken = await ctx.cookies.get("refreshToken");
    if (!refreshToken) {
      console.log("Refresh token not found in cookies");
      ctx.response.status = 401;
      ctx.response.body = { message: "Refresh token not found" };
      return;
    }

    const user = await User.findOne({
      refreshToken,
      refreshTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      console.log(
        "Invalid or expired refresh token:",
        refreshToken.substring(0, 10) + "...",
      );
      ctx.response.status = 401;
      ctx.response.body = { message: "Invalid or expired refresh token" };
      return;
    }

    console.log(`Refresh token valid for user: ${user.email}`);
    const accessToken = await generateAccessToken(user);
    const newRefreshToken = await generateRefreshToken();
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(
      refreshTokenExpiry.getDate() + refreshTokenExpiryTime,
    );

    user.refreshToken = newRefreshToken;
    user.refreshTokenExpiry = refreshTokenExpiry;
    await user.save();

    // Updated cookie settings with sameSite and additional options
    await ctx.cookies.set("refreshToken", newRefreshToken, {
      httpOnly: true,
      path: "/",
      maxAge: refreshTokenExpiryTime * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      secure: false, // Set to false for development, true for production
    });

    console.log("New refresh token cookie set:", {
      expires: refreshTokenExpiry,
      path: "/",
      sameSite: "lax",
    });

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Token refreshed successfully",
      accessToken,
    };
  } catch (error) {
    console.error("Refresh token error details:", error);
    handleError(ctx, error, "Refresh token error:");
  }
};

export const getAllUsers = async (ctx: Context) => {
  try {
    const users = await User.find({}).select(
      "-password -refreshToken -refreshTokenExpiry",
    );

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Users retrieved successfully",
      users: users.map((user) => ({
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        preferences: user.preferences,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
      })),
    };
  } catch (error) {
    handleError(ctx, error, "Get all users error:");
  }
};

export const register = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json() as RegisterRequest;

    if (!body.email || !body.password || !body.displayName) {
      ctx.response.status = 400;
      ctx.response.body = {
        message: "Email, password, and display name are required",
      };
      return;
    }

    // Validate email
    const emailValidation = validateEmail(body.email);
    if (!emailValidation.isValid) {
      ctx.response.status = 400;
      ctx.response.body = { message: emailValidation.message };
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(body.password);
    if (!passwordValidation.isValid) {
      ctx.response.status = 400;
      ctx.response.body = { message: passwordValidation.message };
      return;
    }

    const existingUser = await User.findOne({ email: body.email });
    if (existingUser) {
      ctx.response.status = 400;
      ctx.response.body = { message: "User already exists" };
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(body.password, salt);

    const user = new User({
      email: body.email,
      password: hashedPassword,
      displayName: body.displayName,
      preferences: {
        activityTypes: body.preferences?.activityTypes || [],
        transportMethod: body.preferences?.transportMethod ||
          TransportMethod.WHEELCHAIR,
        budget: body.preferences?.budget || Budget.FREE,
        baseLocation: {
          latitude: body.preferences?.baseLocation?.latitude || 0,
          longitude: body.preferences?.baseLocation?.longitude || 0,
        },
        searchRadius: body.preferences?.searchRadius || 5,
        preferedUnit: body.preferences?.preferedUnit || DistanceUnit.KILOMETERS,
        accessibilityRequirements:
          body.preferences?.accessibilityRequirements || {
            wheelchairAccessible: false,
            hasElevator: false,
            hasRamp: false,
            hasAccessibleBathroom: false,
          },
      },
    });

    await user.save();

    // Generate tokens
    const accessToken = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken();

    // Set refresh token expiry
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(
      refreshTokenExpiry.getDate() + refreshTokenExpiryTime,
    );

    // Update user with refresh token
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = refreshTokenExpiry;
    await user.save();

    // Set refresh token cookie
    await ctx.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/",
      maxAge: refreshTokenExpiryTime * 24 * 60 * 60 * 1000,
    });

    ctx.response.status = 201;
    ctx.response.body = {
      message: "User registered successfully",
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        preferences: user.preferences,
      },
    };
  } catch (error) {
    handleError(ctx, error, "Registration error:");
  }
};

export const login = async (ctx: Context) => {
  try {
    console.log("Login attempt received:", ctx.request.url.href);
    console.log("Login request headers:", ctx.request.headers);

    const body = await ctx.request.body.json() as LoginRequest;

    if (!body.email || !body.password) {
      console.log("Login failed: Missing email or password");
      ctx.response.status = 400;
      ctx.response.body = { message: "Email and password are required" };
      return;
    }

    console.log(`Attempting login for email: ${body.email}`);
    const user = await User.findOne({ email: body.email }).select("+password");
    if (!user) {
      console.log(`Login failed: User not found for email: ${body.email}`);
      ctx.response.status = 401;
      ctx.response.body = { message: "Invalid credentials" };
      return;
    }

    const isMatch = await bcrypt.compare(body.password, user.password);
    if (!isMatch) {
      console.log(`Login failed: Invalid password for email: ${body.email}`);
      ctx.response.status = 401;
      ctx.response.body = { message: "Invalid credentials" };
      return;
    }

    // Check if user account is active
    if (!user.isActive) {
      console.log(`Login failed: Account is disabled for email: ${body.email}`);
      ctx.response.status = 401;
      ctx.response.body = { message: "Account is disabled. Please contact an administrator." };
      return;
    }

    console.log(`Login successful for email: ${body.email}`);
    const accessToken = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken();

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(
      refreshTokenExpiry.getDate() + refreshTokenExpiryTime,
    );

    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = refreshTokenExpiry;
    user.lastLogin = new Date();
    await user.save();

    // Updated cookie settings with sameSite and additional options
    await ctx.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/",
      maxAge: refreshTokenExpiryTime * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      secure: false, // Set to false for development, true for production
    });

    console.log("Refresh token cookie set:", {
      expires: refreshTokenExpiry,
      path: "/",
      sameSite: "lax",
    });

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        preferences: user.preferences,
        isActive: user.isActive,
      },
    };
  } catch (error) {
    console.error("Login error details:", error);
    handleError(ctx, error, "Login error:");
  }
};

export const logout = async (ctx: Context) => {
  try {
    const refreshToken = await ctx.cookies.get("refreshToken");
    if (refreshToken) {
      await User.findOneAndUpdate(
        { refreshToken },
        {
          $set: {
            refreshToken: null,
            refreshTokenExpiry: null,
          },
        },
      );
    }

    await ctx.cookies.delete("refreshToken", {
      path: "/",
    });

    ctx.response.status = 200;
    ctx.response.body = { message: "Logged out successfully" };
  } catch (error) {
    handleError(ctx, error, "Logout error:");
  }
};

export const updateUser = async (ctx: RouterContext<"/update/:id">) => {
  try {
    const userId = ctx.params.id;
    const body = await ctx.request.body.json() as UpdateUserRequest;
    const authUser = ctx.state.user;

    // Only allow users to update their own profile unless they're admin/moderator
    if (
      authUser.role !== UserRole.ADMIN &&
      authUser.role !== UserRole.MODERATOR && authUser.userId !== userId
    ) {
      ctx.response.status = 403;
      ctx.response.body = { message: "Unauthorized to update this user" };
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      ctx.response.status = 404;
      ctx.response.body = { message: "User not found" };
      return;
    }

    // Update basic fields
    if (body.email) {
      // Validate email
      const emailValidation = validateEmail(body.email);
      if (!emailValidation.isValid) {
        ctx.response.status = 400;
        ctx.response.body = { message: emailValidation.message };
        return;
      }
      user.email = body.email;
    }
    if (body.displayName) user.displayName = body.displayName;
    if (body.role && authUser.role === UserRole.ADMIN) user.role = body.role;
    if (
      typeof body.isActive === "boolean" && authUser.role === UserRole.ADMIN
    ) user.isActive = body.isActive;

    // Update password if provided
    if (body.password) {
      // Validate new password
      const passwordValidation = validatePassword(body.password);
      if (!passwordValidation.isValid) {
        ctx.response.status = 400;
        ctx.response.body = { message: passwordValidation.message };
        return;
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(body.password, salt);
    }

    // Update preferences if provided
    if (body.preferences) {
      if (body.preferences.activityTypes) {
        user.preferences.activityTypes = body.preferences.activityTypes;
      }
      if (body.preferences.transportMethod) {
        user.preferences.transportMethod = body.preferences.transportMethod;
      }
      if (body.preferences.budget) {
        user.preferences.budget = body.preferences.budget;
      }
      if (body.preferences.baseLocation) {
        user.preferences.baseLocation = {
          latitude: body.preferences.baseLocation.latitude ??
            user.preferences.baseLocation.latitude,
          longitude: body.preferences.baseLocation.longitude ??
            user.preferences.baseLocation.longitude,
        };
      }
      if (body.preferences.searchRadius) {
        user.preferences.searchRadius = body.preferences.searchRadius;
      }
      if (body.preferences.preferedUnit) {
        user.preferences.preferedUnit = body.preferences.preferedUnit;
      }
      if (body.preferences.accessibilityRequirements) {
        user.preferences.accessibilityRequirements = {
          ...user.preferences.accessibilityRequirements,
          ...body.preferences.accessibilityRequirements,
        };
      }
    }

    await user.save();

    ctx.response.status = 200;
    ctx.response.body = {
      message: "User updated successfully",
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        preferences: user.preferences,
        isActive: user.isActive,
      },
    };
  } catch (error) {
    handleError(ctx, error, "Update user error:");
  }
};

export const deleteUser = async (ctx: RouterContext<"/delete/:id">) => {
  try {
    const userId = ctx.params.id;
    const authUser = ctx.state.user;

    if (authUser.role !== UserRole.ADMIN && authUser.userId !== userId) {
      ctx.response.status = 403;
      ctx.response.body = {
        message: "Only administrators can delete other users",
      };
      return;
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      ctx.response.status = 404;
      ctx.response.body = { message: "User not found" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = { message: "User deleted successfully" };
  } catch (error) {
    handleError(ctx, error, "Delete user error:");
  }
};

/**
 * Get user data by ID
 * This endpoint provides limited public information about a user
 */
export const getUserById = async (ctx: RouterContext<"/user/:id">) => {
  try {
    const userId = ctx.params.id;
    const authUser = ctx.state.user;

    // Find user without sensitive information
    const user = await User.findById(userId).select(
      "-password -refreshToken -refreshTokenExpiry",
    );

    if (!user) {
      ctx.response.status = 404;
      ctx.response.body = { message: "User not found" };
      return;
    }

    // Return full profile for admins/moderators or the user themselves
    // Return limited public profile for other users
    if (
      authUser.role === UserRole.ADMIN ||
      authUser.role === UserRole.MODERATOR ||
      authUser.userId === userId
    ) {
      // Return full profile (excluding sensitive data)
      ctx.response.status = 200;
      ctx.response.body = {
        message: "User retrieved successfully",
        user: {
          id: user._id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          preferences: user.preferences,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } else {
      // Return limited public profile
      ctx.response.status = 200;
      ctx.response.body = {
        message: "User retrieved successfully",
        user: {
          id: user._id,
          displayName: user.displayName,
          role: user.role,
        },
      };
    }
  } catch (error) {
    handleError(ctx, error, "Get user by ID error:");
  }
};
