import { useState, useEffect, createContext, useContext } from "react";
import Landing from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import AccountPage from "./pages/AccountPage";
import Overview from "./pages/OverviewPage";
import DatasetsPage from "./pages/DatasetsPage";
import PipelinePage from "./pages/PipelinePage";
import QueriesPage from "./pages/QueriesPage";
import ChartsPage from "./pages/ChartsPage";
import ReportsPage from "./pages/ReportsPage";
import AdminPanelPage from "./pages/AdminPanelPage";
import OrgSetupPage from "./pages/OrgSetupPage";
import Sidebar from "./layout/Sidebar";
import DashboardsPage from "./pages/DashboardsPage";

// ── API CONFIG ──────────────────────────────────────────────────────────────
const DEFAULT_PROD_API_BASE = "https://backend-multi-tenant-data-analysis-saas-platform-production.up.railway.app/api";
const BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:8000/api" : DEFAULT_PROD_API_BASE)
).replace(/\/+$/, "");
const api = async (path, opts = {}, token = null) => {
  const headers = { ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...opts, headers });
  } catch {
    throw { status: 0, data: { detail: `Cannot reach backend API at ${BASE}. Verify the deployed API URL and CORS settings.` } };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
};

const getApiErrorMessage = (e, fallback = "Request failed.") => {
  if (!e?.data) return fallback;
  if (typeof e.data === "string") return e.data;
  if (e.data.detail) return e.data.detail;
  if (e.data.error) return e.data.error;
  const firstFieldError = Object.values(e.data).find(v => Array.isArray(v) && v.length > 0);
  if (firstFieldError) return firstFieldError[0];
  return fallback;
};

// ── ICONS (inline SVG) ──────────────────────────────────────────────────────
const Icon = ({ name, size = 18, className = "" }) => {
  const icons = {
    logo: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7" strokeWidth="2.5" strokeLinecap="round"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="3" y="12" width="18" height="9" rx="1"/></>,
    dataset: <><ellipse cx="12" cy="6" rx="9" ry="3"/><path d="M3 6v6c0 1.66 4.03 3 9 3s9-1.34 9-3V6"/><path d="M3 12v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/></>,
    pipeline: <><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="M7 12h10M12 7v10"/></>,
    chart: <><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-8"/></>,
    query: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></>,
    org: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    upload: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    sun: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
    moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    close: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    play: <polygon points="5 3 19 12 5 21 5 3"/>,
    undo: <><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
    chevron: <polyline points="9 18 15 12 9 6"/>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    report: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    sql: <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
    arrow: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  );
};

// ── THEME ───────────────────────────────────────────────────────────────────
const themes = {
  dark: {
    bg: "#0d0f14",
    surface: "#13161e",
    surfaceAlt: "#1a1e2a",
    border: "#232738",
    borderHover: "#3a4060",
    text: "#e8ecf5",
    textMuted: "#7a84a0",
    textSubtle: "#4a5270",
    accent: "#4f7dff",
    accentHover: "#6690ff",
    accentGlow: "rgba(79,125,255,0.15)",
    success: "#22c97a",
    warning: "#f5a623",
    danger: "#ff4d6a",
    card: "#161a24",
    cardHover: "#1e2333",
    sidebar: "#0f111a",
    sidebarBorder: "#1c2030",
    glass: "rgba(255,255,255,0.03)",
    shadow: "0 4px 24px rgba(0,0,0,0.4)",
    shadowLg: "0 8px 48px rgba(0,0,0,0.6)",
  },
  light: {
    bg: "#f0f2f8",
    surface: "#ffffff",
    surfaceAlt: "#f7f8fc",
    border: "#e2e5f0",
    borderHover: "#c5ccdf",
    text: "#1a1e2e",
    textMuted: "#6370a0",
    textSubtle: "#9aa0be",
    accent: "#4f7dff",
    accentHover: "#3a6aff",
    accentGlow: "rgba(79,125,255,0.1)",
    success: "#16a85e",
    warning: "#d4880a",
    danger: "#e63650",
    card: "#ffffff",
    cardHover: "#f4f5fb",
    sidebar: "#ffffff",
    sidebarBorder: "#e8ecf5",
    glass: "rgba(255,255,255,0.8)",
    shadow: "0 2px 16px rgba(0,0,0,0.08)",
    shadowLg: "0 8px 40px rgba(0,0,0,0.12)",
  },
};

