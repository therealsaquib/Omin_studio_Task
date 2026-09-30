import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Activity, BriefcaseBusiness, ChevronDown, FileText, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getOverview } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { OmniMark } from "./OmniMark";

const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/requests", label: "Requests", icon: FileText, count: "requests" },
  { to: "/work-items", label: "Work Items", icon: BriefcaseBusiness, count: "workItems" },
  { to: "/activity", label: "Activity", icon: Activity, count: "activity" },
];

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function AppShell() {
  const { token, user, signOut } = useAuth();
  const overview = useQuery({
    queryKey: ["overview", token],
    queryFn: () => getOverview(token!),
    enabled: !!token,
    staleTime: 20_000,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const renderNav = (closeDrawer = false) => (
    <nav className="side-nav" aria-label="Main navigation">
      <span className="nav-section-label">WORKSPACE</span>
      {links.map(({ to, label, icon: Icon, count }) => {
        const quantity = count === "requests"
          ? (overview.data?.counts.NEW ?? 0) + (overview.data?.counts.QUALIFIED ?? 0) + (overview.data?.counts.CLOSED ?? 0)
          : count ? overview.data?.[count as "workItems" | "activity"] : undefined;
        return (
          <NavLink
            key={to}
            end={to === "/"}
            to={to}
            onClick={() => closeDrawer && setDrawerOpen(false)}
            className={({ isActive }) => `side-link ${isActive ? "side-link-active" : ""}`}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
            {count && <span className="nav-badge">{quantity ?? "—"}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="app-frame">
      <header className="top-header">
        <div className="header-left">
          <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <Dialog.Trigger asChild>
              <button className="icon-button hamburger" aria-label="Open navigation"><Menu size={20} /></button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="drawer-overlay" />
              <Dialog.Content className="mobile-drawer">
                <div className="drawer-heading"><Brand /><Dialog.Close asChild><button className="icon-button" aria-label="Close navigation"><X size={18} /></button></Dialog.Close></div>
                {renderNav(true)}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <Link className="brand-lockup" to="/">
            <OmniMark />
            <span>Omni Studio</span>
          </Link>
        </div>
        <details className="profile-menu">
          <summary>
            <span className="profile-avatar">{initials(user?.name ?? "OC")}</span>
            <span className="profile-summary"><strong>{user?.name}</strong><small>{user?.workspaceName}</small></span>
            <ChevronDown size={16} />
          </summary>
          <div className="profile-dropdown">
            <div className="profile-dropdown-user">
              <strong>{user?.name}</strong><span>{user?.email}</span>
              <div className="profile-meta"><span>{user?.role}</span><span>{user?.workspaceName}</span></div>
            </div>
            <button onClick={signOut}><LogOut size={16} /> Log out</button>
          </div>
        </details>
      </header>
      <aside className="desktop-sidebar">{renderNav()}</aside>
      <main className="main-content"><div className="content-card"><Outlet /></div></main>
    </div>
  );
}

function Brand() {
  return <Link className="brand-lockup" to="/"><OmniMark /><span>Omni Studio</span></Link>;
}
