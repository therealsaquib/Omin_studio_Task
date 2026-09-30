import type Database from "better-sqlite3";
import type { AuthUser } from "../types";

export function listWorkItems(
  database: Database.Database,
  user: AuthUser,
  page: number,
  pageSize: number,
) {
  const total = (database.prepare(
    "SELECT COUNT(*) AS total FROM work_items WHERE workspace_id = ?",
  ).get(user.workspaceId) as { total: number }).total;
  const data = database.prepare(
    `SELECT work_items.id, work_items.request_id, work_items.created_at,
      requests.customer_name, requests.customer_phone, requests.customer_email,
      requests.customer_city, requests.service, requests.scheduled_date,
      requests.priority, requests.status, users.name AS created_by_name
     FROM work_items
     JOIN requests ON requests.id = work_items.request_id
       AND requests.workspace_id = work_items.workspace_id
     JOIN users ON users.id = work_items.created_by
     WHERE work_items.workspace_id = ?
     ORDER BY work_items.created_at DESC
     LIMIT ? OFFSET ?`,
  ).all(user.workspaceId, pageSize, (page - 1) * pageSize);
  return { data, total, page, pageSize };
}
