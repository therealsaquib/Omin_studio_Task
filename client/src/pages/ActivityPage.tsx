import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getActivities } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { EmptyState, ErrorState, LoadingCards, formatDateTime } from "../components/States";

const labels: Record<string, string> = {
  REQUEST_CREATED: "Request received",
  REQUEST_QUALIFIED: "Request qualified",
  REQUEST_UPDATED: "Request updated",
  WORK_ITEM_CREATED: "Work item created",
};

export function ActivityPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const activity = useQuery({
    queryKey: ["activities", token, page],
    queryFn: () => getActivities(token!, page, pageSize),
    enabled: !!token,
  });
  const totalPages = Math.max(1, Math.ceil((activity.data?.total ?? 0) / pageSize));

  return (
    <section className="page-section">
      <div className="page-title-row"><div><p className="eyebrow">WORKSPACE HISTORY</p><h1>Activity</h1><p className="page-lede">A shared record of the work happening across your desk.</p></div></div>
      {activity.isPending ? <LoadingCards count={4} /> : activity.isError ? <ErrorState title="Activity couldn’t load" error={activity.error} onRetry={() => void activity.refetch()} /> : activity.data.data.length === 0 ? (
        <div className="surface-card"><EmptyState title="Nothing to catch up on" message="Request updates and work item changes will appear here." /></div>
      ) : (
        <>
          <div className="surface-card workspace-activity-list">{activity.data.data.map((item) => (
            <Link className="workspace-activity-row" to={`/requests/${item.request_id}`} key={item.id}>
              <span className={`activity-event-icon ${item.action === "WORK_ITEM_CREATED" ? "activity-event-work" : ""}`}><span /></span>
              <span className="workspace-activity-copy"><strong>{labels[item.action] ?? item.action.replaceAll("_", " ").toLowerCase()}</strong><small>{item.user_name} · {item.customer_name}{item.service ? ` · ${item.service}` : ""}</small></span>
              <time>{formatDateTime(item.created_at)}</time><ArrowRight size={15} />
            </Link>
          ))}</div>
          <div className="pagination-row"><span><strong>{activity.data.total}</strong> activity events</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button><span>Page {page} of {totalPages}</span><button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button></div></div>
        </>
      )}
    </section>
  );
}
