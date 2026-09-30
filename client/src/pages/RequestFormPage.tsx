import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError, getRequest, saveRequest } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { ErrorState, LoadingCards } from "../components/States";
import { notifyToast } from "../components/ToastViewport";
import type { RequestInput, RequestPriority, RequestStatus } from "../types";

const formSchema = z.object({
  customer_name: z.string().trim().min(1, "Enter the customer’s name.").max(120, "Name must be 120 characters or fewer."),
  customer_phone: z.string().regex(/^\+91 [6-9]\d{4} ?\d{5}$/, "Use an Indian number in +91 format, e.g. +91 98220 10001."),
  customer_email: z.email("Enter a valid email address."),
  customer_city: z.string().trim().min(1, "Enter a city.").max(100),
  service: z.string().trim().min(1, "Describe the requested service.").max(500),
  scheduled_date: z.iso.date("Choose a valid scheduled date."),
  priority: z.enum(["URGENT", "IMPORTANT", "NORMAL"]),
  status: z.enum(["NEW", "QUALIFIED", "CLOSED"]),
});

interface FormLocationState {
  suggestedStatus?: RequestStatus;
}

export function RequestFormPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const editing = !!id && id !== "new";
  const suggestedStatus = (location.state as FormLocationState | null)?.suggestedStatus;
  const requestQuery = useQuery({
    queryKey: ["request", token, id],
    queryFn: () => getRequest(token!, id!),
    enabled: !!token && editing,
  });
  const request = requestQuery.data?.request;
  const [values, setValues] = useState<RequestInput>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_city: "",
    service: "",
    scheduled_date: "",
    priority: "NORMAL",
    status: suggestedStatus ?? "NEW",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!request) return;
    setValues({
      customer_name: request.customer_name,
      customer_phone: request.customer_phone,
      customer_email: request.customer_email,
      customer_city: request.customer_city,
      service: request.service,
      scheduled_date: request.scheduled_date,
      priority: request.priority,
      status: suggestedStatus ?? request.status,
    });
  }, [request, suggestedStatus]);

  const mutation = useMutation({
    mutationFn: (input: RequestInput) => saveRequest(token!, input, editing ? id : undefined),
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["request", token, id] }),
      ]);
      notifyToast(editing ? "Request updated." : "Request created.", "success");
      navigate(editing ? `/requests/${saved.id}` : "/requests", { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fields);
      notifyToast(error instanceof Error ? error.message : "Could not save this request.");
    },
  });

  if (editing && !/^\d+$/.test(id ?? "")) {
    return <section className="page-section"><div className="not-found-card"><h1>Request not found</h1><p>The request ID is not valid for this workspace.</p><Link className="button button-secondary" to="/requests">Back to requests</Link></div></section>;
  }
  if (editing && requestQuery.isPending) return <section className="page-section"><LoadingCards count={2} /></section>;
  if (editing && requestQuery.isError) {
    if (requestQuery.error instanceof ApiError && requestQuery.error.status === 404) {
      return <section className="page-section"><div className="not-found-card"><h1>Request not found</h1><p>It may have been removed, or it belongs to another workspace.</p><Link className="button button-secondary" to="/requests">Back to requests</Link></div></section>;
    }
    return <section className="page-section"><ErrorState title="Request couldn’t load" error={requestQuery.error} onRetry={() => void requestQuery.refetch()} /></section>;
  }

  const setField = (field: keyof RequestInput, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "_form");
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  };

  return (
    <section className="page-section form-page">
      <Link className="back-link" to={editing ? `/requests/${id}` : "/requests"}><ArrowLeft size={16} /> {editing ? "Back to request" : "Back to requests"}</Link>
      <div className="page-title-row"><div><p className="eyebrow">{editing ? "UPDATE REQUEST" : "NEW CUSTOMER REQUEST"}</p><h1>{editing ? "Edit request" : "Create a request"}</h1><p className="page-lede">The useful details help your team take care of the next step.</p></div></div>
      <form className="surface-card request-form" onSubmit={submit} noValidate>
        <div className="form-section-label"><span>01</span><div><strong>Customer details</strong><small>Who’s getting in touch?</small></div></div>
        <div className="form-grid">
          <FormField label="Customer name" id="customer_name" error={errors.customer_name}><input id="customer_name" value={values.customer_name} onChange={(event) => setField("customer_name", event.target.value)} placeholder="e.g. Priya Nair" /></FormField>
          <FormField label="Phone number" id="customer_phone" error={errors.customer_phone}><input id="customer_phone" value={values.customer_phone} onChange={(event) => setField("customer_phone", event.target.value)} placeholder="+91 98220 10001" /></FormField>
          <FormField label="Email address" id="customer_email" error={errors.customer_email}><input id="customer_email" type="email" value={values.customer_email} onChange={(event) => setField("customer_email", event.target.value)} placeholder="customer@example.in" /></FormField>
          <FormField label="City" id="customer_city" error={errors.customer_city}><input id="customer_city" value={values.customer_city} onChange={(event) => setField("customer_city", event.target.value)} placeholder="Pune" /></FormField>
        </div>
        <div className="form-section-label form-section-spaced"><span>02</span><div><strong>What do they need?</strong><small>Give the request a little context.</small></div></div>
        <FormField label="Requested service" id="service" error={errors.service}><textarea id="service" rows={3} value={values.service} onChange={(event) => setField("service", event.target.value)} placeholder="A short description of the requested service…" /></FormField>
        <div className="form-grid form-grid-three">
          <FormField label="Scheduled date" id="scheduled_date" error={errors.scheduled_date}><input id="scheduled_date" type="date" value={values.scheduled_date} onChange={(event) => setField("scheduled_date", event.target.value)} /></FormField>
          <FormField label="Priority" id="priority"><select id="priority" value={values.priority} onChange={(event) => setField("priority", event.target.value as RequestPriority)}><option value="URGENT">Urgent</option><option value="IMPORTANT">Important</option><option value="NORMAL">Normal</option></select></FormField>
          <FormField label="Status" id="status"><select id="status" value={values.status} onChange={(event) => setField("status", event.target.value as RequestStatus)}><option value="NEW">New</option><option value="QUALIFIED">Qualified</option><option value="CLOSED">Closed</option></select></FormField>
        </div>
        {mutation.error instanceof Error && <div className="inline-alert" role="alert">{mutation.error.message}</div>}
        <div className="form-actions"><Link className="button button-secondary" to={editing ? `/requests/${id}` : "/requests"}>Cancel</Link><button className="button button-primary" disabled={mutation.isPending}>{mutation.isPending ? <><span className="spinner" /> Saving…</> : <><Save size={16} /> {editing ? "Save changes" : "Create request"}</>}</button></div>
      </form>
    </section>
  );
}

function FormField({ label, id, error, children }: { label: string; id: string; error?: string; children: ReactNode }) {
  return <div className="form-field"><label htmlFor={id}>{label}</label>{children}{error && <span className="field-error">{error}</span>}</div>;
}
