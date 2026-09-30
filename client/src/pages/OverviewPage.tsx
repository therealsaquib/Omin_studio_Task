import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, Clock3, FileText, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { getOverview } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { EmptyState, ErrorState, LoadingCards, PriorityBadge, StatusBadge } from "../components/States";
import type { DeskRequest } from "../types";

export function OverviewPage() {
  const { token, user } = useAuth();
  const overview = useQuery({
    queryKey: ["overview", token],
    queryFn: () => getOverview(token!),
    enabled: !!token,
    staleTime: 20_000,
  });

  return (
    <section className="page-section">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Good day, {user?.name.split(" ")[0]}.</h1>
          <p className="page-lede">A clear view of what needs your attention.</p>
        </div>
        <span className="workspace-chip">{user?.workspaceName}</span>
      </div>
      {overview.isPending ? <LoadingCards count={4} /> : overview.isError ? (
        <ErrorState title="Overview couldn’t load" error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <>
          <div className="summary-grid">
            <SummaryCard icon={<FileText size={18} />} label="All requests" value={overview.data.counts.NEW + overview.data.counts.QUALIFIED + overview.data.counts.CLOSED} tone="blue" />
            <SummaryCard icon={<Clock3 size={18} />} label="New requests" value={overview.data.counts.NEW} tone="amber" />
            <SummaryCard icon={<Layers3 size={18} />} label="Work items" value={overview.data.workItems} tone="green" />
            <SummaryCard icon={<BriefcaseBusiness size={18} />} label="Activity events" value={overview.data.activity} tone="slate" />
          </div>
          <div className="overview-status">
            <div><span className="eyebrow">REQUEST PIPELINE</span><h2>Where things stand</h2></div>
            <div className="status-counts">
              <Link to="/requests?status=NEW"><span className="status-dot status-dot-new" /> New <strong>{overview.data.counts.NEW}</strong></Link>
              <Link to="/requests?status=QUALIFIED"><span className="status-dot status-dot-qualified" /> Qualified <strong>{overview.data.counts.QUALIFIED}</strong></Link>
              <Link to="/requests?status=CLOSED"><span className="status-dot status-dot-closed" /> Closed <strong>{overview.data.counts.CLOSED}</strong></Link>
            </div>
          </div>
          <section className="surface-card recent-card">
            <div className="section-header"><div><h2>Recently received</h2><p>The latest conversations in {user?.workspaceName}.</p></div><Link className="text-link" to="/requests">All requests <ArrowRight size={15} /></Link></div>
            {overview.data.recentRequests.length === 0 ? (
              <EmptyState title="Your request list is clear" message="New customer requests will appear here." />
            ) : (
              <div className="recent-list">{overview.data.recentRequests.map((item) => <RecentRequest key={item.id} request={item} />)}</div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) {
  return <div className="summary-card"><span className={`summary-icon summary-${tone}`}>{icon}</span><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function RecentRequest({ request }: { request: DeskRequest }) {
  return (
    <Link className="recent-row" to={`/requests/${request.id}`}>
      <span className="recent-initials">{request.customer_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
      <span className="recent-request-copy"><strong>{request.customer_name}</strong><small>{request.service}</small></span>
      <span className="recent-service">{request.service}</span>
      <PriorityBadge priority={request.priority} />
      <StatusBadge status={request.status} />
      <ArrowRight size={16} className="recent-arrow" />
    </Link>
  );
}
