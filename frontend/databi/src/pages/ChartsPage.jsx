import { useEffect, useState } from "react";

const ChartsPage = ({ selectedOrg, token, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Card, Spinner, EmptyState } = ui;
  const { useTheme } = hooks;
  const t = useTheme();

  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const orgQuery = selectedOrg?.id ? `?organization=${selectedOrg.id}` : "";
      const data = await api(`/charts/${orgQuery}`, {}, token);
      setCharts(data?.results || data || []);
    } catch (e) {
      setError(getApiErrorMessage?.(e, "Failed to load charts.") || "Failed to load charts.");
      setCharts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token, selectedOrg?.id]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: "1.4rem", height: "100%", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="heading" style={{ fontSize: "1.6rem", fontWeight: 800 }}>Charts</h1>
          <p style={{ color: t.textMuted, fontSize: "0.85rem" }}>Saved charts for your organization</p>
        </div>
        <Btn variant="secondary" onClick={load}>Refresh</Btn>
      </div>

      {error && (
        <div style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: "0.82rem" }}>
          {error}
        </div>
      )}

      {charts.length === 0 ? (
        <Card>
          <EmptyState icon="chart" title="No charts yet" desc="Create charts from the dashboard/chart builder." />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "0.8rem" }}>
          {charts.map((c) => (
            <Card key={c.id}>
              <p className="heading" style={{ fontSize: "1rem", fontWeight: 700 }}>{c.name || `Chart #${c.id}`}</p>
              <p style={{ marginTop: "0.35rem", color: t.textMuted, fontSize: "0.8rem" }}>
                {(c.chart_type || "bar").toUpperCase()} | {(c.aggregation || "sum").toUpperCase()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChartsPage;
