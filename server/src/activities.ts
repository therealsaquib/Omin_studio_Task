import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "./asyncHandler";
import { validationError } from "./errors";
import { listActivities } from "./services/activityService";
import { getAuthUser } from "./types";
import type Database from "better-sqlite3";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
}).strict();

export function createActivitiesRouter(database: Database.Database) {
  const router = Router();
  router.get("/", asyncHandler((request, response) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) throw validationError(parsed.error);
    response.json(listActivities(database, getAuthUser(request), parsed.data.page, parsed.data.pageSize));
  }));
  return router;
}
