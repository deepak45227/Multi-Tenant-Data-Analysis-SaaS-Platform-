import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const AuthPage = ({ mode, api, getApiErrorMessage, ui, hooks }) => {
  const { Btn, Input, Card, Icon } = ui;
  const { useTheme, useNav, useAuth } = hooks;
  const t = useTheme();
  const { setPage } = useNav();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isLogin = mode === "login";

  const handle = async () => {
    setLoading(true); setError("");
    try {
      if (!isLogin) {
        await api("/accounts/register/", { method: "POST", body: form });
      }
      const data = await api("/token/", { method: "POST", body: { email: form.email, password: form.password } });
      login(data.access, { email: form.email, username: form.username || form.email.split("@")[0] });
    } catch (e) {
      setError(getApiErrorMessage(e, "Something went wrong. Check your credentials."));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.5rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: "10px", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="logo" size={20} style={{ color: "#fff" }} />
            </div>
            <span className="heading" style={{ fontSize: "1.4rem", fontWeight: 800 }}>data<span style={{ color: t.accent }}>bi</span></span>
          </div>
          <h1 className="heading" style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.4rem" }}>{isLogin ? "Welcome back" : "Create account"}</h1>
          <p style={{ color: t.textMuted, fontSize: "0.9rem" }}>{isLogin ? "Sign in to your workspace" : "Start your analytics journey"}</p>
        </div>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {!isLogin && <Input label="Username" value={form.username} onChange={v => setForm(p => ({ ...p, username: v }))} placeholder="yourname" required />}
            <Input label="Email" type="email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder="you@company.com" required />
            <Input label="Password" type="password" value={form.password} onChange={v => setForm(p => ({ ...p, password: v }))} placeholder="••••••••" required />
            {error && <div style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: "0.82rem" }}>{error}</div>}
            <Btn variant="primary" size="lg" onClick={handle} loading={loading} style={{ width: "100%", justifyContent: "center" }}>{isLogin ? "Sign In" : "Create Account"}</Btn>
          </div>
        </Card>
        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: t.textMuted }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => setPage(isLogin ? "register" : "login")} style={{ color: t.accent, cursor: "pointer", fontWeight: 600 }}>{isLogin ? "Sign up" : "Sign in"}</span>
        </p>
        <p style={{ textAlign: "center", marginTop: "1rem" }}>
          <span onClick={() => setPage("landing")} style={{ color: t.textMuted, cursor: "pointer", fontSize: "0.82rem" }}>← Back to home</span>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;

// ── SIDEBAR ──────────────────────────────────────────────────────────────────

