import { Router } from "express";
import type Database from "better-sqlite3";
import { asyncHandler } from "./asyncHandler";
import { getOverview } from "./services/requestService";
import { getAuthUser } from "./types";

export function createOverviewRouter(database: Database.Database) {
  const router = Router();
  router.get("/", asyncHandler((request, response) => {
    response.json(getOverview(database, getAuthUser(request)));
  }));
  return router;
}
