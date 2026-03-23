import { useEffect, useMemo, useState } from "react";

const createDefaultCell = (dataset = "") => ({
  id: `cell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  description: "",
  language: "sql",
  dataset,
  sql: "SELECT * FROM data LIMIT 10",
  loading: false,
  result: null,
  error: "",
});

const QueriesPage = ({ selectedOrg, token, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon } = ui;
  const { useTheme } = hooks;
  const t = useTheme();

  const [queries, setQueries] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", sql: "", description: "", dataset: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [runningAllCells, setRunningAllCells] = useState(false);
  const [cells, setCells] = useState([createDefaultCell("")]);

  const orgId = selectedOrg?.id;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const orgQuery = orgId ? `?organization=${orgId}` : "";
      const [queryData, datasetData] = await Promise.all([
        api("/queries/", {}, token).catch(() => []),
        api(`/datasets/list/${orgQuery}`, {}, token).catch(() => []),
      ]);

      const allQueries = queryData?.results || queryData || [];
      const allDatasets = datasetData?.datasets || datasetData || [];
      const filteredQueries = allQueries.filter((q) => Number(q.organization) === Number(orgId));

      setQueries(filteredQueries);
      setDatasets(allDatasets);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load queries."));
      setQueries([]);
      setDatasets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token, orgId]);

  useEffect(() => {
    const fallback = String(datasets[0]?.dataset_id || datasets[0]?.id || "");
    if (!fallback) return;
    setCells((prev) => prev.map((c) => (c.dataset ? c : { ...c, dataset: fallback })));
    setForm((prev) => ({ ...prev, dataset: prev.dataset || fallback }));
  }, [datasets]);

  const patchCell = (id, patch) => {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addCell = () => {
    const fallback = String(datasets[0]?.dataset_id || datasets[0]?.id || "");
    setCells((prev) => [...prev, createDefaultCell(fallback)]);
  };

  const addCellAfter = (id) => {
    const fallback = String(datasets[0]?.dataset_id || datasets[0]?.id || "");
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const next = createDefaultCell(fallback);
      return [...prev.slice(0, idx + 1), next, ...prev.slice(idx + 1)];
    });
  };

  const removeCell = (id) => {
    setCells((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((c) => c.id !== id);
    });
  };

  const pandasToSql = (code) => {
    const src = String(code || "").trim();
    if (!src) throw new Error("Pandas cell is empty.");
    if (/^select\s+/i.test(src)) return src;

    const clean = src.replace(/\s+/g, " ").trim();
    let m;
    m = clean.match(/^df\.head\((\d+)\)$/i);
    if (m) return `SELECT * FROM data LIMIT ${parseInt(m[1], 10)}`;

    m = clean.match(/^df\[\[(.+)\]\]$/i);
    if (m) {
      const cols = m[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      if (!cols.length) throw new Error("No columns found in pandas selector.");
      return `SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM data`;
    }

    m = clean.match(/^df\.query\((['"])(.+)\1\)$/i);
    if (m) return `SELECT * FROM data WHERE ${m[2]}`;

    m = clean.match(/^df\.sort_values\((['"])(.+)\1,\s*ascending\s*=\s*(True|False)\)$/i);
    if (m) return `SELECT * FROM data ORDER BY "${m[2]}" ${m[3] === "False" ? "DESC" : "ASC"}`;

    m = clean.match(/^df\.drop\(columns=\[(.+)\]\)$/i);
    if (m) {
      const cols = m[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      if (!cols.length) throw new Error("No columns found in pandas drop.");
      return `SELECT * EXCLUDE (${cols.map((c) => `"${c}"`).join(", ")}) FROM data`;
    }

    m = clean.match(/^df\.dropna\(subset=\[(.+)\]\)$/i);
    if (m) {
      const cols = m[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      if (!cols.length) throw new Error("No columns found in pandas dropna.");
      return `SELECT * FROM data WHERE ${cols.map((c) => `"${c}" IS NOT NULL`).join(" AND ")}`;
    }

    m = clean.match(/^df\.groupby\((['"])(.+)\1\)\[(['"])(.+)\3\]\.(sum|avg|mean|min|max|count)\(\)$/i);
    if (m) {
      const groupCol = m[2];
      const metricCol = m[4];
      const agg = m[5].toLowerCase() === "mean" ? "avg" : m[5].toLowerCase();
      return `SELECT "${groupCol}", ${agg.toUpperCase()}("${metricCol}") AS value FROM data GROUP BY "${groupCol}"`;
    }

    throw new Error("Unsupported pandas syntax. Use head/query/sort_values/drop/dropna/groupby.");
  };

  const toExecutableSql = (cell) => ((cell.language || "sql") === "pandas" ? pandasToSql(cell.sql) : cell.sql);

  const runCell = async (id) => {
    const cell = cells.find((c) => c.id === id);
    if (!cell) return;
    if (!cell.dataset || !cell.sql.trim()) {
      patchCell(id, { error: "Dataset and query are required." });
      return;
    }
    patchCell(id, { loading: true, error: "" });
    try {
      const executableSql = toExecutableSql(cell);
      const data = await api("/queries/execute/", {
        method: "POST",
        body: {
          dataset: cell.dataset,
          sql: executableSql,
          max_rows: 200,
        },
      }, token);
      patchCell(id, { result: data, error: "" });
    } catch (e) {
      patchCell(id, { error: e?.message || getApiErrorMessage(e, "Execution failed."), result: null });
    } finally {
      patchCell(id, { loading: false });
    }
  };

  const runAllCells = async () => {
    setRunningAllCells(true);
    try {
      for (const c of cells) {
        // Keep execution order deterministic like notebook tools.
        await runCell(c.id);
      }
    } finally {
      setRunningAllCells(false);
    }
  };

  const saveCell = async (id) => {
    const cell = cells.find((c) => c.id === id);
    if (!cell) return;
    if (!cell.dataset || !cell.sql.trim()) {
      patchCell(id, { error: "Dataset and query are required before save." });
      return;
    }
    patchCell(id, { loading: true, error: "" });
    try {
      const executableSql = toExecutableSql(cell);
      await api("/queries/", {
        method: "POST",
        body: {
          organization: orgId,
          dataset: cell.dataset,
          name: (cell.name || `Notebook Query ${new Date().toLocaleTimeString()}`).trim(),
          sql: executableSql,
          description: cell.description || "",
        },
      }, token);
      await load();
    } catch (e) {
      patchCell(id, { error: getApiErrorMessage(e, "Failed to save query.") });
    } finally {
      patchCell(id, { loading: false });
    }
  };

  const createQuery = async () => {
    if (!form.name.trim() || !form.sql.trim() || !form.dataset) {
      setError("Query name, dataset and SQL are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api("/queries/", {
        method: "POST",
        body: {
          organization: orgId,
          dataset: form.dataset,
          name: form.name.trim(),
          sql: form.sql,
          description: form.description,
        },
      }, token);
      setShowCreate(false);
      setForm({ name: "", sql: "", description: "", dataset: String(datasets[0]?.dataset_id || datasets[0]?.id || "") });
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save query."));
    } finally {
      setSaving(false);
    }
  };

  const deleteQuery = async (id) => {
    setError("");
    try {
      await api(`/queries/${id}/`, { method: "DELETE" }, token);
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to delete query."));
    }
  };

  const insertSavedQueryInNewCell = (q) => {
    const fallback = String(datasets[0]?.dataset_id || datasets[0]?.id || "");
    setCells((prev) => [
      ...prev,
      {
        id: `cell-${Date.now()}-${q.id}`,
        name: q.name || "",
        description: q.description || "",
        language: "sql",
        dataset: String(q.dataset || fallback),
        sql: q.sql || "",
        loading: false,
        result: null,
        error: "",
      },
    ]);
  };

  const notebookCount = cells.length;
  const sqlCount = useMemo(() => cells.filter((c) => c.language === "sql").length, [cells]);

  return (
    <div className="fade-in" style={{ padding: "1.4rem", display: "flex", flexDirection: "column", gap: "0.9rem", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.65rem" }}>
        <div>
          <h1 className="heading" style={{ fontSize: "1.65rem", fontWeight: 800 }}>Query Notebook</h1>
          <p style={{ color: t.textMuted, fontSize: "0.84rem" }}>Cell-first SQL and pandas workflow for fast iteration.</p>
        </div>
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
          <Btn variant="secondary" icon="plus" onClick={addCell}>Add Cell</Btn>
          <Btn variant="primary" icon="play" onClick={runAllCells} loading={runningAllCells}>Run All</Btn>
          <Btn variant="secondary" icon="plus" onClick={() => setShowCreate(true)}>New Saved Query</Btn>
        </div>
      </div>

      {error && (
        <div style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: "0.82rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "0.55rem" }}>
        <Card style={{ background: `linear-gradient(135deg, ${t.accent}24, transparent)` }}>
          <p style={{ fontSize: "0.74rem", color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cells</p>
          <p className="heading" style={{ fontSize: "1.35rem", fontWeight: 800 }}>{notebookCount}</p>
        </Card>
        <Card style={{ background: `linear-gradient(135deg, ${t.success}20, transparent)` }}>
          <p style={{ fontSize: "0.74rem", color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>SQL Cells</p>
          <p className="heading" style={{ fontSize: "1.35rem", fontWeight: 800 }}>{sqlCount}</p>
        </Card>
        <Card style={{ background: `linear-gradient(135deg, ${t.warning}20, transparent)` }}>
          <p style={{ fontSize: "0.74rem", color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Saved Queries</p>
          <p className="heading" style={{ fontSize: "1.35rem", fontWeight: 800 }}>{queries.length}</p>
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 className="heading" style={{ fontSize: "1rem", fontWeight: 700 }}>Notebook Cells</h3>
          <Badge color="blue">{cells.length} active</Badge>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {cells.map((cell, idx) => {
            const colsCell = cell.result?.columns || (cell.result?.rows?.[0] ? Object.keys(cell.result.rows[0]) : []);
            const rowsCell = cell.result?.rows || [];
            return (
              <div key={cell.id} style={{ border: `1px solid ${t.border}`, borderRadius: "11px", background: t.surfaceAlt, padding: "0.7rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr) 130px 1fr auto", gap: "0.45rem", alignItems: "center", marginBottom: "0.55rem" }}>
                  <Badge color="blue">Cell {idx + 1}</Badge>
                  <input
                    value={cell.name}
                    onChange={(e) => patchCell(cell.id, { name: e.target.value })}
                    placeholder="Query name (optional)"
                    style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: "0.8rem" }}
                  />
                  <select
                    value={cell.language || "sql"}
                    onChange={(e) => patchCell(cell.id, { language: e.target.value })}
                    style={{ width: "100%", padding: "0.45rem 0.55rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: "0.8rem" }}
                  >
                    <option value="sql">SQL</option>
                    <option value="pandas">Pandas</option>
                  </select>
                  <select
                    value={cell.dataset}
                    onChange={(e) => patchCell(cell.id, { dataset: e.target.value })}
                    style={{ width: "100%", padding: "0.45rem 0.55rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: "0.8rem" }}
                  >
                    <option value="">Select dataset...</option>
                    {datasets.map((d) => (
                      <option key={d.dataset_id || d.id} value={d.dataset_id || d.id}>{d.name || d.dataset_name}</option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    <Btn variant="secondary" size="sm" icon="play" onClick={() => runCell(cell.id)} loading={cell.loading}>Run</Btn>
                    <Btn variant="primary" size="sm" icon="check" onClick={() => saveCell(cell.id)} loading={cell.loading}>Save</Btn>
                    <Btn variant="danger" size="sm" icon="trash" onClick={() => removeCell(cell.id)} disabled={cells.length <= 1} />
                  </div>
                </div>

                <input
                  value={cell.description}
                  onChange={(e) => patchCell(cell.id, { description: e.target.value })}
                  placeholder="Description (optional)"
                  style={{ width: "100%", marginBottom: "0.5rem", padding: "0.45rem 0.6rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: "0.8rem" }}
                />

                <textarea
                  value={cell.sql}
                  onChange={(e) => patchCell(cell.id, { sql: e.target.value })}
                  placeholder={cell.language === "pandas" ? "df.head(10)\ndf.query(\"amount > 100\")\ndf.sort_values(\"amount\", ascending=False)" : "SELECT * FROM data LIMIT 10"}
                  rows={4}
                  style={{ width: "100%", padding: "0.65rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: "0.84rem", fontFamily: "DM Mono, monospace", resize: "vertical", outline: "none" }}
                />

                {cell.error && (
                  <div style={{ marginTop: "0.5rem", padding: "0.5rem 0.75rem", borderRadius: "8px", border: `1px solid ${t.danger}40`, background: `${t.danger}15`, color: t.danger, fontSize: "0.8rem" }}>
                    {cell.error}
                  </div>
                )}

                {cell.result && !cell.error && (
                  <div style={{ marginTop: "0.5rem", border: `1px solid ${t.border}`, borderRadius: "8px", overflow: "auto", background: t.surface }}>
                    <table style={{ fontSize: "0.76rem", minWidth: "100%" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                          {colsCell.map((c, i) => (
                            <th key={i} style={{ padding: "0.45rem 0.6rem", color: t.textMuted, fontFamily: "DM Mono, monospace", whiteSpace: "nowrap" }}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rowsCell.map((row, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surfaceAlt }}>
                            {(Array.isArray(row) ? row : Object.values(row)).map((c, j) => (
                              <td key={j} style={{ padding: "0.4rem 0.6rem", fontFamily: "DM Mono, monospace", whiteSpace: "nowrap" }}>{String(c ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: "0.45rem 0.6rem", fontSize: "0.72rem", color: t.textMuted }}>
                      Returned {cell.result.returned_rows ?? rowsCell.length} rows {cell.result.total_rows ? `of ${cell.result.total_rows}` : ""}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "0.55rem", display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
                  <Btn variant="secondary" size="sm" icon="plus" onClick={() => addCellAfter(cell.id)}>Add Below</Btn>
                  <Btn variant="danger" size="sm" icon="trash" onClick={() => removeCell(cell.id)} disabled={cells.length <= 1}>Delete</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 className="heading" style={{ fontSize: "1rem", fontWeight: 700 }}>Saved Queries</h3>
          <Btn variant="secondary" size="sm" icon="plus" onClick={() => setShowCreate(true)}>New Query</Btn>
        </div>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "1.5rem" }}><Spinner /></div>
        ) : queries.length === 0 ? (
          <EmptyState icon="query" title="No saved queries" desc="Save notebook cells to reuse across charts and dashboards." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {queries.map((q) => (
              <div key={q.id} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: "0.65rem", alignItems: "center", padding: "0.65rem 0.75rem", borderRadius: "10px", border: `1px solid ${t.border}`, background: t.surfaceAlt }}>
                <div style={{ width: 30, height: 30, borderRadius: "8px", background: t.accentGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="query" size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.name}</p>
                  <p style={{ fontSize: "0.75rem", color: t.textMuted, fontFamily: "DM Mono, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.sql}</p>
                </div>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <Btn variant="secondary" size="sm" icon="plus" onClick={() => insertSavedQueryInNewCell(q)}>Use</Btn>
                  <Btn variant="danger" size="sm" icon="trash" onClick={() => deleteQuery(q.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Saved Query">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <Input label="Query Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Monthly Sales" required />
          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>Dataset</label>
            <select
              value={form.dataset}
              onChange={(e) => setForm((p) => ({ ...p, dataset: e.target.value }))}
              style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans, sans-serif" }}
            >
              <option value="">Select dataset...</option>
              {datasets.map((d) => <option key={d.dataset_id || d.id} value={d.dataset_id || d.id}>{d.name || d.dataset_name}</option>)}
            </select>
          </div>
          <Input label="Description" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Optional description" />
          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>SQL</label>
            <textarea
              value={form.sql}
              onChange={(e) => setForm((p) => ({ ...p, sql: e.target.value }))}
              placeholder="SELECT * FROM data"
              rows={5}
              style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.855rem", fontFamily: "DM Mono, monospace", resize: "vertical", outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={createQuery} loading={saving}>Save Query</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QueriesPage;
