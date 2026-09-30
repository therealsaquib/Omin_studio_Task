import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { AppError } from "../errors";
import type { AuthUser } from "../types";

export interface RequestListFilters {
  status?: "NEW" | "QUALIFIED" | "CLOSED";
  priority?: "URGENT" | "IMPORTANT" | "NORMAL";
  search?: string;
  scheduledDate?: string;
  sort: "scheduled_asc" | "scheduled_desc" | "created_asc" | "created_desc";
  page: number;
  pageSize: number;
}

function workspaceRequestCounts(database: Database.Database, workspaceId: string) {
  const counts = database.prepare(
    "SELECT status, COUNT(*) AS count FROM requests WHERE workspace_id = ? GROUP BY status",
  ).all(workspaceId) as Array<{ status: "NEW" | "QUALIFIED" | "CLOSED"; count: number }>;
  return counts.reduce(
    (result, row) => ({ ...result, [row.status]: row.count }),
    { NEW: 0, QUALIFIED: 0, CLOSED: 0 },
  );
}

export function listRequests(database: Database.Database, user: AuthUser, filters: RequestListFilters) {
  const clauses = ["requests.workspace_id = ?"];
  const values: Array<string | number> = [user.workspaceId];
  if (filters.status) {
    clauses.push("requests.status = ?");
    values.push(filters.status);
  }
  if (filters.priority) {
    clauses.push("requests.priority = ?");
    values.push(filters.priority);
  }
  if (filters.search) {
    clauses.push("(requests.customer_name LIKE ? OR requests.service LIKE ?)");
    values.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.scheduledDate) {
    clauses.push("requests.scheduled_date = ?");
    values.push(filters.scheduledDate);
  }
  const where = clauses.join(" AND ");
  const orderBy = {
    scheduled_asc: "requests.scheduled_date ASC",
    scheduled_desc: "requests.scheduled_date DESC",
    created_asc: "requests.created_at ASC",
    created_desc: "requests.created_at DESC",
  }[filters.sort];
  const total = (database.prepare(
    `SELECT COUNT(*) AS total FROM requests WHERE ${where}`,
  ).get(...values) as { total: number }).total;
  const data = database.prepare(
    `SELECT requests.id, requests.customer_name, requests.customer_phone,
      requests.customer_email, requests.customer_city, requests.service,
      requests.scheduled_date, requests.priority, requests.status,
      requests.created_at, requests.updated_at,
      work_items.id AS work_item_id
     FROM requests LEFT JOIN work_items
       ON work_items.request_id = requests.id AND work_items.workspace_id = requests.workspace_id
     WHERE ${where}
     ORDER BY ${orderBy}, requests.id ASC
     LIMIT ? OFFSET ?`,
  ).all(...values, filters.pageSize, (filters.page - 1) * filters.pageSize);
  return {
    data,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    counts: workspaceRequestCounts(database, user.workspaceId),
  };
}

export function getOverview(database: Database.Database, user: AuthUser) {
  const counts = workspaceRequestCounts(database, user.workspaceId);
  const workItems = (database.prepare(
    "SELECT COUNT(*) AS count FROM work_items WHERE workspace_id = ?",
  ).get(user.workspaceId) as { count: number }).count;
  const activity = (database.prepare(
    "SELECT COUNT(*) AS count FROM activities WHERE workspace_id = ?",
  ).get(user.workspaceId) as { count: number }).count;
  const recentRequests = database.prepare(
    `SELECT requests.id, requests.customer_name, requests.customer_phone, requests.customer_email,
      requests.customer_city, requests.service, requests.scheduled_date, requests.priority,
      requests.status, requests.created_at, requests.updated_at, work_items.id AS work_item_id
     FROM requests LEFT JOIN work_items
       ON work_items.request_id = requests.id AND work_items.workspace_id = requests.workspace_id
     WHERE requests.workspace_id = ?
     ORDER BY requests.created_at DESC LIMIT 5`,
  ).all(user.workspaceId);
  return { counts, workItems, activity, recentRequests };
}

export function nextRequestId(database: Database.Database): string {
  const row = database.prepare(
    "SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS id FROM requests",
  ).get() as { id: number };
  return String(row.id);
}

export function getRequest(database: Database.Database, user: AuthUser, id: string) {
  const request = database.prepare(
    `SELECT requests.id, requests.workspace_id, requests.customer_name,
      requests.customer_phone, requests.customer_email, requests.customer_city,
      requests.service, requests.scheduled_date, requests.priority, requests.status,
      requests.created_at, requests.updated_at,
      CASE WHEN work_items.id IS NULL THEN 0 ELSE 1 END AS has_work_item,
      work_items.id AS work_item_id
     FROM requests LEFT JOIN work_items
       ON work_items.request_id = requests.id AND work_items.workspace_id = requests.workspace_id
     WHERE requests.id = ? AND requests.workspace_id = ?`,
  ).get(id, user.workspaceId);
  if (!request) throw new AppError(404, "NOT_FOUND", "Request not found.");
  return request;
}

