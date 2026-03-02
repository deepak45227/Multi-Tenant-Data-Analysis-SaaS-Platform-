import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const OrgSetupPage = ({ token, onDone, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Card, Input, Icon } = ui;
  const { useTheme } = hooks;
  const t = useTheme();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    if (!name.trim()) { setError("Organization name is required."); return; }
    setLoading(true); setError("");
    try {
      const data = await api("/organizations/create/", { method: "POST", body: { name } }, token);
      onDone(data?.organization || data);
    } catch (e) { setError(getApiErrorMessage(e, "Failed to create organization.")); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ width: 56, height: 56, borderRadius: "14px", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <Icon name="org" size={26} />
          </div>
          <h1 className="heading" style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.4rem" }}>Create your workspace</h1>
          <p style={{ color: t.textMuted }}>Set up your organization to start analyzing data</p>
        </div>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <Input label="Organization Name" value={name} onChange={setName} placeholder="e.g. Acme Analytics" required />
            {error && <div style={{ padding: "0.65rem", borderRadius: "8px", background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: "0.82rem" }}>{error}</div>}
            <Btn variant="primary" size="lg" onClick={create} loading={loading} style={{ width: "100%", justifyContent: "center" }}>Create Organization</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OrgSetupPage;

// ── APP SHELL ─────────────────────────────────────────────────────────────────

