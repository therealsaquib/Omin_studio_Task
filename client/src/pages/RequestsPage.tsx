import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getRequests, type RequestFilters } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { EmptyState, ErrorState, LoadingCards, PriorityBadge, StatusBadge, TableSkeleton, formatDate, shortInitials } from "../components/States";
import type { RequestPriority, RequestStatus } from "../types";

const pageSize = 10;
const validStatuses: RequestStatus[] = ["NEW", "QUALIFIED", "CLOSED"];
const validPriorities: RequestPriority[] = ["URGENT", "IMPORTANT", "NORMAL"];
type SortOrder = NonNullable<RequestFilters["sort"]>;

function readStatus(value: string | null): RequestStatus | undefined {
  return validStatuses.find((status) => status === value);
}

function readPriority(value: string | null): RequestPriority | undefined {
  return validPriorities.find((priority) => priority === value);
}

export function RequestsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParam = searchParams.get("search") ?? "";
  const [searchDraft, setSearchDraft] = useState(searchParam);
  const status = readStatus(searchParams.get("status"));
  const priority = readPriority(searchParams.get("priority"));
  const scheduledDate = searchParams.get("scheduledDate") ?? "";
  const sort = (["scheduled_asc", "scheduled_desc", "created_asc", "created_desc"].includes(searchParams.get("sort") ?? "")
    ? searchParams.get("sort")
    : "created_desc") as SortOrder;
  const page = Math.max(1, Math.trunc(Number(searchParams.get("page")) || 1));

  useEffect(() => setSearchDraft(searchParam), [searchParam]);
  useEffect(() => {
    if (searchDraft === searchParam) return;
    const timer = window.setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (searchDraft.trim()) next.set("search", searchDraft.trim());
        else next.delete("search");
        next.delete("page");
        return next;
      }, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft, searchParam, setSearchParams]);

  const filters = useMemo<RequestFilters>(() => ({
    status,
    priority,
    search: searchParam || undefined,
    scheduledDate: scheduledDate || undefined,
    sort,
    page,
    pageSize,
  }), [status, priority, searchParam, scheduledDate, sort, page]);
  const requests = useQuery({
    queryKey: ["requests", filters],
    queryFn: () => getRequests(token!, filters),
    enabled: !!token,
    staleTime: 20_000,
    placeholderData: (previous) => previous,
  });

  const updateParams = (changes: Record<string, string | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  };
  const activeFilters = !!status || !!priority || !!scheduledDate || !!searchParam;
  const totalPages = Math.max(1, Math.ceil((requests.data?.total ?? 0) / pageSize));
  const toggleSort = (column: "scheduled" | "created") => {
    const next = sort.startsWith(`${column}_`) && sort.endsWith("asc")
      ? `${column}_desc`
      : `${column}_asc`;
    updateParams({ sort: next, page: null });
  };

  return (
    <section className="page-section">
      <div className="page-title-row requests-title">
        <div><p className="eyebrow">CUSTOMER DESK</p><h1>Requests</h1><p className="page-lede">Every conversation, cared for in one place.</p></div>
        <button className="button button-primary" onClick={() => navigate("/requests/new")}>+ New request</button>
      </div>
      <div className="request-controls surface-card">
        <label className="search-control">
          <Search size={17} />
          <input aria-label="Search in requests" placeholder="Search in requests" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
          {searchDraft && <button aria-label="Clear search" onClick={() => setSearchDraft("")}><X size={15} /></button>}
        </label>
        <div className="filter-row">
          <span className="filter-by-label">Filter by</span>
          <label className={`filter-pill ${status ? "filter-pill-active" : ""}`}>
            <span>Status</span>
            <select aria-label="Status filter" value={status ?? ""} onChange={(event) => updateParams({ status: event.target.value || null, page: null })}>
              <option value="">All statuses</option><option value="NEW">New</option><option value="QUALIFIED">Qualified</option><option value="CLOSED">Closed</option>
            </select>
          </label>
          <label className={`filter-pill ${priority ? "filter-pill-active" : ""}`}>
            <span>Priority</span>
            <select aria-label="Priority filter" value={priority ?? ""} onChange={(event) => updateParams({ priority: event.target.value || null, page: null })}>
              <option value="">All priorities</option><option value="URGENT">Urgent</option><option value="IMPORTANT">Important</option><option value="NORMAL">Normal</option>
            </select>
          </label>
          <label className={`filter-pill filter-date-pill ${scheduledDate ? "filter-pill-active" : ""}`}>
            <span>Scheduled date</span>
            <input aria-label="Scheduled date filter" type="date" value={scheduledDate} onChange={(event) => updateParams({ scheduledDate: event.target.value || null, page: null })} />
          </label>
          {activeFilters && <button className="clear-filters" onClick={() => { setSearchDraft(""); setSearchParams({}); }}>Clear filters</button>}
          <label className="sort-control"><span>Sort</span>
            <select aria-label="Sort requests" value={sort} onChange={(event) => updateParams({ sort: event.target.value, page: null })}>
              <option value="created_desc">Created: newest</option><option value="created_asc">Created: oldest</option>
              <option value="scheduled_asc">Scheduled: soonest</option><option value="scheduled_desc">Scheduled: latest</option>
            </select>
          </label>
        </div>
        <div className="listed-count">{requests.isPending ? "Loading requests…" : `${requests.data?.total ?? 0} requests listed`}</div>
      </div>

      {requests.isPending ? <><div className="requests-table-card desktop-only"><TableSkeleton /></div><div className="mobile-only"><LoadingCards count={4} /></div></> : requests.isError ? (
        <ErrorState title="Requests couldn’t load" error={requests.error} onRetry={() => void requests.refetch()} />
      ) : requests.data.data.length === 0 ? (
        <div className="surface-card"><EmptyState title={activeFilters ? "No matching requests" : "No requests yet"} message={activeFilters ? "Try adjusting or clearing one or more filters." : "Customer requests for this workspace will appear here."} action={activeFilters ? <button className="button button-secondary" onClick={() => { setSearchDraft(""); setSearchParams({}); }}>Clear filters</button> : <button className="button button-primary" onClick={() => navigate("/requests/new")}>Create a request</button>} /></div>
      ) : (
        <>
          <div className="requests-table-card desktop-only">
            <div className="table-scroll"><table className="requests-table">
              <thead><tr><th>#</th><th>Customer</th><th>Service</th><th>Priority</th><th><button onClick={() => toggleSort("scheduled")}>Scheduled date {sort.startsWith("scheduled") && (sort.endsWith("asc") ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}</button></th><th><button onClick={() => toggleSort("created")}>Created date {sort.startsWith("created") && (sort.endsWith("asc") ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}</button></th><th>Work item</th><th>Status</th></tr></thead>
              <tbody>{requests.data.data.map((item, index) => <RequestTableRow key={item.id} item={item} rowNumber={(page - 1) * pageSize + index + 1} onOpen={() => navigate(`/requests/${item.id}`)} />)}</tbody>
            </table></div>
          </div>
          <div className="mobile-request-list mobile-only">{requests.data.data.map((item) => <MobileRequestCard key={item.id} item={item} onOpen={() => navigate(`/requests/${item.id}`)} />)}</div>
          <div className="pagination-row">
            <span>Showing <strong>{requests.data.total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, requests.data.total)}</strong> of <strong>{requests.data.total}</strong></span>
            <div><button aria-label="Previous page" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}><ChevronLeft size={16} /></button><span>Page {page} of {totalPages}</span><button aria-label="Next page" disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}><ChevronRight size={16} /></button></div>
          </div>
        </>
      )}
    </section>
  );
}

