import { useEffect, useState } from "react";

const AccountPage = ({ token, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Input, Card, Spinner, Badge } = ui;
  const { useTheme, useAuth } = hooks;
  const t = useTheme();
  const { user: authUser } = useAuth();

  const [profile, setProfile] = useState(authUser || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [form, setForm] = useState({ oldPassword: "", newPassword: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/accounts/me/", {}, token);
      setProfile(data);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load account details."));
      if (authUser) setProfile(authUser);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [token]);

  const resendVerification = async () => {
    if (!profile?.email) return;
    setResendLoading(true);
    setError("");
    setNotice("");
    try {
      await api("/accounts/resend-verification/", { method: "POST", body: { email: profile.email } });
      setNotice("Verification email sent.");
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to resend verification email."));
    } finally {
      setResendLoading(false);
    }
  };

  const changePassword = async () => {
    if (!form.oldPassword || !form.newPassword) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api("/accounts/password/change/", {
        method: "POST",
        body: { old_password: form.oldPassword, new_password: form.newPassword },
      }, token);
      setNotice("Password updated successfully.");
      setForm({ oldPassword: "", newPassword: "" });
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to change password."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in" style={{ padding: "1.6rem 1.8rem", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <div>
        <h1 className="heading" style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.35rem" }}>Account & Security</h1>
        <p style={{ color: t.textMuted, fontSize: "0.9rem" }}>Manage your profile and login settings.</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "2.5rem" }}><Spinner /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.9rem" }}>
          <Card>
            <h3 className="heading" style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.9rem" }}>Profile</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>{profile?.username || "-"}</p>
              <p style={{ fontSize: "0.82rem", color: t.textMuted }}>{profile?.email || "-"}</p>
              <div style={{ marginTop: "0.4rem" }}>
                {profile?.is_email_verified ? (
                  <Badge color="green">Email verified</Badge>
                ) : (
                  <Badge color="orange">Email not verified</Badge>
                )}
              </div>
              {!profile?.is_email_verified && (
                <Btn variant="secondary" size="sm" onClick={resendVerification} loading={resendLoading} style={{ width: "fit-content", marginTop: "0.5rem" }}>
                  Resend verification email
                </Btn>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="heading" style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.9rem" }}>Change password</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              <Input label="Current password" type="password" value={form.oldPassword} onChange={v => setForm(p => ({ ...p, oldPassword: v }))} placeholder="********" />
              <Input label="New password" type="password" value={form.newPassword} onChange={v => setForm(p => ({ ...p, newPassword: v }))} placeholder="********" />
              <Btn variant="primary" onClick={changePassword} loading={saving} style={{ width: "fit-content" }}>Update password</Btn>
            </div>
          </Card>
        </div>
      )}

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
    </div>
  );
};

export default AccountPage;
