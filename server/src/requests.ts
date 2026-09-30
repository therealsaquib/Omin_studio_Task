import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "./asyncHandler";
import { AppError, validationError } from "./errors";
import {
  convertRequest,
  createRequest,
  getRequestDetail,
  listRequests,
  updateRequest,
} from "./services/requestService";
import { getAuthUser } from "./types";
import type Database from "better-sqlite3";

const statusSchema = z.enum(["NEW", "QUALIFIED", "CLOSED"]);
const prioritySchema = z.enum(["URGENT", "IMPORTANT", "NORMAL"]);
const requestFields = {
  customer_name: z.string().trim().min(1).max(120),
  customer_phone: z.string().regex(/^\+91 [6-9]\d{4} ?\d{5}$/, "Enter a valid Indian phone number."),
  customer_email: z.email(),
  customer_city: z.string().trim().min(1).max(100),
  service: z.string().trim().min(1).max(500),
  scheduled_date: z.iso.date(),
  priority: prioritySchema.default("NORMAL"),
};
const createRequestSchema = z.object({
  ...requestFields,
  status: statusSchema.default("NEW"),
}).strict();
const updateRequestSchema = z.object({
  customer_name: requestFields.customer_name.optional(),
  customer_phone: requestFields.customer_phone.optional(),
  customer_email: requestFields.customer_email.optional(),
  customer_city: requestFields.customer_city.optional(),
  service: requestFields.service.optional(),
  scheduled_date: requestFields.scheduled_date.optional(),
  priority: prioritySchema.optional(),
  status: statusSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");
const listQuerySchema = z.object({
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  search: z.string().trim().max(120).optional(),
  scheduledDate: z.iso.date().optional(),
  sort: z.enum(["scheduled_asc", "scheduled_desc", "created_asc", "created_desc"]).default("created_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
}).strict();

function requestId(value: string | string[]): string {
  if (Array.isArray(value)) {
    throw new AppError(400, "INVALID_ID", "Request ID must be a positive integer.");
  }
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new AppError(400, "INVALID_ID", "Request ID must be a positive integer.");
  }
  return value;
}

export function createRequestsRouter(database: Database.Database) {
  const router = Router();

  router.get("/", asyncHandler((request, response) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw validationError(parsed.error);
    response.json(listRequests(database, getAuthUser(request), parsed.data));
  }));

  router.post("/", asyncHandler((request, response) => {
    const parsed = createRequestSchema.safeParse(request.body);
    if (!parsed.success) throw validationError(parsed.error);
    const created = createRequest(database, getAuthUser(request), parsed.data);
    response.status(201).json({ request: created });
  }));

  router.get("/:id", asyncHandler((request, response) => {
    const id = requestId(request.params.id);
    response.json(getRequestDetail(database, getAuthUser(request), id));
  }));

  router.patch("/:id", asyncHandler((request, response) => {
    const id = requestId(request.params.id);
    const parsed = updateRequestSchema.safeParse(request.body);
    if (!parsed.success) throw validationError(parsed.error);
    const updates = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined),
    ) as Record<string, string>;
    response.json({ request: updateRequest(database, getAuthUser(request), id, updates) });
  }));

  router.post("/:id/convert", asyncHandler((request, response) => {
    const id = requestId(request.params.id);
    const result = convertRequest(database, getAuthUser(request), id);
    response.status(result.alreadyExists ? 200 : 201).json(result);
  }));

  return router;
}
