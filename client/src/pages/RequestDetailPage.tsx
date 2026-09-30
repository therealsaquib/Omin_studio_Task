import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Check, Edit3, Mail, MapPin, Phone } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, convertRequest, getRequest } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { EmptyState, ErrorState, LoadingCards, PriorityBadge, StatusBadge, formatDate, formatDateTime, shortInitials } from "../components/States";
import { ConfirmDialog } from "../components/ui";
import { notifyToast } from "../components/ToastViewport";

const actionLabels: Record<string, string> = {
  REQUEST_CREATED: "Request created",
  REQUEST_QUALIFIED: "Request qualified",
  REQUEST_UPDATED: "Request details updated",
  WORK_ITEM_CREATED: "Work item created",
};

export function RequestDetailPage() {
  const { id = "" } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const detail = useQuery({
    queryKey: ["request", token, id],
    queryFn: () => getRequest(token!, id),
    enabled: !!token && /^\d+$/.test(id),
    staleTime: 15_000,
  });
  const conversion = useMutation({
    mutationFn: () => convertRequest(token!, id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["request", token, id] }),
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["work-items"] }),
        queryClient.invalidateQueries({ queryKey: ["activities"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
      setConfirmOpen(false);
      notifyToast("Work item created successfully.", "success");
    },
    onError: (error) => notifyToast(error instanceof Error ? error.message : "Could not create the work item."),
  });

  if (!/^\d+$/.test(id)) return <section className="page-section"><EmptyState title="Request not found" message="The request ID is not valid for this workspace." action={<Link className="button button-secondary" to="/requests">Back to requests</Link>} /></section>;
  if (detail.isPending) return <section className="page-section"><LoadingCards count={2} /></section>;
  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.status === 404) {
      return <section className="page-section"><EmptyState title="Request not found" message="It may have been removed, or it belongs to another workspace." action={<Link className="button button-secondary" to="/requests">Back to requests</Link>} /></section>;
    }
    return <section className="page-section"><ErrorState title="Request couldn’t load" error={detail.error} onRetry={() => void detail.refetch()} /></section>;
  }

  const { request, activities } = detail.data;
  const hasWorkItem = !!request.work_item_id;
  const suggestQualification = request.status === "NEW";
  return (
    <section className="page-section">
      <button className="back-link" onClick={() => navigate("/requests")}><ArrowLeft size={16} /> All requests</button>
      <div className="detail-title-row">
        <div><p className="eyebrow">REQUEST DETAILS</p><h1>{request.customer_name}</h1><div className="detail-title-meta"><StatusBadge status={request.status} /><PriorityBadge priority={request.priority} /></div></div>
        <div className="detail-title-actions">
          <Link className="button button-secondary" to={`/requests/${request.id}/edit`} state={suggestQualification ? { suggestedStatus: "QUALIFIED" } : undefined}><Edit3 size={16} /> Edit</Link>
          {hasWorkItem && <span className="work-created"><Check size={15} /> Work item created</span>}
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-left-column">
          <section className="surface-card detail-info-card">
            <div className="detail-customer-head"><span className="customer-avatar customer-avatar-large">{shortInitials(request.customer_name)}</span><div><h2>{request.customer_name}</h2><p>Customer request</p></div></div>
            <div className="detail-info-list">
              <DetailField icon={<BriefcaseBusiness size={17} />} label="Service requested" value={request.service} />
              <DetailField icon={<CalendarDays size={17} />} label="Scheduled date" value={formatDate(request.scheduled_date)} />
              <DetailField icon={<Phone size={17} />} label="Phone" value={request.customer_phone} />
              <DetailField icon={<Mail size={17} />} label="Email" value={request.customer_email} />
              <DetailField icon={<MapPin size={17} />} label="City" value={request.customer_city} />
            </div>
          </section>
          <section className="suggested-panel">
            <p className="eyebrow">SUGGESTED NEXT ACTION</p>
            {suggestQualification ? <><h2>See if it’s a good fit.</h2><p>Review the details and qualify this request when it’s ready.</p><Link className="button button-secondary" to={`/requests/${request.id}/edit`} state={{ suggestedStatus: "QUALIFIED" }}>Qualify request <Check size={15} /></Link></> :
              request.status === "QUALIFIED" && !hasWorkItem ? <><h2>Make room for the work.</h2><p>This request is qualified and ready to move into your team’s work list.</p><button className="button button-primary" onClick={() => setConfirmOpen(true)}>Create work item <BriefcaseBusiness size={15} /></button></> :
                request.status === "CLOSED" ? <><h2>All wrapped up.</h2><p>This request is closed. There’s no further action to take.</p><span className="suggestion-done"><Check size={15} /> Complete</span></> :
                  <><h2>Ready for the team.</h2><p>This request is now on the work list.</p><span className="suggestion-done"><Check size={15} /> Work item created</span></>}
          </section>
        </div>
        <section className="surface-card activity-panel">
          <div className="section-header"><div><h2>Activity timeline</h2><p>Every update, all in one place.</p></div><span className="count-pill">{activities.length}</span></div>
          {activities.length === 0 ? <EmptyState title="No activity yet" message="Changes and work item updates will show up here." /> : (
            <ol className="activity-timeline">{activities.map((activity, index) => (
              <li key={activity.id}>
                <span className={`timeline-marker ${activity.action === "WORK_ITEM_CREATED" ? "timeline-marker-work" : ""}`}>{activity.action === "WORK_ITEM_CREATED" ? <BriefcaseBusiness size={13} /> : <Check size={13} />}</span>
                <div><strong>{actionLabels[activity.action] ?? activity.action.replaceAll("_", " ").toLowerCase()}</strong><p>{activity.user_name} <span>·</span> {formatDateTime(activity.created_at)}</p></div>
                {index < activities.length - 1 && <span className="timeline-rail" />}
              </li>
            ))}</ol>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Create a work item?"
        description="Confirm the customer and schedule before adding this request to the work list."
        details={<div className="confirm-details"><div><span>Customer</span><strong>{request.customer_name}</strong></div><div><span>Service</span><strong>{request.service}</strong></div><div><span>Scheduled date</span><strong>{formatDate(request.scheduled_date)}</strong></div></div>}
        confirmLabel="Confirm"
        pending={conversion.isPending}
        onConfirm={() => conversion.mutate()}
      />
    </section>
  );
}

function DetailField({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="detail-field"><span className="detail-field-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}
