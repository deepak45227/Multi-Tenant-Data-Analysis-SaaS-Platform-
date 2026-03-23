import { useEffect, useMemo, useState } from "react";

const AdminPanelPage = ({ selectedOrg, token, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Input, Card, Spinner, EmptyState, Badge, Icon } = ui;
  const { useTheme } = hooks;
  const t = useTheme();

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowBusy, setRowBusy] = useState({});
  const [inviteBusy, setInviteBusy] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ email: "", role: "member" });
  const [transferEmail, setTransferEmail] = useState("");
  const orgRole = String(selectedOrg?.current_user_role || "member");
  const canManage = orgRole === "owner" || orgRole === "admin";
  const canTransfer = orgRole === "owner";

  const loadMembers = async () => {
    if (!selectedOrg?.id || !canManage) return;
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

  const loadInvites = async () => {
    if (!selectedOrg?.id || !canManage) return;
    setInviteLoading(true);
    setError("");
    try {
      const data = await api(`/organizations/invites/${selectedOrg.id}/`, {}, token);
      setInvites(data?.invites || []);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load invites."));
      setInvites([]);
    } finally {
      setInviteLoading(false);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadMembers(), loadInvites()]);
  };

  useEffect(() => {
    if (!selectedOrg?.id || !canManage) {
      setLoading(false);
      setInviteLoading(false);
      return;
    }
    loadAll();
  }, [selectedOrg?.id, token, canManage]);

  const counts = useMemo(() => {
    const admins = members.filter(m => m.role === "admin" || m.is_owner).length;
    const owners = members.filter(m => m.is_owner).length;
    const pending = invites.filter(i => !i.accepted_at && !i.is_expired).length;
    return {
      members: members.length,
      admins,
      owners,
      pending,
    };
  }, [members, invites]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.is_owner && !b.is_owner) return -1;
      if (!a.is_owner && b.is_owner) return 1;
      return String(a.user_email || "").localeCompare(String(b.user_email || ""));
    });
  }, [members]);

  const addMember = async () => {
    if (!form.email.trim() || !selectedOrg?.id || !canManage) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await api(`/organizations/members/${selectedOrg.id}/add-member/`, {
        method: "POST",
        body: { email: form.email.trim(), role: form.role },
      }, token);
      setNotice(data?.invited ? "Invite sent successfully." : "Member added successfully.");
      setForm((p) => ({ ...p, email: "" }));
      await loadAll();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to add member."));
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (membershipId, role) => {
    if (!canManage) return;
    setRowBusy(prev => ({ ...prev, [membershipId]: true }));
    setError("");
    setNotice("");
    try {
      await api(`/organizations/members/${membershipId}/update-role/`, {
        method: "PATCH",
        body: { role },
      }, token);
      setNotice("Role updated.");
      await loadMembers();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to update role."));
    } finally {
      setRowBusy(prev => ({ ...prev, [membershipId]: false }));
    }
  };

  const deleteMember = async (membershipId) => {
    if (!canManage) return;
    setRowBusy(prev => ({ ...prev, [membershipId]: true }));
    setError("");
    setNotice("");
    try {
      await api(`/organizations/members/${membershipId}/delete/`, { method: "DELETE" }, token);
      setNotice("Member removed.");
      setMembers((prev) => prev.filter((m) => Number(m.id) !== Number(membershipId)));
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to delete member."));
    } finally {
      setRowBusy(prev => ({ ...prev, [membershipId]: false }));
    }
  };

  const resendInvite = async (inviteId) => {
    setInviteBusy(prev => ({ ...prev, [inviteId]: true }));
    setError("");
    setNotice("");
    try {
      await api(`/organizations/invites/${inviteId}/resend/`, { method: "POST" }, token);
      setNotice("Invite resent.");
      await loadInvites();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to resend invite."));
    } finally {
      setInviteBusy(prev => ({ ...prev, [inviteId]: false }));
    }
  };

  const revokeInvite = async (inviteId) => {
    setInviteBusy(prev => ({ ...prev, [inviteId]: true }));
    setError("");
    setNotice("");
    try {
      await api(`/organizations/invites/${inviteId}/revoke/`, { method: "DELETE" }, token);
      setNotice("Invite revoked.");
      setInvites((prev) => prev.filter((i) => Number(i.id) !== Number(inviteId)));
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to revoke invite."));
    } finally {
      setInviteBusy(prev => ({ ...prev, [inviteId]: false }));
    }
  };

  const transferOwnership = async () => {
    if (!canTransfer || !transferEmail.trim() || !selectedOrg?.id) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/organizations/transfer-ownership/${selectedOrg.id}/`, {
        method: "POST",
        body: { email: transferEmail.trim() },
      }, token);
      setNotice("Ownership transferred. Refresh to see updated roles.");
      setTransferEmail("");
      await loadMembers();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to transfer ownership."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in" style={{ padding: "1.6rem 1.8rem", height: "100%", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 className="heading" style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.3rem" }}>Admin & Access</h1>
          <p style={{ color: t.textMuted, fontSize: "0.9rem" }}>
            Manage team access for <span style={{ color: t.text, fontWeight: 600 }}>{selectedOrg?.name || "your org"}</span>
          </p>
        </div>
        <Btn variant="secondary" onClick={loadAll}>Refresh</Btn>
      </div>

      {!canManage && (
        <Card>
          <EmptyState icon="org" title="Limited Access" desc="Members have read-only access. Ask the organization owner/admin for member-management permissions." />
        </Card>
      )}

      {canManage && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
            <Card style={{ background: `linear-gradient(135deg, ${t.accent}30, transparent)` }}>
              <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted }}>Members</p>
              <h2 className="heading" style={{ fontSize: "1.7rem", marginTop: "0.4rem" }}>{counts.members}</h2>
              <p style={{ fontSize: "0.82rem", color: t.textMuted }}>Across all roles</p>
            </Card>
            <Card style={{ background: `linear-gradient(135deg, ${t.success}25, transparent)` }}>
              <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted }}>Admins</p>
              <h2 className="heading" style={{ fontSize: "1.7rem", marginTop: "0.4rem" }}>{counts.admins}</h2>
              <p style={{ fontSize: "0.82rem", color: t.textMuted }}>Includes owners</p>
            </Card>
            <Card style={{ background: `linear-gradient(135deg, ${t.warning}25, transparent)` }}>
              <p style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted }}>Invites</p>
              <h2 className="heading" style={{ fontSize: "1.7rem", marginTop: "0.4rem" }}>{counts.pending}</h2>
              <p style={{ fontSize: "0.82rem", color: t.textMuted }}>Pending responses</p>
            </Card>
          </div>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
              <div>
                <h3 className="heading" style={{ fontSize: "1.05rem", fontWeight: 700 }}>Invite a member</h3>
                <p style={{ fontSize: "0.82rem", color: t.textMuted }}>We'll email them a secure invite link.</p>
              </div>
              <Badge color="blue"><Icon name="bell" size={12} /> Email Invite</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) 140px 140px", gap: "0.6rem", alignItems: "end" }}>
              <Input label="Member email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="member@company.com" />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Btn variant="primary" onClick={addMember} loading={saving} disabled={!form.email.trim()} style={{ justifyContent: "center" }}>
                Send Invite
              </Btn>
            </div>
          </Card>

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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.9rem" }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 className="heading" style={{ fontSize: "1.05rem", fontWeight: 700 }}>Team members</h3>
                <Badge color="green">{members.length} total</Badge>
              </div>

              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "2.5rem" }}><Spinner /></div>
              ) : sortedMembers.length === 0 ? (
                <EmptyState icon="org" title="No members" desc="Invite team members to collaborate." />
              ) : (
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  {sortedMembers.map((m) => (
                    <div key={m.id} style={{
                      padding: "0.85rem 1rem",
                      borderRadius: "12px",
                      border: `1px solid ${t.border}`,
                      background: t.surfaceAlt,
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1.4fr) 120px 120px",
                      gap: "0.6rem",
                      alignItems: "center"
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: "0.92rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.user_email || `User #${m.user}`}
                        </p>
                        <p style={{ fontSize: "0.75rem", color: t.textMuted }}>{m.username || "-"}</p>
                      </div>
                      <div>
                        {m.is_owner ? (
                          <Badge color="orange">Owner</Badge>
                        ) : (
                          <select
                            value={m.role}
                            onChange={(e) => updateRole(m.id, e.target.value)}
                            disabled={rowBusy[m.id]}
                            style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.surface, color: t.text }}
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </div>
                      <Btn
                        variant="danger"
                        size="sm"
                        onClick={() => deleteMember(m.id)}
                        disabled={rowBusy[m.id] || m.is_owner}
                        style={{ justifyContent: "center" }}
                      >
                        {m.is_owner ? "Owner" : rowBusy[m.id] ? "Removing..." : "Remove"}
                      </Btn>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 className="heading" style={{ fontSize: "1.05rem", fontWeight: 700 }}>Pending invites</h3>
                <Badge color="orange">{invites.length}</Badge>
              </div>

              {inviteLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "2.5rem" }}><Spinner /></div>
              ) : invites.length === 0 ? (
                <EmptyState icon="bell" title="No invites" desc="Invites will show up here." />
              ) : (
                <div style={{ display: "grid", gap: "0.6rem" }}>
                  {invites.map((invite) => (
                    <div key={invite.id} style={{
                      padding: "0.85rem 1rem",
                      borderRadius: "12px",
                      border: `1px solid ${t.border}`,
                      background: t.surfaceAlt,
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>{invite.email}</p>
                        <Badge color={invite.role === "admin" ? "orange" : "green"}>
                          {(invite.role || "member").toUpperCase()}
                        </Badge>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: t.textMuted }}>
                        Invited by {invite.invited_by_email || "Unknown"} - Expires {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : "-"}
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
                        <Btn variant="secondary" size="sm" onClick={() => resendInvite(invite.id)} disabled={inviteBusy[invite.id]}>
                          {inviteBusy[invite.id] ? "Sending..." : "Resend"}
                        </Btn>
                        <Btn variant="danger" size="sm" onClick={() => revokeInvite(invite.id)} disabled={inviteBusy[invite.id]}>
                          {inviteBusy[invite.id] ? "Working..." : "Revoke"}
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {canTransfer && (
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
                <div>
                  <h3 className="heading" style={{ fontSize: "1.05rem", fontWeight: 700 }}>Transfer ownership</h3>
                  <p style={{ fontSize: "0.82rem", color: t.textMuted }}>Only owners can transfer to another verified member.</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px", gap: "0.6rem", alignItems: "end" }}>
                <Input label="New owner email" value={transferEmail} onChange={setTransferEmail} placeholder="owner@company.com" />
                <Btn variant="primary" onClick={transferOwnership} loading={saving} disabled={!transferEmail.trim()} style={{ justifyContent: "center" }}>
                  Transfer
                </Btn>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPanelPage;
