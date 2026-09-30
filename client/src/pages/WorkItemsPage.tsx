import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getWorkItems } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { EmptyState, ErrorState, LoadingCards, PriorityBadge, StatusBadge, formatDate, shortInitials } from "../components/States";

const pageSize = 10;

export function WorkItemsPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const workItems = useQuery({
    queryKey: ["work-items", token, page],
    queryFn: () => getWorkItems(token!, page, pageSize),
    enabled: !!token,
    staleTime: 20_000,
  });
  const totalPages = Math.max(1, Math.ceil((workItems.data?.total ?? 0) / pageSize));

  return (
    <section className="page-section">
      <div className="page-title-row"><div><p className="eyebrow">TEAM WORK</p><h1>Work items</h1><p className="page-lede">Qualified requests your team is ready to take on.</p></div></div>
      {workItems.isPending ? <LoadingCards count={4} /> : workItems.isError ? <ErrorState title="Work items couldn’t load" error={workItems.error} onRetry={() => void workItems.refetch()} /> : workItems.data.data.length === 0 ? (
        <div className="surface-card"><EmptyState title="No work items yet" message="When a qualified request is converted, it will appear here." action={<Link className="button button-secondary" to="/requests">Review requests</Link>} /></div>
      ) : (
        <>
          <div className="work-item-grid">{workItems.data.data.map((item) => (
            <Link to={`/requests/${item.request_id}`} className="work-item-card" key={item.id}>
              <div className="work-item-head"><span className="customer-avatar">{shortInitials(item.customer_name)}</span><span><strong>{item.customer_name}</strong><small>{item.customer_city}</small></span><span className="work-item-icon"><BriefcaseBusiness size={17} /></span></div>
              <p>{item.service}</p>
              <div className="work-item-meta"><span>{formatDate(item.scheduled_date)}</span><PriorityBadge priority={item.priority} /></div>
              <div className="work-item-footer"><StatusBadge status={item.status} /><span>Created by {item.created_by_name}</span><ArrowRight size={15} /></div>
            </Link>
          ))}</div>
          <Pagination page={page} totalPages={totalPages} total={workItems.data.total} onPage={setPage} />
        </>
      )}
    </section>
  );
}

function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (page: number) => void }) {
  return <div className="pagination-row"><span><strong>{total}</strong> work items</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /></button><span>Page {page} of {totalPages}</span><button aria-label="Next page" disabled={page >= totalPages} onClick={() => onPage(page + 1)}><ChevronRight size={16} /></button></div></div>;
}
