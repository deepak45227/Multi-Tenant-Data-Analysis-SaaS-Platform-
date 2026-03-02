import { useState, useEffect } from "react";

const Overview = ({ selectedOrg, token, setActive, api, ui, hooks }) => {
  const { Btn, Card, Badge, Spinner, EmptyState, Icon } = ui;
  const { useTheme, useAuth } = hooks;
  const t = useTheme();
  const { user } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/datasets/list/", {}, token)
      .then((d) => setDatasets(d.datasets || d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, api]);

  const stats = [
    { label: "Datasets", value: datasets.length || 0, icon: "dataset", action: "datasets" },
    { label: "Organization", value: selectedOrg?.name || "-", icon: "org", action: null },
    { label: "Active Queries", value: "-", icon: "query", action: "queries" },
    { label: "Reports", value: "-", icon: "report", action: "reports" },
  ];

  const quickActions = [
    { label: "Upload new dataset", icon: "upload", page: "datasets" },
    { label: "Open pipeline editor", icon: "pipeline", page: "pipeline" },
    { label: "Run SQL query", icon: "sql", page: "queries" },
    { label: "Open reports", icon: "report", page: "reports" },
  ];

  return (
    <div className="fade-in" style={{ padding: "2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 className="heading" style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.3rem" }}>
          Good morning, {user?.username}
        </h1>
        <p style={{ color: t.textMuted, fontSize: "0.9rem" }}>Here is what is happening in your workspace today.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {stats.map((s, i) => (
          <Card key={i} hover={!!s.action} onClick={s.action ? () => setActive(s.action) : undefined} style={{ cursor: s.action ? "pointer" : "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "9px", background: t.accentGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={s.icon} size={18} style={{ color: t.accent }} />
              </div>
            </div>
            <p style={{ fontSize: "0.75rem", color: t.textMuted, marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{s.label}</p>
            <p className="heading" style={{ fontSize: "1.6rem", fontWeight: 800 }}>{loading && s.label === "Datasets" ? "..." : s.value}</p>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <Card>
          <h3 className="heading" style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem" }}>Recent Datasets</h3>
          {loading ? (
            <Spinner />
          ) : datasets.length === 0 ? (
            <EmptyState
              icon="dataset"
              title="No datasets yet"
              desc="Upload your first dataset to get started."
              action={<Btn variant="primary" size="sm" onClick={() => setActive("datasets")} icon="upload">Upload Dataset</Btn>}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {datasets.slice(0, 5).map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.75rem", borderRadius: "8px", background: t.surfaceAlt }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <Icon name="dataset" size={15} style={{ color: t.accent }} />
                    <span style={{ fontSize: "0.855rem", fontWeight: 500 }}>{d.name || d.dataset_name}</span>
                  </div>
                  <Badge color="blue">v{d.version_count || 1}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h3 className="heading" style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem" }}>Quick Actions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {quickActions.map((a, i) => (
              <div
                key={i}
                onClick={() => setActive(a.page)}
                style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 0.9rem", borderRadius: "9px", border: `1px solid ${t.border}`, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = t.accentGlow;
                  e.currentTarget.style.borderColor = t.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = t.border;
                }}
              >
                <Icon name={a.icon} size={16} style={{ color: t.accent }} />
                <span style={{ fontSize: "0.855rem", fontWeight: 500 }}>{a.label}</span>
                <Icon name="chevron" size={14} style={{ marginLeft: "auto", color: t.textSubtle }} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Overview;
