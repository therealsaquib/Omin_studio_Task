export type RequestStatus = "NEW" | "QUALIFIED" | "CLOSED";
export type RequestPriority = "URGENT" | "IMPORTANT" | "NORMAL";

export interface DeskRequest {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_city: string;
  service: string;
  scheduled_date: string;
  priority: RequestPriority;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  work_item_id: string | null;
}

export interface Activity {
  id: string;
  request_id: string;
  action: string;
  created_at: string;
  user_name: string;
  user_role: "ADMIN";
  customer_name?: string;
  service?: string;
}

export interface WorkItem {
  id: string;
  request_id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_city: string;
  service: string;
  scheduled_date: string;
  priority: RequestPriority;
  status: RequestStatus;
  created_by_name: string;
}

export interface DeskUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN";
  workspaceId: string;
  workspaceName: string;
}

export interface RequestInput {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_city: string;
  service: string;
  scheduled_date: string;
  priority: RequestPriority;
  status: RequestStatus;
}

export interface RequestListResult {
  data: DeskRequest[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<RequestStatus, number>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Overview {
  counts: Record<RequestStatus, number>;
  workItems: number;
  activity: number;
  recentRequests: DeskRequest[];
}

export interface AuthCredentials {
  token: string;
  user: DeskUser;
}
