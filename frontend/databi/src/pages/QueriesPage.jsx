import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const QueriesPage = ({ selectedOrg, token, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon } = ui;
  const { useTheme } = hooks;
  const t = useTheme();
  const [queries, setQueries] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [execResult, setExecResult] = useState(null);
  const [execLoading, setExecLoading] = useState(false);
  const [adHocSql, setAdHocSql] = useState("");
  const [adHocDs, setAdHocDs] = useState("");
  const [form, setForm] = useState({ name: "", sql: "", description: "", dataset: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [adHocError, setAdHocError] = useState("");
  const [runningAllCells, setRunningAllCells] = useState(false);
  const [cells, setCells] = useState([
    {
      id: `cell-${Date.now()}`,
      name: "",
      description: "",
      language: "sql",
      dataset: "",
      sql: "SELECT * FROM data LIMIT 10",
      loading: false,
      result: null,
      error: "",
    },
  ]);

  const load = () => {
    setLoading(true);
    const orgQuery = selectedOrg?.id ? `?organization=${selectedOrg.id}` : "";
    Promise.all([
      api("/queries/", {}, token).catch(() => []),
      api(`/datasets/list/${orgQuery}`, {}, token).catch(() => []),
    ]).then(([q, d]) => { setQueries(q.results || q || []); setDatasets(d.datasets || d || []); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); setAdHocDs(""); }, [token, selectedOrg?.id]);
  useEffect(() => {
    if (!datasets.length) return;
    const fallback = String(datasets[0].dataset_id || datasets[0].id);
    setCells((prev) => prev.map((c) => (c.dataset ? c : { ...c, dataset: fallback })));
  }, [datasets]);

  const createQuery = async () => {
    setError("");
    setSaving(true);
    try {
      await api("/queries/", { method: "POST", body: { organization: selectedOrg?.id, dataset: form.dataset, name: form.name, sql: form.sql, description: form.description } }, token);
      setShowCreate(false); setForm({ name: "", sql: "", description: "", dataset: "" }); load();
    } catch (e) { setError(getApiErrorMessage(e, "Failed to save query.")); } finally { setSaving(false); }
  };

  const execQuery = async (qId) => {
    setExecLoading(true);
    try {
      const data = await api(`/queries/${qId}/execute/`, { method: "POST", body: { max_rows: 50 } }, token);
      setExecResult(data);
    } catch (e) { setExecResult({ error: "Execution failed" }); }
    finally { setExecLoading(false); }
  };

  const execAdHoc = async () => {
    if (!adHocSql || !adHocDs) return;
    setAdHocError("");
    setExecLoading(true);
    try {
      const data = await api("/queries/execute/", { method: "POST", body: { dataset: adHocDs, sql: adHocSql, max_rows: 50 } }, token);
      setExecResult(data);
    } catch (e) {
      const msg = getApiErrorMessage(e, "Execution failed");
      setAdHocError(msg);
      setExecResult({ error: msg });
    }
    finally { setExecLoading(false); }
  };

  const patchCell = (id, patch) => {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addCell = () => {
    const fallback = String(datasets[0]?.dataset_id || datasets[0]?.id || "");
    setCells((prev) => [
      ...prev,
      {
        id: `cell-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: "",
        description: "",
        language: "sql",
        dataset: fallback,
        sql: "SELECT * FROM data LIMIT 10",
        loading: false,
        result: null,
        error: "",
      },
    ]);
  };

  const removeCell = (id) => {
    setCells((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  };

  const addCellAfter = (id) => {
    const fallback = String(datasets[0]?.dataset_id || datasets[0]?.id || "");
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const newCell = {
        id: `cell-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: "",
        description: "",
        language: "sql",
        dataset: fallback,
        sql: "SELECT * FROM data LIMIT 10",
        loading: false,
        result: null,
        error: "",
      };
      return [...prev.slice(0, idx + 1), newCell, ...prev.slice(idx + 1)];
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

  const toExecutableSql = (cell) => {
    if ((cell.language || "sql") === "pandas") return pandasToSql(cell.sql);
    return cell.sql;
  };

  const runCell = async (id) => {
    const cell = cells.find((c) => c.id === id);
    if (!cell) return;
    if (!cell.dataset || !cell.sql.trim()) {
      patchCell(id, { error: "Dataset and SQL are required." });
      return;
    }
    patchCell(id, { loading: true, error: "" });
    try {
      const executableSql = toExecutableSql(cell);
      const data = await api("/queries/execute/", { method: "POST", body: { dataset: cell.dataset, sql: executableSql, max_rows: 200 } }, token);
      patchCell(id, { result: data, error: "" });
    } catch (e) {
      patchCell(id, { error: e?.message || getApiErrorMessage(e, "Execution failed"), result: null });
    } finally {
      patchCell(id, { loading: false });
    }
  };

  const runAllCells = async () => {
    setRunningAllCells(true);
    try {
      for (const c of cells) {
        // sequential run keeps notebook order stable
        // eslint-disable-next-line no-await-in-loop
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
      patchCell(id, { error: "Dataset and SQL are required before save." });
      return;
    }
    patchCell(id, { loading: true, error: "" });
    try {
      const executableSql = toExecutableSql(cell);
      await api("/queries/", {
        method: "POST",
        body: {
          organization: selectedOrg?.id,
          dataset: cell.dataset,
          name: (cell.name || `Notebook Query ${new Date().toLocaleTimeString()}`).trim(),
          sql: executableSql,
          description: cell.description || "",
        },
      }, token);
      load();
    } catch (e) {
      patchCell(id, { error: getApiErrorMessage(e, "Failed to save query.") });
    } finally {
      patchCell(id, { loading: false });
    }
  };

  const deleteQuery = async (id) => {
    await api(`/queries/${id}/`, { method: "DELETE" }, token).catch(() => {});
    load();
  };

  const cols = execResult?.columns || (execResult?.rows?.[0] ? Object.keys(execResult.rows[0]) : []);
  const rows = execResult?.rows || (Array.isArray(execResult) ? execResult : []);

  return (
    <div className="fade-in" style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="heading" style={{ fontSize: "1.8rem", fontWeight: 800 }}>SQL Queries</h1>
          <p style={{ color: t.textMuted, fontSize: "0.875rem" }}>Write and execute SQL against your datasets</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Btn variant="secondary" icon="plus" onClick={addCell}>Add Cell</Btn>
          <Btn variant="primary" icon="play" onClick={runAllCells} loading={runningAllCells}>Run All</Btn>
          <Btn variant="secondary" icon="plus" onClick={() => setShowCreate(true)}>New Query</Btn>
        </div>
      </div>
      {error && <div style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: "0.82rem" }}>{error}</div>}

      {/* Ad-hoc Query */}
      <Card>
        <h3 className="heading" style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem" }}>Ad-hoc Query</h3>
        {adHocError && <div style={{ marginBottom: "0.75rem", padding: "0.55rem 0.8rem", borderRadius: "8px", border: `1px solid ${t.danger}40`, background: `${t.danger}15`, color: t.danger, fontSize: "0.8rem" }}>{adHocError}</div>}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
          <select value={adHocDs} onChange={e => setAdHocDs(e.target.value)}
            style={{ flex: "0 0 200px", padding: "0.6rem 0.8rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.855rem", fontFamily: "DM Sans" }}>
            <option value="">Select dataset…</option>
            {datasets.map(d => <option key={d.dataset_id || d.id} value={d.dataset_id || d.id}>{d.name || d.dataset_name}</option>)}
          </select>
          <Btn variant="primary" icon="play" onClick={execAdHoc} loading={execLoading} disabled={!adHocSql || !adHocDs}>Run</Btn>
        </div>
        <textarea value={adHocSql} onChange={e => setAdHocSql(e.target.value)} placeholder="SELECT * FROM data LIMIT 10"
          rows={4} style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.855rem", fontFamily: "DM Mono, monospace", resize: "vertical", outline: "none" }} />
      </Card>

      <Card>
        <div style={{ position: "sticky", top: 0, zIndex: 5, background: t.card, paddingBottom: "0.6rem", marginBottom: "0.2rem", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <h3 className="heading" style={{ fontSize: "0.95rem", fontWeight: 700 }}>Query Notebook</h3>
            <div style={{ display: "flex", gap: "0.45rem" }}>
              <Btn variant="secondary" size="sm" icon="plus" onClick={addCell}>Add Cell</Btn>
              <Btn variant="primary" size="sm" icon="play" onClick={runAllCells} loading={runningAllCells}>Run All</Btn>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {cells.map((cell, idx) => {
            const colsCell = cell.result?.columns || (cell.result?.rows?.[0] ? Object.keys(cell.result.rows[0]) : []);
            const rowsCell = cell.result?.rows || [];
            return (
              <div key={cell.id} style={{ border: `1px solid ${t.border}`, borderRadius: "10px", background: t.surfaceAlt, padding: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 260 }}>
                    <Badge color="blue">Cell {idx + 1}</Badge>
                    <input
                      value={cell.name}
                      onChange={(e) => patchCell(cell.id, { name: e.target.value })}
                      placeholder="Query name (optional)"
                      style={{ flex: 1, minWidth: 160, padding: "0.45rem 0.6rem", borderRadius: "7px", border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: "0.8rem" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    <Btn variant="secondary" size="sm" icon="play" onClick={() => runCell(cell.id)} loading={cell.loading}>Run</Btn>
                    <Btn variant="primary" size="sm" icon="check" onClick={() => saveCell(cell.id)} loading={cell.loading}>Save</Btn>
                    <Btn variant="danger" size="sm" icon="trash" onClick={() => removeCell(cell.id)} disabled={cells.length <= 1} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
                  <select
                    value={cell.dataset}
                    onChange={(e) => patchCell(cell.id, { dataset: e.target.value })}
                    style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: "0.83rem", fontFamily: "DM Sans" }}
                  >
                    <option value="">Select dataset...</option>
                    {datasets.map((d) => <option key={d.dataset_id || d.id} value={d.dataset_id || d.id}>{d.name || d.dataset_name}</option>)}
                  </select>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.5rem" }}>
                    <select
                      value={cell.language || "sql"}
                      onChange={(e) => patchCell(cell.id, { language: e.target.value })}
                      style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: "0.83rem", fontFamily: "DM Sans" }}
                    >
                      <option value="sql">SQL</option>
                      <option value="pandas">Pandas</option>
                    </select>
                    <input
                      value={cell.description}
                      onChange={(e) => patchCell(cell.id, { description: e.target.value })}
                      placeholder="Description (optional)"
                      style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: "0.83rem" }}
                    />
                  </div>
                </div>
                <textarea
                  value={cell.sql}
                  onChange={(e) => patchCell(cell.id, { sql: e.target.value })}
                  placeholder={cell.language === "pandas" ? "df.head(10)\ndf.query(\"amount > 100\")\ndf.sort_values(\"amount\", ascending=False)" : "SELECT * FROM data LIMIT 10"}
                  rows={4}
                  style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: "0.84rem", fontFamily: "DM Mono, monospace", resize: "vertical", outline: "none" }}
                />
                {cell.error && (
                  <div style={{ marginTop: "0.55rem", padding: "0.5rem 0.75rem", borderRadius: "8px", border: `1px solid ${t.danger}40`, background: `${t.danger}15`, color: t.danger, fontSize: "0.8rem" }}>
                    {cell.error}
                  </div>
                )}
                {cell.result && !cell.error && (
                  <div style={{ marginTop: "0.55rem", border: `1px solid ${t.border}`, borderRadius: "8px", overflow: "auto", background: t.surface }}>
                    <table style={{ fontSize: "0.76rem", minWidth: "100%" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                          {colsCell.map((c, i) => <th key={i} style={{ padding: "0.45rem 0.6rem", color: t.textMuted, fontFamily: "DM Mono", whiteSpace: "nowrap" }}>{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rowsCell.map((row, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surfaceAlt }}>
                            {(Array.isArray(row) ? row : Object.values(row)).map((c, j) => <td key={j} style={{ padding: "0.4rem 0.6rem", fontFamily: "DM Mono", whiteSpace: "nowrap" }}>{String(c ?? "")}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: "0.45rem 0.6rem", fontSize: "0.72rem", color: t.textMuted }}>
                      Returned {cell.result.returned_rows ?? rowsCell.length} rows {cell.result.total_rows ? `of ${cell.result.total_rows}` : ""}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                  <Btn variant="secondary" size="sm" icon="plus" onClick={() => addCellAfter(cell.id)}>Add Cell Below</Btn>
                  <Btn variant="danger" size="sm" icon="trash" onClick={() => removeCell(cell.id)} disabled={cells.length <= 1}>Delete Cell</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Result */}
      {(execResult || execLoading) && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 className="heading" style={{ fontSize: "0.9rem", fontWeight: 700 }}>Result</h3>
            {execLoading && <Spinner />}
            {execResult && !execLoading && <button onClick={() => setExecResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted }}><Icon name="close" size={16} /></button>}
          </div>
          {execResult?.error ? (
            <p style={{ color: t.danger, fontSize: "0.855rem" }}>{execResult.error}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ fontSize: "0.78rem" }}>
                <thead><tr style={{ borderBottom: `1px solid ${t.border}` }}>{cols.map((c, i) => <th key={i} style={{ padding: "0.5rem 0.75rem", color: t.textMuted, fontFamily: "DM Mono", whiteSpace: "nowrap" }}>{c}</th>)}</tr></thead>
                <tbody>{rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surfaceAlt }}>
                    {(Array.isArray(row) ? row : Object.values(row)).map((c, j) => <td key={j} style={{ padding: "0.45rem 0.75rem", fontFamily: "DM Mono", whiteSpace: "nowrap" }}>{String(c ?? "")}</td>)}
                  </tr>
                ))}</tbody>
              </table>
              {execResult?.total_rows && <p style={{ fontSize: "0.72rem", color: t.textMuted, marginTop: "0.5rem" }}>{execResult.total_rows} rows</p>}
            </div>
          )}
        </Card>
      )}

      {/* Saved Queries */}
      <div>
        <h3 className="heading" style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>Saved Queries</h3>
        {loading ? <Spinner /> : queries.length === 0 ? (
          <EmptyState icon="query" title="No saved queries" desc="Save queries to reuse them across dashboards and reports." action={<Btn variant="primary" size="sm" icon="plus" onClick={() => setShowCreate(true)}>New Query</Btn>} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {queries.map((q, i) => (
              <Card key={i} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.9rem 1.1rem" }}>
                <div style={{ width: 36, height: 36, borderRadius: "9px", background: t.accentGlow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="query" size={17} style={{ color: t.accent }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>{q.name}</p>
                  <p style={{ fontSize: "0.78rem", color: t.textMuted, fontFamily: "DM Mono", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.sql}</p>
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <Btn variant="secondary" size="sm" icon="play" onClick={() => execQuery(q.id)}>Run</Btn>
                  <Btn
                    variant="ghost"
                    size="sm"
                    icon="plus"
                    onClick={() => setCells((prev) => [...prev, {
                      id: `cell-${Date.now()}-${q.id}`,
                      name: q.name || "",
                      description: q.description || "",
                      language: "sql",
                      dataset: String(q.dataset || datasets[0]?.dataset_id || datasets[0]?.id || ""),
                      sql: q.sql || "",
                      loading: false,
                      result: null,
                      error: "",
                    }])}
                  >
                    Use
                  </Btn>
                  <Btn variant="danger" size="sm" icon="trash" onClick={() => deleteQuery(q.id)} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Saved Query">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input label="Query Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. Monthly Sales" required />
          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Dataset</label>
            <select value={form.dataset} onChange={e => setForm(p => ({ ...p, dataset: e.target.value }))}
              style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
              <option value="">Select dataset…</option>
              {datasets.map(d => <option key={d.dataset_id || d.id} value={d.dataset_id || d.id}>{d.name || d.dataset_name}</option>)}
            </select>
          </div>
          <Input label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="Optional description" />
          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>SQL</label>
            <textarea value={form.sql} onChange={e => setForm(p => ({ ...p, sql: e.target.value }))} placeholder="SELECT * FROM data" rows={5}
              style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.855rem", fontFamily: "DM Mono", resize: "vertical", outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={createQuery} loading={saving}>Save Query</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QueriesPage;

// ── CHARTS PAGE ───────────────────────────────────────────────────────────────

