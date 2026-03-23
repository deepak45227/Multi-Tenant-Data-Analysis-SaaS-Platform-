import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = ["#2f80ed", "#16a085", "#f39c12", "#e74c3c", "#8e44ad", "#2c3e50", "#00b894", "#d35400"];

const asList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  return [];
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const DashboardChartCard = ({ item, t }) => {
  const rows = Array.isArray(item?.data) ? item.data : [];
  const hasRows = rows.length > 0;
  const firstRow = hasRows ? rows[0] : null;
  const keys = firstRow ? Object.keys(firstRow) : [];
  const dimensionKey = keys.includes("dimension") ? "dimension" : (keys[0] || "");
  const valueKey = keys.includes("value") ? "value" : (keys[1] || keys[0] || "");
  const title = item?.chart_name || `Chart #${item?.chart_id || "-"}`;
  const chartType = String(item?.chart_type || "table").toLowerCase();

  return (
    <div
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: "14px",
        background: t.surface,
        padding: "0.8rem",
        display: "flex",
        flexDirection: "column",
        minHeight: 300,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.7rem" }}>
        <div style={{ minWidth: 0 }}>
          <p className="heading" style={{ fontSize: "0.98rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</p>
          <p style={{ fontSize: "0.74rem", color: t.textMuted }}>{chartType.toUpperCase()} | {rows.length} rows</p>
        </div>
      </div>

      {!hasRows ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted, fontSize: "0.82rem" }}>
          No data returned for this chart.
        </div>
      ) : chartType === "table" ? (
        <div style={{ flex: 1, overflow: "auto", borderRadius: "10px", border: `1px solid ${t.border}` }}>
          <table style={{ fontSize: "0.76rem", minWidth: "100%" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.surfaceAlt }}>
                {keys.map((k) => (
                  <th key={k} style={{ padding: "0.45rem 0.6rem", color: t.textMuted, whiteSpace: "nowrap", fontFamily: "DM Mono, monospace" }}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${t.border}`, background: idx % 2 ? t.surfaceAlt : "transparent" }}>
                  {keys.map((k) => (
                    <td key={`${idx}-${k}`} style={{ padding: "0.4rem 0.6rem", whiteSpace: "nowrap", fontFamily: "DM Mono, monospace" }}>
                      {String(r?.[k] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : chartType === "pie" ? (
        <div style={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie data={rows} dataKey={valueKey} nameKey={dimensionKey} cx="50%" cy="50%" outerRadius={90} label>
                {rows.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : chartType === "line" ? (
        <div style={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey={dimensionKey} stroke={t.textMuted} />
              <YAxis stroke={t.textMuted} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={valueKey} stroke={t.accent} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey={dimensionKey} stroke={t.textMuted} />
              <YAxis stroke={t.textMuted} />
              <Tooltip />
              <Legend />
              <Bar dataKey={valueKey} fill={t.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const DashboardsPage = ({ selectedOrg, token, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Input, Card, Badge, Spinner, EmptyState, Modal } = ui;
  const { useTheme } = hooks;
  const t = useTheme();

  const [dashboards, setDashboards] = useState([]);
  const [charts, setCharts] = useState([]);
  const [queries, setQueries] = useState([]);
  const [queryColumns, setQueryColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingChart, setCreatingChart] = useState(false);
  const [creatingDashboard, setCreatingDashboard] = useState(false);
  const [addingChartToDashboard, setAddingChartToDashboard] = useState(false);
  const [executionMap, setExecutionMap] = useState({});
  const [activeDashboardId, setActiveDashboardId] = useState(null);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [linkChartSelection, setLinkChartSelection] = useState({});
  const [chartForm, setChartForm] = useState({
    name: "",
    savedQuery: "",
    chartType: "bar",
    groupByColumn: "",
    metricColumn: "",
    aggregation: "sum",
    limit: "20",
  });
  const [dashboardForm, setDashboardForm] = useState({ name: "", description: "" });

  const filteredDashboards = useMemo(
    () => dashboards.filter((d) => Number(d.organization) === Number(selectedOrg?.id)),
    [dashboards, selectedOrg?.id]
  );
  const filteredQueries = useMemo(
    () => queries.filter((q) => Number(q.organization) === Number(selectedOrg?.id)),
    [queries, selectedOrg?.id]
  );
  const filteredCharts = useMemo(
    () => charts.filter((c) => Number(c.organization) === Number(selectedOrg?.id)),
    [charts, selectedOrg?.id]
  );

  const activeDashboard = useMemo(
    () => filteredDashboards.find((d) => Number(d.id) === Number(activeDashboardId)) || null,
    [filteredDashboards, activeDashboardId]
  );

  const activeExecution = executionMap[activeDashboardId] || { loading: false, error: "", data: null };

  const canManage = String(selectedOrg?.current_user_role || "member") !== "member";

  const loadAll = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [dashData, chartData, queryData] = await Promise.all([
        api("/dashboards/", {}, token),
        api(`/charts/?organization=${selectedOrg?.id || ""}`, {}, token),
        api("/queries/", {}, token),
      ]);
      const nextDashboards = asList(dashData);
      const nextCharts = asList(chartData);
      const nextQueries = asList(queryData);
      setDashboards(nextDashboards);
      setCharts(nextCharts);
      setQueries(nextQueries);

      const orgDashboards = nextDashboards.filter((d) => Number(d.organization) === Number(selectedOrg?.id));
      if (orgDashboards.length) {
        setActiveDashboardId((prev) => {
          if (prev && orgDashboards.some((d) => Number(d.id) === Number(prev))) return prev;
          return orgDashboards[0].id;
        });
      } else {
        setActiveDashboardId(null);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load dashboards and charts."));
      setDashboards([]);
      setCharts([]);
      setQueries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [token, selectedOrg?.id]);

  useEffect(() => {
    const selectedQuery = filteredQueries.find((q) => String(q.id) === String(chartForm.savedQuery));
    if (!selectedQuery?.dataset) {
      setQueryColumns([]);
      return;
    }
    let alive = true;
    api(`/datasets/${selectedQuery.dataset}/metadata/`, {}, token)
      .then((data) => {
        if (!alive) return;
        const cols = (data?.columns || []).map((c) => c?.name || c?.column_name || c).filter(Boolean);
        setQueryColumns(cols);
        setChartForm((prev) => ({
          ...prev,
          groupByColumn: prev.groupByColumn || cols[0] || "",
          metricColumn: prev.metricColumn || cols[1] || cols[0] || "",
        }));
      })
      .catch(() => {
        if (!alive) return;
        setQueryColumns([]);
      });
    return () => { alive = false; };
  }, [chartForm.savedQuery, token, selectedOrg?.id]);

  const createChart = async () => {
    if (!canManage) return;
    if (!chartForm.name.trim() || !chartForm.savedQuery || !chartForm.groupByColumn || !chartForm.metricColumn) {
      setError("Chart name, query, group by column and metric column are required.");
      return;
    }
    setCreatingChart(true);
    setError("");
    setNotice("");
    try {
      await api("/charts/create/", {
        method: "POST",
        body: {
          organization: selectedOrg?.id,
          name: chartForm.name.trim(),
          saved_query: toNumber(chartForm.savedQuery),
          chart_type: chartForm.chartType,
          group_by_column: chartForm.groupByColumn,
          metric_column: chartForm.metricColumn,
          aggregation: chartForm.aggregation,
          limit: toNumber(chartForm.limit, 20),
        },
      }, token);
      setShowChartModal(false);
      setChartForm({
        name: "",
        savedQuery: "",
        chartType: "bar",
        groupByColumn: "",
        metricColumn: "",
        aggregation: "sum",
        limit: "20",
      });
      setNotice("Chart created successfully.");
      await loadAll();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to create chart."));
    } finally {
      setCreatingChart(false);
    }
  };

  const createDashboard = async () => {
    if (!canManage) return;
    if (!dashboardForm.name.trim()) {
      setError("Dashboard name is required.");
      return;
    }
    setCreatingDashboard(true);
    setError("");
    setNotice("");
    try {
      await api("/dashboards/create/", {
        method: "POST",
        body: {
          organization: selectedOrg?.id,
          name: dashboardForm.name.trim(),
          description: dashboardForm.description.trim(),
        },
      }, token);
      setShowDashboardModal(false);
      setDashboardForm({ name: "", description: "" });
      setNotice("Dashboard created successfully.");
      await loadAll();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to create dashboard."));
    } finally {
      setCreatingDashboard(false);
    }
  };

  const addChartToDashboard = async (dashboard) => {
    if (!dashboard?.id || !canManage) return;
    const selectedChartId = linkChartSelection[dashboard.id];
    if (!selectedChartId) {
      setError("Select a chart first.");
      return;
    }
    setAddingChartToDashboard(true);
    setError("");
    setNotice("");
    try {
      const count = Array.isArray(dashboard.dashboard_charts) ? dashboard.dashboard_charts.length : 0;
      await api("/dashboards/add-chart/", {
        method: "POST",
        body: {
          dashboard: dashboard.id,
          chart: toNumber(selectedChartId),
          position_x: (count % 2) * 6,
          position_y: Math.floor(count / 2) * 4,
          width: 6,
          height: 4,
          order: count,
        },
      }, token);
      setNotice("Chart added to dashboard.");
      await loadAll();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to add chart to dashboard."));
    } finally {
      setAddingChartToDashboard(false);
    }
  };

  const runDashboard = async (dashboardId) => {
    if (!dashboardId) return;
    setExecutionMap((prev) => ({ ...prev, [dashboardId]: { loading: true, error: "", data: null } }));
    try {
      const data = await api(`/dashboards/${dashboardId}/execute/`, {}, token);
      setExecutionMap((prev) => ({ ...prev, [dashboardId]: { loading: false, error: "", data } }));
    } catch (e) {
      setExecutionMap((prev) => ({
        ...prev,
        [dashboardId]: { loading: false, error: getApiErrorMessage(e, "Dashboard execution failed."), data: null },
      }));
    }
  };

  const deleteChart = async (chartId) => {
    if (!canManage) return;
    setError("");
    setNotice("");
    try {
      await api(`/charts/${chartId}/delete/`, { method: "DELETE" }, token);
      setNotice("Chart deleted.");
      await loadAll();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to delete chart."));
    }
  };

  const deleteDashboard = async (dashboardId) => {
    if (!canManage) return;
    setError("");
    setNotice("");
    try {
      await api(`/dashboards/${dashboardId}/delete/`, { method: "DELETE" }, token);
      setNotice("Dashboard deleted.");
      await loadAll();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to delete dashboard."));
    }
  };

  return (
    <div className="fade-in" style={{ padding: "1.4rem", display: "flex", flexDirection: "column", gap: "1rem", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.8rem", flexWrap: "wrap" }}>
        <div>
          <h1 className="heading" style={{ fontSize: "1.65rem", fontWeight: 800 }}>Dashboards Studio</h1>
          <p style={{ color: t.textMuted, fontSize: "0.86rem" }}>Power BI style charting and dashboard composition with backend execution.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Btn variant="secondary" onClick={loadAll}>Refresh</Btn>
          <Btn variant="secondary" icon="plus" onClick={() => setShowChartModal(true)} disabled={!canManage}>New Chart</Btn>
          <Btn variant="primary" icon="plus" onClick={() => setShowDashboardModal(true)} disabled={!canManage}>New Dashboard</Btn>
        </div>
      </div>

      {(error || notice) && (
        <div style={{
          padding: "0.65rem 0.9rem",
          borderRadius: "8px",
          background: error ? `${t.danger}15` : `${t.success}15`,
          border: `1px solid ${error ? `${t.danger}40` : `${t.success}40`}`,
          color: error ? t.danger : t.success,
          fontSize: "0.82rem"
        }}>
          {error || notice}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "2.5rem" }}><Spinner /></div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "0.7rem" }}>
            <Card style={{ background: `linear-gradient(135deg, ${t.accent}26, transparent)` }}>
              <p style={{ fontSize: "0.75rem", color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Dashboards</p>
              <p className="heading" style={{ fontSize: "1.6rem", fontWeight: 800 }}>{filteredDashboards.length}</p>
            </Card>
            <Card style={{ background: `linear-gradient(135deg, ${t.success}22, transparent)` }}>
              <p style={{ fontSize: "0.75rem", color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Charts</p>
              <p className="heading" style={{ fontSize: "1.6rem", fontWeight: 800 }}>{filteredCharts.length}</p>
            </Card>
            <Card style={{ background: `linear-gradient(135deg, ${t.warning}24, transparent)` }}>
              <p style={{ fontSize: "0.75rem", color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Saved Queries</p>
              <p className="heading" style={{ fontSize: "1.6rem", fontWeight: 800 }}>{filteredQueries.length}</p>
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", gap: "0.8rem" }}>
            <Card style={{ minHeight: 420 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                <h3 className="heading" style={{ fontSize: "1.02rem", fontWeight: 700 }}>Dashboard Catalog</h3>
                {!canManage && <Badge color="orange">View only</Badge>}
              </div>
              {filteredDashboards.length === 0 ? (
                <EmptyState icon="dashboard" title="No dashboards yet" desc="Create your first dashboard to start composing charts." />
              ) : (
                <div style={{ display: "grid", gap: "0.55rem", maxHeight: 360, overflowY: "auto", paddingRight: "0.2rem" }}>
                  {filteredDashboards.map((d) => {
                    const isActive = Number(activeDashboardId) === Number(d.id);
                    const chartCount = Array.isArray(d.dashboard_charts) ? d.dashboard_charts.length : 0;
                    return (
                      <div
                        key={d.id}
                        onClick={() => setActiveDashboardId(d.id)}
                        style={{
                          border: `1px solid ${isActive ? t.accent : t.border}`,
                          background: isActive ? t.accentGlow : t.surfaceAlt,
                          borderRadius: "10px",
                          padding: "0.7rem",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.55rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: "0.89rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</p>
                            <p style={{ fontSize: "0.73rem", color: t.textMuted }}>{chartCount} linked charts</p>
                          </div>
                          <div style={{ display: "flex", gap: "0.35rem" }}>
                            <Btn
                              variant="secondary"
                              size="sm"
                              icon="play"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDashboardId(d.id);
                                runDashboard(d.id);
                              }}
                            >
                              Run
                            </Btn>
                            {canManage && (
                              <Btn
                                variant="danger"
                                size="sm"
                                icon="trash"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteDashboard(d.id);
                                }}
                              />
                            )}
                          </div>
                        </div>
                        {canManage && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 88px", gap: "0.45rem" }}>
                            <select
                              value={linkChartSelection[d.id] || ""}
                              onChange={(e) => setLinkChartSelection((prev) => ({ ...prev, [d.id]: e.target.value }))}
                              style={{
                                width: "100%",
                                padding: "0.45rem 0.6rem",
                                borderRadius: "8px",
                                border: `1px solid ${t.border}`,
                                background: t.surface,
                                color: t.text,
                                fontSize: "0.8rem",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="">Link chart...</option>
                              {filteredCharts.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <Btn
                              variant="primary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                addChartToDashboard(d);
                              }}
                              loading={addingChartToDashboard}
                            >
                              Add
                            </Btn>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card style={{ minHeight: 420, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                <h3 className="heading" style={{ fontSize: "1.02rem", fontWeight: 700 }}>
                  {activeDashboard ? `Live View: ${activeDashboard.name}` : "Live View"}
                </h3>
                {activeDashboard && (
                  <Btn variant="primary" size="sm" icon="play" onClick={() => runDashboard(activeDashboard.id)} loading={activeExecution.loading}>
                    Execute
                  </Btn>
                )}
              </div>

              {!activeDashboard ? (
                <EmptyState icon="dashboard" title="Select a dashboard" desc="Pick a dashboard from the catalog to view and execute it." />
              ) : activeExecution.error ? (
                <div style={{ padding: "0.7rem", borderRadius: "8px", border: `1px solid ${t.danger}40`, background: `${t.danger}15`, color: t.danger, fontSize: "0.82rem" }}>
                  {activeExecution.error}
                </div>
              ) : activeExecution.loading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}><Spinner /></div>
              ) : !activeExecution.data ? (
                <EmptyState icon="play" title="Run to preview" desc="Click Execute to render the latest dashboard charts." />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.7rem", overflowY: "auto", paddingRight: "0.2rem" }}>
                  {(activeExecution.data?.charts || []).map((item) => (
                    <DashboardChartCard key={`${item.chart_id}-${item.chart_name}`} item={item} t={t} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 className="heading" style={{ fontSize: "1.02rem", fontWeight: 700 }}>Chart Library</h3>
              <Badge color="blue">{filteredCharts.length} charts</Badge>
            </div>
            {filteredCharts.length === 0 ? (
              <EmptyState icon="chart" title="No charts yet" desc="Create a chart from a saved query to start dashboarding." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "0.6rem" }}>
                {filteredCharts.map((c) => (
                  <div key={c.id} style={{ border: `1px solid ${t.border}`, background: t.surfaceAlt, borderRadius: "10px", padding: "0.65rem 0.75rem" }}>
                    <p style={{ fontSize: "0.86rem", fontWeight: 700, marginBottom: "0.2rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</p>
                    <p style={{ fontSize: "0.73rem", color: t.textMuted }}>{String(c.chart_type || "bar").toUpperCase()} | {String(c.aggregation || "sum").toUpperCase()}</p>
                    {canManage && (
                      <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "flex-end" }}>
                        <Btn variant="danger" size="sm" icon="trash" onClick={() => deleteChart(c.id)}>Delete</Btn>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Modal open={showChartModal} onClose={() => setShowChartModal(false)} title="Create Chart">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <Input label="Chart Name" value={chartForm.name} onChange={(v) => setChartForm((p) => ({ ...p, name: v }))} placeholder="Sales by Region" />

          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>Saved Query</label>
            <select
              value={chartForm.savedQuery}
              onChange={(e) => setChartForm((p) => ({ ...p, savedQuery: e.target.value, groupByColumn: "", metricColumn: "" }))}
              style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text }}
            >
              <option value="">Select saved query...</option>
              {filteredQueries.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>Chart Type</label>
              <select
                value={chartForm.chartType}
                onChange={(e) => setChartForm((p) => ({ ...p, chartType: e.target.value }))}
                style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text }}
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="pie">Pie</option>
                <option value="table">Table</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>Aggregation</label>
              <select
                value={chartForm.aggregation}
                onChange={(e) => setChartForm((p) => ({ ...p, aggregation: e.target.value }))}
                style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text }}
              >
                <option value="sum">SUM</option>
                <option value="avg">AVG</option>
                <option value="count">COUNT</option>
                <option value="min">MIN</option>
                <option value="max">MAX</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>Group By Column</label>
              <select
                value={chartForm.groupByColumn}
                onChange={(e) => setChartForm((p) => ({ ...p, groupByColumn: e.target.value }))}
                style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text }}
              >
                <option value="">Select column...</option>
                {queryColumns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>Metric Column</label>
              <select
                value={chartForm.metricColumn}
                onChange={(e) => setChartForm((p) => ({ ...p, metricColumn: e.target.value }))}
                style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text }}
              >
                <option value="">Select column...</option>
                {queryColumns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <Input label="Row Limit" type="number" value={chartForm.limit} onChange={(v) => setChartForm((p) => ({ ...p, limit: v }))} placeholder="20" />

          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", marginTop: "0.3rem" }}>
            <Btn variant="secondary" onClick={() => setShowChartModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={createChart} loading={creatingChart}>Create Chart</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={showDashboardModal} onClose={() => setShowDashboardModal(false)} title="Create Dashboard">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <Input label="Dashboard Name" value={dashboardForm.name} onChange={(v) => setDashboardForm((p) => ({ ...p, name: v }))} placeholder="Executive Overview" />
          <Input label="Description" value={dashboardForm.description} onChange={(v) => setDashboardForm((p) => ({ ...p, description: v }))} placeholder="Optional notes" />
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", marginTop: "0.3rem" }}>
            <Btn variant="secondary" onClick={() => setShowDashboardModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={createDashboard} loading={creatingDashboard}>Create Dashboard</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardsPage;
