import { useEffect, useState } from "react";

const AdminPanelPage = ({ selectedOrg, token, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Input, Card, Spinner, EmptyState } = ui;
  const { useTheme } = hooks;
  const t = useTheme();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", role: "member" });
  const orgRole = String(selectedOrg?.current_user_role || "member");
  const canManage = orgRole === "owner" || orgRole === "admin";

  const load = async () => {
    if (!selectedOrg?.id || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api(`/organizations/members/${selectedOrg.id}/`, {}, token);
      setMembers(data?.members || []);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load members."));
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedOrg?.id, token, canManage]);

  const addMember = async () => {
    if (!form.email.trim() || !selectedOrg?.id || !canManage) return;
    setSaving(true);
    setError("");
    try {
      await api(`/organizations/members/${selectedOrg.id}/add-member/`, {
        method: "POST",
        body: { email: form.email.trim(), role: form.role },
      }, token);
      setForm((p) => ({ ...p, email: "" }));
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to add member."));
    } finally {
      setSaving(false);
    }
  };

  const deleteMember = async (membershipId) => {
    if (!canManage) return;
    setDeletingId(membershipId);
    setError("");
    try {
      await api(`/organizations/members/${membershipId}/delete/`, { method: "DELETE" }, token);
      setMembers((prev) => prev.filter((m) => Number(m.id) !== Number(membershipId)));
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to delete member."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fade-in" style={{ padding: "1.4rem", height: "100%", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="heading" style={{ fontSize: "1.6rem", fontWeight: 800 }}>Admin Panel</h1>
          <p style={{ color: t.textMuted, fontSize: "0.85rem" }}>Manage organization members | Role: {orgRole.toUpperCase()}</p>
        </div>
        <Btn variant="secondary" onClick={load}>Refresh</Btn>
      </div>

      {!canManage && (
        <Card>
          <EmptyState icon="org" title="Limited Access" desc="Members have read-only access. Ask organization owner/admin for member-management permissions." />
        </Card>
      )}

      {canManage && <Card style={{ display: "grid", gridTemplateColumns: "1fr 120px 130px", gap: "0.6rem", alignItems: "end" }}>
        <Input label="Member Email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="member@company.com" />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Role</label>
          <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text }}>
            <option value="member">MEMBER</option>
            <option value="admin">ADMIN</option>
          </select>
        </div>
        <Btn variant="primary" onClick={addMember} loading={saving} disabled={!form.email.trim()} style={{ justifyContent: "center" }}>Add Member</Btn>
      </Card>}

      {error && (
        <div style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: "0.82rem" }}>
          {error}
        </div>
      )}

      {canManage && loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "2.5rem" }}><Spinner /></div>
      ) : canManage && members.length === 0 ? (
        <Card><EmptyState icon="org" title="No members" desc="Add members to this organization." /></Card>
      ) : canManage ? (
        <div style={{ display: "grid", gap: "0.55rem" }}>
          {members.map((m) => (
            <Card key={m.id} style={{ padding: "0.85rem 1rem", display: "grid", gridTemplateColumns: "1fr 120px 110px", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "0.92rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.user_email || `User #${m.user}`}</p>
                <p style={{ fontSize: "0.75rem", color: t.textMuted }}>{m.username || "-"}</p>
              </div>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: m.role === "admin" ? t.warning : t.success }}>
                {(m.role || "member").toUpperCase()}
              </span>
              <Btn variant="danger" size="sm" onClick={() => deleteMember(m.id)} disabled={deletingId === m.id} style={{ justifyContent: "center" }}>
                {deletingId === m.id ? "Deleting..." : "Delete"}
              </Btn>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default AdminPanelPage;