// ── GLOBAL STYLES ───────────────────────────────────────────────────────────
const GlobalStyle = ({ t }) => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { color-scheme: ${t === themes.dark ? "dark" : "light"}; }
    body { font-family: 'DM Sans', sans-serif; background: ${t.bg}; color: ${t.text}; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: ${t.surface}; }
    ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: ${t.borderHover}; }
    input, textarea, select { font-family: inherit; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes slideIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .fade-in { animation: fadeIn 0.3s ease both; }
    .slide-in { animation: slideIn 0.25s ease both; }
    .spin { animation: spin 0.8s linear infinite; }
    .mono { font-family: 'DM Mono', monospace; }
    .heading { font-family: 'Syne', sans-serif; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; }
  `}</style>
);

// ── REUSABLE COMPONENTS ─────────────────────────────────────────────────────
const Btn = ({ children, variant = "primary", size = "md", onClick, disabled, loading, icon, style = {} }) => {
  const t = useTheme();
  const sizes = { sm: "0.5rem 0.9rem", md: "0.65rem 1.2rem", lg: "0.85rem 1.8rem" };
  const fontSizes = { sm: "0.78rem", md: "0.875rem", lg: "0.95rem" };
  const vars = {
    primary: { bg: t.accent, color: "#fff", border: t.accent, hoverBg: t.accentHover },
    secondary: { bg: "transparent", color: t.text, border: t.border, hoverBg: t.surfaceAlt },
    danger: { bg: "transparent", color: t.danger, border: t.danger, hoverBg: "rgba(255,77,106,0.08)" },
    ghost: { bg: "transparent", color: t.textMuted, border: "transparent", hoverBg: t.surfaceAlt },
    success: { bg: "transparent", color: t.success, border: t.success, hoverBg: "rgba(34,201,122,0.08)" },
  };
  const v = vars[variant];
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      display: "inline-flex", alignItems: "center", gap: "0.4rem",
      padding: sizes[size], fontSize: fontSizes[size], fontFamily: "DM Sans, sans-serif",
      fontWeight: 500, borderRadius: "8px", border: `1px solid ${v.border}`,
      background: v.bg, color: v.color, cursor: disabled || loading ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1, transition: "all 0.18s ease", whiteSpace: "nowrap", ...style
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = v.hoverBg; e.currentTarget.style.transform = "translateY(-1px)"; }}}
      onMouseLeave={e => { e.currentTarget.style.background = v.bg; e.currentTarget.style.transform = ""; }}>
      {loading ? <Icon name="settings" size={14} className="spin" /> : icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
};

const Input = ({ label, value, onChange, type = "text", placeholder, mono, required, style = {} }) => {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", ...style }}>
      {label && <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}{required && <span style={{ color: t.accent }}>*</span>}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${focused ? t.accent : t.border}`,
          background: t.surfaceAlt, color: t.text, fontSize: "0.875rem",
          fontFamily: mono ? "DM Mono, monospace" : "DM Sans, sans-serif",
          outline: "none", transition: "border-color 0.15s", boxShadow: focused ? `0 0 0 3px ${t.accentGlow}` : "none"
        }} />
    </div>
  );
};

