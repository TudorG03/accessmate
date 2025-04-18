import { Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import {
  deleteUser,
  getAllUsers,
  login,
  logout,
  refreshToken,
  register,
  updateUser,
} from "./auth.controller.ts";
import {
  authMiddleware,
  requireRole,
} from "../../middleware/auth.middleware.ts";
import { UserRole } from "../../models/auth/auth.mongo.ts";

const routerAuth = new Router();

// Public routes
routerAuth.post("/register", register);
routerAuth.post("/login", login);
routerAuth.post("/refresh-token", refreshToken);

// Protected routes (require authentication)
routerAuth.get(
  "/",
  authMiddleware,
  requireRole([UserRole.ADMIN, UserRole.MODERATOR]),
  getAllUsers,
);

// User management routes with role-based access
routerAuth.put(
  "/update/:id",
  authMiddleware,
  async (ctx, next) => {
    const authUser = ctx.state.user;
    const userId = ctx.params.id;

    // Allow access if user is admin/moderator or updating their own profile
    if (
      authUser.role === UserRole.ADMIN ||
      authUser.role === UserRole.MODERATOR ||
      authUser.userId === userId
    ) {
      await next();
    } else {
      ctx.response.status = 403;
      ctx.response.body = { message: "Unauthorized to update this user" };
    }
  },
  updateUser,
);

routerAuth.delete(
  "/delete/:id",
  authMiddleware,
  async (ctx, next) => {
    const authUser = ctx.state.user;
    const userId = ctx.params.id;

    // Allow access if user is admin or deleting their own profile
    if (authUser.role === UserRole.ADMIN || authUser.userId === userId) {
      await next();
    } else {
      ctx.response.status = 403;
      ctx.response.body = { message: "Unauthorized to delete this user" };
    }
  },
  deleteUser,
);

// Logout route (requires authentication)
routerAuth.post("/logout", authMiddleware, logout);

export default routerAuth;