const RequestTableRow = memo(function RequestTableRow({
  item, rowNumber, onOpen,
}: {
  item: import("../types").DeskRequest;
  rowNumber: number;
  onOpen: () => void;
}) {
  return (
    <tr onClick={onOpen} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }}>
      <td className="row-number">{rowNumber}</td>
      <td><div className="customer-info"><span className="customer-avatar">{shortInitials(item.customer_name)}</span><span><strong>{item.customer_name}</strong><small>{item.customer_phone} · {item.customer_email}</small></span><ArrowUpRight className="customer-open-icon" size={14} /></div></td>
      <td className="service-cell">{item.service}</td>
      <td><PriorityBadge priority={item.priority} /></td>
      <td>{formatDate(item.scheduled_date)}</td>
      <td>{formatDate(item.created_at)}</td>
      <td>{item.work_item_id ? <span className="work-created">Created</span> : <span className="work-none">—</span>}</td>
      <td><StatusBadge status={item.status} /></td>
    </tr>
  );
});

const MobileRequestCard = memo(function MobileRequestCard({
  item, onOpen,
}: {
  item: import("../types").DeskRequest;
  onOpen: () => void;
}) {
  return (
    <button className="mobile-request-card" onClick={onOpen}>
      <div className="mobile-request-top"><strong>{item.customer_name}</strong><StatusBadge status={item.status} /></div>
      <span className="mobile-request-service">{item.service}</span>
      <div className="mobile-request-meta"><span>{formatDate(item.scheduled_date)}</span><PriorityBadge priority={item.priority} /></div>
    </button>
  );
});
