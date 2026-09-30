import type Database from "better-sqlite3";
import type { AuthUser } from "../types";

export function listActivities(
  database: Database.Database,
  user: AuthUser,
  page: number,
  pageSize: number,
) {
  const total = (database.prepare(
    "SELECT COUNT(*) AS total FROM activities WHERE workspace_id = ?",
  ).get(user.workspaceId) as { total: number }).total;
  const data = database.prepare(
    `SELECT activities.id, activities.request_id, activities.action, activities.created_at,
      users.name AS user_name, users.role AS user_role,
      requests.customer_name, requests.service
     FROM activities
     JOIN users ON users.id = activities.user_id AND users.workspace_id = activities.workspace_id
     JOIN requests ON requests.id = activities.request_id AND requests.workspace_id = activities.workspace_id
     WHERE activities.workspace_id = ?
     ORDER BY activities.created_at DESC
     LIMIT ? OFFSET ?`,
  ).all(user.workspaceId, pageSize, (page - 1) * pageSize);
  return { data, total, page, pageSize };
}
