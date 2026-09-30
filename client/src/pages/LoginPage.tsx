import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError, login } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { OmniMark } from "../components/OmniMark";

const demoAccounts = [
  { workspace: "Pune Home Services", email: "saqib@omni.example" },
  { workspace: "Chennai Beauty & Wellness", email: "ananya@chennaibeauty.example" },
];

interface LoginLocationState {
  from?: { pathname?: string; search?: string; hash?: string };
  sessionExpired?: boolean;
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState<Record<string, string>>({});
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const routeState = location.state as LoginLocationState | null;
  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (credentials) => {
      auth.signIn(credentials);
      auth.clearSessionMessage();
      const destination = routeState?.from;
      const next = destination?.pathname?.startsWith("/")
        ? `${destination.pathname}${destination.search ?? ""}${destination.hash ?? ""}`
        : "/";
      navigate(next, { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError) setValidation(error.fields);
    },
  });
  if (auth.token && auth.user) {
    return <div className="app-loading"><span className="spinner" />Opening your workspace…</div>;
  }

  const message = mutation.error instanceof ApiError && mutation.error.code === "RATE_LIMITED"
    ? `Too many attempts, try again in ${Math.max(1, Math.ceil((mutation.error.retryAfter ?? 900) / 60))} minutes.`
    : mutation.error instanceof Error
      ? mutation.error.message
      : "";

  if (auth.token && auth.user) {
    const destination = routeState?.from;
    const next = destination?.pathname?.startsWith("/")
      ? `${destination.pathname}${destination.search ?? ""}${destination.hash ?? ""}`
      : "/";
    return <Navigate to={next} replace />;
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidation({});
    mutation.mutate();
  };

  return (
    <main className="login-layout">
      <section className="login-panel">
        <div className="login-brand"><OmniMark /><span>Omni Studio</span></div>
        <div className="login-heading">
          <p className="eyebrow">OMNI CLIENT SYSTEM</p>
          <h1>Welcome to your<br />workspace.</h1>
          <p>Sign in to take care of the people who count on you.</p>
        </div>
        {routeState?.sessionExpired && (
          <div className="inline-alert" role="alert">Your session expired, please log in again.</div>
        )}
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            className={validation.email ? "field-invalid" : ""}
            type="email"
            autoComplete="username"
            placeholder="you@yourbusiness.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {validation.email && <span className="field-error">{validation.email}</span>}
          <label htmlFor="password">Password</label>
          <div className={`password-input ${validation.password ? "field-invalid" : ""}`}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {validation.password && <span className="field-error">{validation.password}</span>}
          {message && <div className="inline-alert" role="alert">{message}</div>}
          <button className="button button-primary login-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <><span className="spinner" /> Signing in…</> : <>Sign in <ArrowRight size={17} /> </>}
          </button>
        </form>
        <div className="demo-credentials">
          <span className="eyebrow">DEMO WORKSPACES</span>
          {demoAccounts.map((account) => (
            <button type="button" key={account.email} onClick={() => setEmail(account.email)}>
              <span>{account.workspace}</span><strong>{account.email}</strong>
            </button>
          ))}
          <small>Demo password: <strong>Demo@1234</strong></small>
        </div>
        <p className="login-security"><span className="online-dot" /> Each team sees only its own workspace.</p>
      </section>
      <aside className="login-aside">
        <div className="login-aside-orb orb-a" /><div className="login-aside-orb orb-b" />
        <div className="login-aside-copy">
          <span className="login-aside-icon"><OmniMark /></span>
          <p>Good work<br />starts with<br /><em>good listening.</em></p>
          <span>One thoughtful place for every customer conversation.</span>
        </div>
        <div className="login-aside-foot">OMNI CLIENT SYSTEM <span>·</span> YOUR TEAM, IN SYNC</div>
      </aside>
    </main>
  );
}
