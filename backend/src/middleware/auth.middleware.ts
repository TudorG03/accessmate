import { Context, Next } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import * as uuid from "jsr:@std/uuid";
import { IUser, UserRole } from "../models/auth/auth.mongo.ts";
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts";

let cachedKey: CryptoKey | null = null;

export const getJwtKey = async (): Promise<CryptoKey> => {
  const JWT_SECRET = Deno.env.get("JWT_SECRET");

  if (cachedKey) return cachedKey;

  cachedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  return cachedKey;
};

export async function generateAccessToken(user: IUser) {
  const key = await getJwtKey();
  const expiresIn = parseInt(Deno.env.get("JWT_EXPIRES_IN") || "15");
  const exp = Math.floor(Date.now() / 1000) + expiresIn * 60;

  console.log(
    `Generating token that expires in ${expiresIn} seconds (at ${exp})`,
  );

  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      userId: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      exp: exp,
    },
    key,
  );
}

export async function generateRefreshToken() {
  return uuid.v1.generate();
}

export const authMiddleware = async (ctx: Context, next: Next) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    const JWT_SECRET = Deno.env.get("JWT_SECRET");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { message: "Unauthorized - No token provided" };
      return;
    }

    const token = authHeader.split(" ")[1];

    try {
      const key = await getJwtKey();
      const payload = await verify(token, key);

      const currentTime = Math.floor(Date.now() / 1000);
      console.log(
        `Token exp: ${payload.exp}, Current time: ${currentTime}, Difference: ${
          typeof payload.exp === "number" ? payload.exp - currentTime : "N/A"
        }s`,
      );

      if (typeof payload.exp === "number" && payload.exp < currentTime) {
        console.log("Token has expired");
        ctx.response.status = 401;
        ctx.response.body = { message: "Unauthorized - Token has expired" };
        return;
      }

      ctx.state.user = payload;
      await next();
    } catch (error) {
      console.error("Token verification error:", error);
      ctx.response.status = 401;
      ctx.response.body = { message: "Unauthorized - Invalid token" };
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const requireRole = (roles: UserRole[]) => {
  return async (ctx: Context, next: Next) => {
    try {
      const user = ctx.state.user;

      if (!user || !user.role) {
        ctx.response.status = 401;
        ctx.response.body = { message: "Unauthorized - No role found" };
        return;
      }

      if (!roles.includes(user.role)) {
        ctx.response.status = 403;
        ctx.response.body = {
          message: "Forbidden - Insufficient permissions",
          requiredRoles: roles,
          userRole: user.role,
        };
        return;
      }

      await next();
    } catch (error) {
      console.error("Role middleware error:", error);
      ctx.response.status = 500;
      ctx.response.body = {
        message: "Server error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
};
