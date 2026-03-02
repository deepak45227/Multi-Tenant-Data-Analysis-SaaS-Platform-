import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const ReportsPage = ({ selectedOrg, token, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Input, Card, Badge, Spinner, EmptyState, Modal, Icon } = ui;
  const { useTheme } = hooks;
  const t = useTheme();
  const [reports, setReports] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", dashboard: "", recipients: "", frequency: "manual" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([api("/reports/", {}, token).catch(() => [])]).then(([r]) => setReports(r.results || r || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [token]);

  const createReport = async () => {
    setError("");
    setSaving(true);
    try {
      await api("/reports/", { method: "POST", body: { organization: selectedOrg?.id, dashboard: parseInt(form.dashboard), name: form.name, description: form.description, recipients: form.recipients.split(",").map(s => s.trim()), frequency: form.frequency, is_active: true } }, token);
      setShowCreate(false); setForm({ name: "", description: "", dashboard: "", recipients: "", frequency: "manual" }); load();
    } catch (e) { setError(getApiErrorMessage(e, "Failed to create report.")); } finally { setSaving(false); }
  };

  const triggerReport = async (id) => {
    await api(`/reports/${id}/trigger/`, { method: "POST", body: {} }, token).catch(() => {});
  };

  const deleteReport = async (id) => {
    await api(`/reports/${id}/`, { method: "DELETE" }, token).catch(() => {});
    load();
  };

  return (
    <div className="fade-in" style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 className="heading" style={{ fontSize: "1.8rem", fontWeight: 800 }}>Reports</h1>
          <p style={{ color: t.textMuted, fontSize: "0.875rem" }}>Schedule and deliver automated insights</p>
        </div>
        <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>New Report</Btn>
      </div>
      {error && <div style={{ marginBottom: "1rem", padding: "0.65rem 0.9rem", borderRadius: "8px", background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: "0.82rem" }}>{error}</div>}

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}><Spinner /></div> :
        reports.length === 0 ? (
          <EmptyState icon="report" title="No reports yet" desc="Create a report to automatically deliver dashboard insights by email."
            action={<Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Create Report</Btn>} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {reports.map((r, i) => (
              <Card key={i} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: "10px", background: t.accentGlow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="report" size={19} style={{ color: t.accent }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.name}</p>
                    <Badge color={r.is_active ? "green" : "orange"}>{r.is_active ? "Active" : "Inactive"}</Badge>
                    <Badge color="blue">{r.frequency}</Badge>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: t.textMuted }}>{r.description}</p>
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <Btn variant="secondary" size="sm" icon="play" onClick={() => triggerReport(r.id)}>Trigger</Btn>
                  <Btn variant="danger" size="sm" icon="trash" onClick={() => deleteReport(r.id)} />
                </div>
              </Card>
            ))}
          </div>
        )
      }

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Report">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input label="Report Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Daily Sales Report" required />
          <Input label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="Optional" />
          <Input label="Dashboard ID" value={form.dashboard} onChange={v => setForm(p => ({ ...p, dashboard: v }))} placeholder="Dashboard ID" />
          <Input label="Recipients (comma-separated emails)" value={form.recipients} onChange={v => setForm(p => ({ ...p, recipients: v }))} placeholder="a@b.com, c@d.com" />
          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, display: "block", marginBottom: "0.4rem", textTransform: "uppercase" }}>Frequency</label>
            <select value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}
              style={{ width: "100%", padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontSize: "0.875rem", fontFamily: "DM Sans" }}>
              {["manual","daily","weekly","monthly"].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={createReport} loading={saving}>Create Report</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ReportsPage;

// ── ORG SETUP PAGE ────────────────────────────────────────────────────────────

