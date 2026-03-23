import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const Sidebar = ({ active, setActive, orgs, selectedOrg, setSelectedOrg, collapsed, setCollapsed, isDark, toggleTheme, ui, hooks }) => {
  const { Icon } = ui;
  const { useTheme, useAuth } = hooks;
  const t = useTheme();
  const { logout, user } = useAuth();
  const orgRole = String(selectedOrg?.current_user_role || "member");
  const canManageMembers = orgRole === "owner" || orgRole === "admin";
  const navItems = [
    { id: "overview", icon: "dashboard", label: "Overview" },
    ...(canManageMembers ? [{ id: "admin", icon: "settings", label: "Admin Panel" }] : []),
    { id: "datasets", icon: "dataset", label: "Datasets" },
    { id: "pipeline", icon: "pipeline", label: "Pipeline Editor" },
    { id: "queries", icon: "query", label: "SQL Queries" },
    { id: "charts", icon: "chart", label: "Charts" },
    { id: "dashboards", icon: "dashboard", label: "Dashboards" },
    { id: "reports", icon: "report", label: "Reports" },
    { id: "account", icon: "org", label: "Account" },
  ];

  return (
    <div style={{
      width: collapsed ? 64 : 220, flexShrink: 0, background: t.sidebar, borderRight: `1px solid ${t.sidebarBorder}`,
      display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, transition: "width 0.25s ease", overflow: "hidden"
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? "1.2rem 0" : "1.2rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem", borderBottom: `1px solid ${t.sidebarBorder}`, justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 28, height: 28, borderRadius: "7px", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="logo" size={15} />
            </div>
            <span className="heading" style={{ fontSize: "1rem", fontWeight: 800, whiteSpace: "nowrap" }}>data<span style={{ color: t.accent }}>bi</span></span>
          </div>
        )}
        {collapsed && <div style={{ width: 28, height: 28, borderRadius: "7px", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="logo" size={15} /></div>}
        {!collapsed && <button onClick={() => setCollapsed(true)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "0.2rem" }}><Icon name="chevron" size={14} /></button>}
      </div>

      {/* Org picker */}
      {!collapsed && orgs.length > 0 && (
        <div style={{ padding: "0.75rem", borderBottom: `1px solid ${t.sidebarBorder}` }}>
          <select value={selectedOrg?.id || ""} onChange={e => setSelectedOrg(orgs.find(o => o.id == e.target.value))}
            style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.8rem", fontFamily: "DM Sans, sans-serif" }}>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.75rem", overflowY: "auto" }}>
        {navItems.map(item => {
          const isActive = active === item.id;
          return (
            <div key={item.id} onClick={() => setActive(item.id)} title={collapsed ? item.label : ""}
              style={{
                display: "flex", alignItems: "center", gap: "0.65rem", padding: collapsed ? "0.7rem 0" : "0.6rem 0.75rem",
                borderRadius: "8px", marginBottom: "0.15rem", cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start",
                background: isActive ? t.accentGlow : "transparent", color: isActive ? t.accent : t.textMuted,
                fontWeight: isActive ? 600 : 400, fontSize: "0.855rem", transition: "all 0.15s", whiteSpace: "nowrap"
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = t.surfaceAlt; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
              <Icon name={item.icon} size={17} />
              {!collapsed && item.label}
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: collapsed ? "0.75rem 0" : "0.75rem", borderTop: `1px solid ${t.sidebarBorder}`, display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: collapsed ? "center" : "stretch" }}>
        <div onClick={toggleTheme} title="Toggle theme"
          style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: collapsed ? "0.6rem 0" : "0.6rem 0.75rem", borderRadius: "8px", cursor: "pointer", color: t.textMuted, fontSize: "0.82rem", justifyContent: collapsed ? "center" : "flex-start" }}
          onMouseEnter={e => e.currentTarget.style.background = t.surfaceAlt}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <Icon name={isDark ? "sun" : "moon"} size={16} />
          {!collapsed && (isDark ? "Light Mode" : "Dark Mode")}
        </div>
        {collapsed && <div style={{ borderTop: `1px solid ${t.sidebarBorder}`, margin: "0.25rem 0" }} />}
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.75rem", borderRadius: "8px", background: t.surfaceAlt }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#fff" }}>{user?.username?.[0]?.toUpperCase()}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.username}</p>
              <p style={{ fontSize: "0.7rem", color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</p>
            </div>
            <button onClick={logout} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted }}><Icon name="logout" size={14} /></button>
          </div>
        )}
        {collapsed && <div onClick={logout} title="Logout" style={{ cursor: "pointer", color: t.textMuted, display: "flex", justifyContent: "center" }}><Icon name="logout" size={16} /></div>}
        {collapsed && <div onClick={() => setCollapsed(false)} title="Expand" style={{ cursor: "pointer", color: t.textMuted, display: "flex", justifyContent: "center", transform: "rotate(180deg)" }}><Icon name="chevron" size={15} /></div>}
      </div>
    </div>
  );
};

export default Sidebar;

// ── OVERVIEW PAGE ─────────────────────────────────────────────────────────────

