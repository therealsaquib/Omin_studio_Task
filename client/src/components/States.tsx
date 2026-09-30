import type { ReactNode } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import type { DeskRequest, RequestPriority, RequestStatus } from "../types";

const statusLabels: Record<RequestStatus, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  CLOSED: "Closed",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><i />{statusLabels[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: RequestPriority }) {
  return <span className={`priority-label priority-${priority.toLowerCase()}`}><i />{priority}</span>;
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-state-icon"><CircleAlert size={19} /></span><h3>{title}</h3><p>{message}</p>{action}</div>;
}

export function ErrorState({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : "Please try again.";
  return (
    <div className="error-state" role="alert">
      <div className="error-state-icon"><CircleAlert size={18} /></div>
      <div><strong>{title}</strong><p>{message}</p></div>
      <button className="button button-secondary" onClick={onRetry}><RefreshCw size={15} /> Retry</button>
    </div>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return <div className="loading-cards" role="status" aria-label="Loading"><span className="sr-only">Loading content…</span>{Array.from({ length: count }, (_, index) => <div className="loading-card" key={index}><i /><span /><span /></div>)}</div>;
}

export function TableSkeleton({ count = 5 }: { count?: number }) {
  return <div className="table-skeleton" role="status" aria-label="Loading requests"><span className="sr-only">Loading requests…</span>{Array.from({ length: count }, (_, index) => <div className="table-skeleton-row" key={index}><i /><span /><span /><span /><span /></div>)}</div>;
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", options ?? { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function shortInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export type { DeskRequest };