export function getRequestDetail(database: Database.Database, user: AuthUser, id: string) {
  const request = getRequest(database, user, id);
  const activities = database.prepare(
    `SELECT activities.id, activities.request_id, activities.action, activities.created_at,
      users.name AS user_name, users.role AS user_role
     FROM activities JOIN users ON users.id = activities.user_id
     WHERE activities.request_id = ? AND activities.workspace_id = ?
     ORDER BY activities.created_at ASC`,
  ).all(id, user.workspaceId);
  return { request, activities };
}

export function createRequest(
  database: Database.Database,
  user: AuthUser,
  data: {
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    customer_city: string;
    service: string;
    scheduled_date: string;
    priority: "URGENT" | "IMPORTANT" | "NORMAL";
    status: "NEW" | "QUALIFIED" | "CLOSED";
  },
) {
  const now = new Date().toISOString();
  const create = database.transaction(() => {
    const id = nextRequestId(database);
    database.prepare(
      `INSERT INTO requests
       (id, workspace_id, customer_name, customer_phone, customer_email, customer_city,
        service, scheduled_date, priority, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, user.workspaceId, data.customer_name, data.customer_phone, data.customer_email,
      data.customer_city, data.service, data.scheduled_date, data.priority, data.status, now, now,
    );
    database.prepare(
      "INSERT INTO activities (id, workspace_id, request_id, user_id, action, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(randomUUID(), user.workspaceId, id, user.userId, "REQUEST_CREATED", now);
    return id;
  });
  const id = create.immediate();
  return getRequest(database, user, id);
}

export function updateRequest(
  database: Database.Database,
  user: AuthUser,
  id: string,
  data: Record<string, string>,
) {
  getRequest(database, user, id);
  const fields = Object.keys(data);
  const now = new Date().toISOString();
  const update = database.transaction(() => {
    const assignments = fields.map((field) => `${field} = ?`).join(", ");
    database.prepare(
      `UPDATE requests SET ${assignments}, updated_at = ? WHERE id = ? AND workspace_id = ?`,
    ).run(...fields.map((field) => data[field]), now, id, user.workspaceId);
    database.prepare(
      "INSERT INTO activities (id, workspace_id, request_id, user_id, action, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(randomUUID(), user.workspaceId, id, user.userId, "REQUEST_UPDATED", now);
  });
  update();
  return getRequest(database, user, id);
}

export function convertRequest(database: Database.Database, user: AuthUser, id: string) {
  const convert = database.transaction(() => {
    const request = database.prepare(
      "SELECT id, status FROM requests WHERE id = ? AND workspace_id = ?",
    ).get(id, user.workspaceId) as { id: string; status: string } | undefined;
    if (!request) throw new AppError(404, "NOT_FOUND", "Request not found.");
    if (request.status !== "QUALIFIED") {
      throw new AppError(409, "INVALID_STATE", "Only qualified requests can be converted.");
    }

    const existing = database.prepare(
      "SELECT id, workspace_id, request_id, created_by, created_at FROM work_items WHERE request_id = ? AND workspace_id = ?",
    ).get(id, user.workspaceId);
    if (existing) return { workItem: existing, alreadyExists: true };

    const workItem = {
      id: randomUUID(),
      workspace_id: user.workspaceId,
      request_id: id,
      created_by: user.userId,
      created_at: new Date().toISOString(),
    };
    database.prepare(
      "INSERT INTO work_items (id, workspace_id, request_id, created_by, created_at) VALUES (@id, @workspace_id, @request_id, @created_by, @created_at)",
    ).run(workItem);
    database.prepare(
      "INSERT INTO activities (id, workspace_id, request_id, user_id, action, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(randomUUID(), user.workspaceId, id, user.userId, "WORK_ITEM_CREATED", workItem.created_at);
    return { workItem, alreadyExists: false };
  });

  try {
    return convert();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed: work_items.request_id")
    ) {
      const existing = database.prepare(
        "SELECT id, workspace_id, request_id, created_by, created_at FROM work_items WHERE request_id = ? AND workspace_id = ?",
      ).get(id, user.workspaceId);
      if (existing) return { workItem: existing, alreadyExists: true };
    }
    throw error;
  }
}
