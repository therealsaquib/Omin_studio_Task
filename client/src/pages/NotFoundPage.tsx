import { Link } from "react-router-dom";
import { OmniMark } from "../components/OmniMark";

export function NotFoundPage() {
  return <main className="not-found-page"><Link className="brand-lockup" to="/"><OmniMark /><span>Omni Studio</span></Link><div className="not-found-card"><p className="eyebrow">404 · NOT FOUND</p><h1>This page isn’t here.</h1><p>The address may have changed, or the page may no longer exist.</p><Link className="button button-primary" to="/">Back to overview</Link></div></main>;
}