const Card = ({ children, style = {}, onClick, hover = false }) => {
  const t = useTheme();
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => hover && setHov(true)} onMouseLeave={() => hover && setHov(false)}
      style={{
        background: hov ? t.cardHover : t.card, border: `1px solid ${hov ? t.borderHover : t.border}`,
        borderRadius: "12px", padding: "1.25rem", transition: "all 0.2s ease",
        cursor: onClick ? "pointer" : "default", boxShadow: hov ? t.shadowLg : t.shadow, ...style
      }}>
      {children}
    </div>
  );
};

const Badge = ({ children, color }) => {
  const t = useTheme();
  const colors = { blue: t.accent, green: t.success, orange: t.warning, red: t.danger };
  const c = colors[color] || t.accent;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.2rem 0.55rem", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 600, background: `${c}20`, color: c, border: `1px solid ${c}40` }}>{children}</span>;
};

const Spinner = () => {
  const t = useTheme();
  return <div style={{ width: 20, height: 20, border: `2px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%" }} className="spin" />;
};

const EmptyState = ({ icon, title, desc, action }) => {
  const t = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2rem", gap: "1rem", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "16px", background: t.accentGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={28} className="" style={{ color: t.accent }} />
      </div>
      <div><p className="heading" style={{ fontSize: "1.1rem", fontWeight: 700, color: t.text, marginBottom: "0.4rem" }}>{title}</p>
        <p style={{ fontSize: "0.875rem", color: t.textMuted, maxWidth: 320 }}>{desc}</p></div>
      {action}
    </div>
  );
};

const Modal = ({ open, onClose, title, children, width = 480 }) => {
  const t = useTheme();
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "1.5rem", width, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto", boxShadow: t.shadowLg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 className="heading" style={{ fontSize: "1.1rem", fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, borderRadius: "6px", padding: "0.25rem" }}><Icon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ── CONTEXT ─────────────────────────────────────────────────────────────────
const ThemeCtx = createContext(themes.dark);
const useTheme = () => useContext(ThemeCtx);
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);
const NavCtx = createContext(null);
const useNav = () => useContext(NavCtx);

// ── LANDING PAGE ─────────────────────────────────────────────────────────────
const AppShell = ({ token, isDark, toggleTheme }) => {
  const t = useTheme();
  const [activePage, setActivePage] = useState("overview");
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [orgLoadError, setOrgLoadError] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [pipelineDataset, setPipelineDataset] = useState(null);

  useEffect(() => {
    setOrgLoadError("");
    api("/organizations/", {}, token).then(d => {
      const list = d.results || d || [];
      setOrgs(list);
      if (list.length > 0) setSelectedOrg(list[0]);
    }).catch((e) => {
      setOrgLoadError(getApiErrorMessage(e, "Failed to load organizations."));
    }).finally(() => setLoadingOrgs(false));
  }, [token]);

  const setActiveWithPipeline = (page) => {
    if (page !== "pipeline") setPipelineDataset(null);
    setActivePage(page);
  };

  if (loadingOrgs) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><Spinner /></div>;
  if (orgs.length === 0) {
    return (
      <OrgSetupPage
        token={token}
        onDone={org => { setOrgs([org]); setSelectedOrg(org); }}
        api={api}
        getApiErrorMessage={getApiErrorMessage}
        ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }}
        hooks={{ useTheme, useAuth, useNav }}
      />
    );
  }

  const pages = {
    overview: <Overview selectedOrg={selectedOrg} token={token} setActive={setActiveWithPipeline} api={api} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />,
    admin: <AdminPanelPage selectedOrg={selectedOrg} token={token} api={api} getApiErrorMessage={getApiErrorMessage} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />,
    datasets: <DatasetsPage selectedOrg={selectedOrg} token={token} setActive={setActiveWithPipeline} setPipelineDataset={setPipelineDataset} api={api} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />,
    pipeline: <PipelinePage selectedOrg={selectedOrg} token={token} initialDataset={pipelineDataset} api={api} getApiErrorMessage={getApiErrorMessage} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />,
    queries: <QueriesPage selectedOrg={selectedOrg} token={token} api={api} getApiErrorMessage={getApiErrorMessage} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />,
    charts: <ChartsPage selectedOrg={selectedOrg} token={token} api={api} getApiErrorMessage={getApiErrorMessage} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />,
    dashboards: (
      <DashboardsPage
        selectedOrg={selectedOrg}
        token={token}
        api={api}
        getApiErrorMessage={getApiErrorMessage}
        ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }}
        hooks={{ useTheme, useAuth, useNav }}
      />
    ),
    reports: <ReportsPage selectedOrg={selectedOrg} token={token} api={api} getApiErrorMessage={getApiErrorMessage} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />,
    account: <AccountPage token={token} api={api} getApiErrorMessage={getApiErrorMessage} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />,
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar active={activePage} setActive={setActiveWithPipeline} orgs={orgs} selectedOrg={selectedOrg} setSelectedOrg={setSelectedOrg}
        collapsed={collapsed} setCollapsed={setCollapsed} isDark={isDark} toggleTheme={toggleTheme}
        ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }}
        hooks={{ useTheme, useAuth, useNav }}
      />
      <main style={{ flex: 1, overflowY: "auto", background: t.bg }}>
        {orgLoadError && (
          <div style={{ margin: "1rem 2rem", padding: "0.65rem 0.9rem", borderRadius: "8px", background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: "0.82rem" }}>
            {orgLoadError}
          </div>
        )}
        {pages[activePage] || pages.overview}
      </main>
    </div>
  );
};

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [isDark, setIsDark] = useState(true);
  const t = isDark ? themes.dark : themes.light;
  const [page, setPage] = useState("landing");
  const [actionParams, setActionParams] = useState({});
  const [auth, setAuth] = useState(() => {
    try { const s = sessionStorage.getItem("databi_auth"); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  const login = (token, user) => {
    const a = { token, user };
    setAuth(a);
    try { sessionStorage.setItem("databi_auth", JSON.stringify(a)); } catch { /* ignore storage errors */ }
    setPage("app");
  };

  const logout = () => {
    setAuth(null);
    try { sessionStorage.removeItem("databi_auth"); } catch { /* ignore storage errors */ }
    setPage("landing");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action) {
      setActionParams({
        action,
        uid: params.get("uid"),
        token: params.get("token"),
        invite: params.get("invite"),
        email: params.get("email"),
      });
      if (action === "verify") setPage("verify");
      if (action === "reset") setPage("reset");
      if (action === "register") setPage("register");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    if (auth?.token) setPage("app");
  }, []);

  const navValue = { setPage, page };
  const authValue = { login, logout, token: auth?.token, user: auth?.user };

  return (
    <ThemeCtx.Provider value={t}>
      <AuthCtx.Provider value={authValue}>
        <NavCtx.Provider value={navValue}>
          <GlobalStyle t={t} />
          {page === "landing" && <Landing ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />}
          {page === "login" && <AuthPage mode="login" api={api} getApiErrorMessage={getApiErrorMessage} actionParams={actionParams} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />}
          {page === "register" && <AuthPage mode="register" api={api} getApiErrorMessage={getApiErrorMessage} actionParams={actionParams} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />}
          {page === "forgot" && <AuthPage mode="forgot" api={api} getApiErrorMessage={getApiErrorMessage} actionParams={actionParams} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />}
          {page === "reset" && <AuthPage mode="reset" api={api} getApiErrorMessage={getApiErrorMessage} actionParams={actionParams} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />}
          {page === "verify" && <AuthPage mode="verify" api={api} getApiErrorMessage={getApiErrorMessage} actionParams={actionParams} ui={{ Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon }} hooks={{ useTheme, useAuth, useNav }} />}
          {page === "app" && auth?.token && (
            <AppShell token={auth.token} isDark={isDark} toggleTheme={() => setIsDark(p => !p)} />
          )}
        </NavCtx.Provider>
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  );
}



