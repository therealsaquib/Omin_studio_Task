import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import type Database from "better-sqlite3";
import { authenticate, createAuthRouter } from "./auth";
import { createActivitiesRouter } from "./activities";
import { errorHandler, AppError } from "./errors";
import { createOverviewRouter } from "./overview";
import { requestId } from "./requestId";
import { createRequestsRouter } from "./requests";
import { createWorkItemsRouter } from "./workItems";

export function createApp(database: Database.Database, jwtSecret: string, clientOrigin: string) {
  if (jwtSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters long");
  if (!clientOrigin) throw new Error("CLIENT_ORIGIN must be configured");

  const app = express();
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: clientOrigin }));
  app.use(compression());
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.use("/auth", createAuthRouter(database, jwtSecret));
  app.use("/requests", authenticate(database, jwtSecret), createRequestsRouter(database));
  app.use("/work-items", authenticate(database, jwtSecret), createWorkItemsRouter(database));
  app.use("/activities", authenticate(database, jwtSecret), createActivitiesRouter(database));
  app.use("/overview", authenticate(database, jwtSecret), createOverviewRouter(database));
  app.use((request, _response, next) => {
    next(new AppError(404, "NOT_FOUND", `No route for ${request.method} ${request.path}.`));
  });
  app.use(errorHandler);
  return app;
}
