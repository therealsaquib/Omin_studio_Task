import bcrypt from "bcryptjs";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { Router, type Request } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type Database from "better-sqlite3";
import { z } from "zod";
import { asyncHandler } from "./asyncHandler";
import { AppError, validationError } from "./errors";
import type { AuthUser } from "./types";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72, "Password must be 72 characters or fewer."),
}).strict();

const dummyPasswordHash = bcrypt.hashSync("not-a-real-omni-user-password", 10);
const loginWindowMs = 15 * 60 * 1000;

function emailRateLimitKey(request: Request): string {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "invalid";
  return `${ipKeyGenerator(request.ip ?? "127.0.0.1")}:${email}`;
}

interface LoginRow {
  id: string;
  workspace_id: string;
  email: string;
  password_hash: string;
  name: string;
  role: "ADMIN";
  workspace_name: string;
}

function publicUser(user: LoginRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    workspaceId: user.workspace_id,
    workspaceName: user.workspace_name,
  };
}

export function authenticate(database: Database.Database, jwtSecret: string) {
  return asyncHandler((request, _response, next) => {
    const authorization = request.header("authorization");
    if (!authorization) {
      throw new AppError(401, "MISSING_TOKEN", "Please log in to continue.");
    }
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      throw new AppError(401, "MALFORMED_TOKEN", "Your session token is invalid. Please log in again.");
    }

    let decoded: string | JwtPayload;
    try {
      decoded = jwt.verify(match[1], jwtSecret);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(401, "TOKEN_EXPIRED", "Your session expired, please log in again.");
      }
      throw new AppError(401, "MALFORMED_TOKEN", "Your session token is invalid. Please log in again.");
    }

    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string" ||
      typeof decoded.workspaceId !== "string" ||
      decoded.role !== "ADMIN"
    ) {
      throw new AppError(401, "MALFORMED_TOKEN", "Your session token is invalid. Please log in again.");
    }

    const user = database.prepare(
      "SELECT users.id, users.workspace_id, users.email, users.name, users.role, workspaces.name AS workspace_name FROM users JOIN workspaces ON workspaces.id = users.workspace_id WHERE users.id = ? AND users.workspace_id = ?",
    ).get(decoded.userId, decoded.workspaceId) as Omit<LoginRow, "password_hash"> | undefined;

    if (!user) {
      throw new AppError(401, "ACCOUNT_NOT_FOUND", "Your account is no longer available. Please log in again.");
    }
    if (user.role !== decoded.role) {
      throw new AppError(401, "MALFORMED_TOKEN", "Your session token is invalid. Please log in again.");
    }

    const authenticatedUser: AuthUser = {
      userId: user.id,
      workspaceId: user.workspace_id,
      role: user.role,
      name: user.name,
      email: user.email,
      workspaceName: user.workspace_name,
    };
    request.user = authenticatedUser;
    next();
  });
}

export function createAuthRouter(database: Database.Database, jwtSecret: string) {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: loginWindowMs,
    limit: 5,
    keyGenerator: emailRateLimitKey,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (request, response, next) => {
      response.setHeader("Retry-After", String(Math.ceil(loginWindowMs / 1000)));
      next(new AppError(429, "RATE_LIMITED", "Too many attempts. Please try again in 15 minutes."));
    },
  });

  router.post("/login", loginLimiter, asyncHandler((request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) throw validationError(parsed.error);

    const user = database.prepare(
      "SELECT users.id, users.workspace_id, users.email, users.password_hash, users.name, users.role, workspaces.name AS workspace_name FROM users JOIN workspaces ON workspaces.id = users.workspace_id WHERE users.email = ?",
    ).get(parsed.data.email) as LoginRow | undefined;
    const passwordMatches = bcrypt.compareSync(parsed.data.password, user?.password_hash ?? dummyPasswordHash);
    if (!user || !passwordMatches) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const token = jwt.sign(
      { userId: user.id, workspaceId: user.workspace_id, role: user.role },
      jwtSecret,
      { expiresIn: "1h" },
    );
    response.json({ token, user: publicUser(user) });
  }));

  router.get("/me", authenticate(database, jwtSecret), asyncHandler((request, response) => {
    if (!request.user) throw new AppError(401, "MISSING_TOKEN", "Please log in to continue.");
    response.json({
      user: {
        id: request.user.userId,
        name: request.user.name,
        email: request.user.email,
        role: request.user.role,
        workspaceId: request.user.workspaceId,
        workspaceName: request.user.workspaceName,
      },
    });
  }));

  return router;
}
