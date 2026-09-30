import { z } from "zod";
import type {
  Activity, AuthCredentials, DeskRequest, DeskUser, Overview, PaginatedResult,
  RequestInput, RequestListResult, RequestPriority, RequestStatus, WorkItem,
} from "./types";

const apiRoot = import.meta.env.VITE_API_URL ?? "/api";
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.literal("ADMIN"),
  workspaceId: z.string(),
  workspaceName: z.string(),
}) satisfies z.ZodType<DeskUser>;

const requestSchema = z.object({
  id: z.string(),
  customer_name: z.string(),
  customer_phone: z.string(),
  customer_email: z.string(),
  customer_city: z.string(),
  service: z.string(),
  scheduled_date: z.string(),
  priority: z.enum(["URGENT", "IMPORTANT", "NORMAL"]),
  status: z.enum(["NEW", "QUALIFIED", "CLOSED"]),
  created_at: z.string(),
  updated_at: z.string().optional().default(""),
  work_item_id: z.string().nullable().optional().default(null),
}) satisfies z.ZodType<DeskRequest>;

const activitySchema = z.object({
  id: z.string(),
  request_id: z.string(),
  action: z.string(),
  created_at: z.string(),
  user_name: z.string(),
  user_role: z.literal("ADMIN"),
  customer_name: z.string().optional(),
  service: z.string().optional(),
}) satisfies z.ZodType<Activity>;

const workItemSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  created_at: z.string(),
  customer_name: z.string(),
  customer_phone: z.string(),
  customer_email: z.string(),
  customer_city: z.string(),
  service: z.string(),
  scheduled_date: z.string(),
  priority: z.enum(["URGENT", "IMPORTANT", "NORMAL"]),
  status: z.enum(["NEW", "QUALIFIED", "CLOSED"]),
  created_by_name: z.string(),
}) satisfies z.ZodType<WorkItem>;

const credentialsSchema = z.object({
  token: z.string(),
  user: userSchema,
}) satisfies z.ZodType<AuthCredentials>;

const paginated = <T extends z.ZodType>(item: T) => z.object({
  data: z.array(item),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const listSchema = z.object({
  ...paginated(requestSchema).shape,
  counts: z.object({ NEW: z.number(), QUALIFIED: z.number(), CLOSED: z.number() }),
}) satisfies z.ZodType<RequestListResult>;

const overviewSchema = z.object({
  counts: z.object({ NEW: z.number(), QUALIFIED: z.number(), CLOSED: z.number() }),
  workItems: z.number(),
  activity: z.number(),
  recentRequests: z.array(requestSchema),
}) satisfies z.ZodType<Overview>;

const paginatedWorkItems = paginated(workItemSchema) satisfies z.ZodType<PaginatedResult<WorkItem>>;
const paginatedActivities = paginated(activitySchema) satisfies z.ZodType<PaginatedResult<Activity>>;
const detailSchema = z.object({ request: requestSchema, activities: z.array(activitySchema) });
const workItemResultSchema = z.object({ workItem: z.object({ id: z.string(), request_id: z.string(), created_at: z.string() }), alreadyExists: z.boolean() });

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string> = {},
    public readonly requestId?: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function callApi<T>(
  path: string,
  schema: z.ZodType<T>,
  token?: string,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`${apiRoot}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    window.clearTimeout(timeout);
    if (controller.signal.aborted) {
      throw new ApiError(0, "TIMEOUT", "Request timed out. Please try again.");
    }
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server, check your connection.");
  }
  window.clearTimeout(timeout);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const parsed = z.object({
      error: z.object({
        code: z.string(),
        message: z.string(),
        fields: z.record(z.string(), z.string()).default({}),
        requestId: z.string().optional(),
      }),
    }).safeParse(body);
    const error = parsed.success
      ? new ApiError(
        response.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.fields,
        parsed.data.error.requestId,
        Number(response.headers.get("Retry-After")) || undefined,
      )
      : new ApiError(response.status, "HTTP_ERROR", "Something went wrong. Please try again.");
    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent("omni:unauthorized", { detail: error }));
    }
    throw error;
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(500, "INVALID_RESPONSE", "The server returned an unexpected response.");
  }
  return parsed.data;
}

export async function login(email: string, password: string): Promise<AuthCredentials> {
  return callApi("/auth/login", credentialsSchema, undefined, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(token: string): Promise<DeskUser> {
  const response = await callApi("/auth/me", z.object({ user: userSchema }), token);
  return response.user;
}

export interface RequestFilters {
  status?: RequestStatus;
  priority?: RequestPriority;
  search?: string;
  scheduledDate?: string;
  sort?: "scheduled_asc" | "scheduled_desc" | "created_asc" | "created_desc";
  page?: number;
  pageSize?: number;
}

export async function getRequests(token: string, filters: RequestFilters): Promise<RequestListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return callApi(`/requests?${params}`, listSchema, token);
}

export async function getRequest(token: string, id: string) {
  return callApi(`/requests/${encodeURIComponent(id)}`, detailSchema, token);
}

export async function saveRequest(token: string, input: RequestInput, id?: string) {
  const response = await callApi(
    id ? `/requests/${encodeURIComponent(id)}` : "/requests",
    z.object({ request: requestSchema }),
    token,
    { method: id ? "PATCH" : "POST", body: JSON.stringify(input) },
  );
  return response.request;
}

export async function convertRequest(token: string, id: string) {
  return callApi(`/requests/${encodeURIComponent(id)}/convert`, workItemResultSchema, token, { method: "POST" });
}

export async function getWorkItems(token: string, page = 1, pageSize = 10) {
  return callApi(`/work-items?page=${page}&pageSize=${pageSize}`, paginatedWorkItems, token);
}

export async function getActivities(token: string, page = 1, pageSize = 20) {
  return callApi(`/activities?page=${page}&pageSize=${pageSize}`, paginatedActivities, token);
}

export async function getOverview(token: string) {
  return callApi("/overview", overviewSchema, token);
}
