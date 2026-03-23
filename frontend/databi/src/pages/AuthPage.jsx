import { useEffect, useRef, useState } from "react";

const AuthPage = ({ mode, api, getApiErrorMessage, ui, hooks, actionParams = {} }) => {
  const { Btn, Input, Card, Icon, Badge } = ui;
  const { useTheme, useNav, useAuth } = hooks;
  const t = useTheme();
  const { setPage } = useNav();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", username: "", password: "", newPassword: "" });
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [rawError, setRawError] = useState(null);
  const verifyOnce = useRef(false);

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const isVerify = mode === "verify";

  useEffect(() => {
    if (actionParams?.email && !form.email) {
      setForm((p) => ({ ...p, email: actionParams.email }));
    }
  }, [actionParams?.email]);

  const setErrorMessage = (err, fallback) => {
    setRawError(err);
    setError(getApiErrorMessage(err, fallback));
  };

  const handleLogin = async () => {
    setLoading(true); setError(""); setInfo("");
    try {
      const data = await api("/token/", { method: "POST", body: { email: form.email, password: form.password } });
      login(data.access, data.user || { email: form.email, username: form.username || form.email.split("@")[0] });
    } catch (e) {
      setErrorMessage(e, "Something went wrong. Check your credentials.");
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setLoading(true); setError(""); setInfo("");
    try {
      await api("/accounts/register/", {
        method: "POST",
        body: {
          email: form.email,
          username: form.username,
          password: form.password,
          invite_token: actionParams?.invite || "",
        },
      });
      setInfo("Account created. Check your email to verify your address.");
    } catch (e) {
      setErrorMessage(e, "Unable to register. Please review the form.");
    } finally { setLoading(false); }
  };

  const handleForgot = async () => {
    setLoading(true); setError(""); setInfo("");
    try {
      await api("/accounts/password/forgot/", { method: "POST", body: { email: form.email } });
      setInfo("If that email exists, a reset link has been sent.");
    } catch (e) {
      setErrorMessage(e, "Unable to send reset email.");
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    setLoading(true); setError(""); setInfo("");
    try {
      await api("/accounts/password/reset/", {
        method: "POST",
        body: { uid: actionParams?.uid, token: actionParams?.token, new_password: form.newPassword },
      });
      setInfo("Password updated. You can sign in now.");
    } catch (e) {
      setErrorMessage(e, "Unable to reset password.");
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (verifyOnce.current) return;
    verifyOnce.current = true;
    setLoading(true); setError(""); setInfo("");
    try {
      await api("/accounts/verify-email/", { method: "POST", body: { uid: actionParams?.uid, token: actionParams?.token } });
      setInfo("Email verified. You can sign in now.");
    } catch (e) {
      setErrorMessage(e, "Verification failed. The link may have expired.");
    } finally { setLoading(false); }
  };

  const resendVerification = async () => {
    if (!form.email) return;
    setResendLoading(true); setError(""); setInfo("");
    try {
      await api("/accounts/resend-verification/", { method: "POST", body: { email: form.email } });
      setInfo("Verification email sent. Check your inbox.");
    } catch (e) {
      setErrorMessage(e, "Unable to resend verification email.");
    } finally { setResendLoading(false); }
  };

  useEffect(() => {
    if (isVerify) handleVerify();
  }, [isVerify, actionParams?.uid, actionParams?.token]);

  const emailNotVerified = rawError?.data?.code === "email_not_verified";

  const renderActionButton = () => {
    if (isLogin) return { label: "Sign In", handler: handleLogin };
    if (isRegister) return { label: "Create Account", handler: handleRegister };
    if (isForgot) return { label: "Send Reset Link", handler: handleForgot };
    if (isReset) return { label: "Update Password", handler: handleReset };
    if (isVerify) return { label: "Verifying...", handler: handleVerify };
    return { label: "Continue", handler: handleLogin };
  };

  const action = renderActionButton();

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: "2.2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.5rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: "10px", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="logo" size={20} style={{ color: "#fff" }} />
            </div>
            <span className="heading" style={{ fontSize: "1.4rem", fontWeight: 800 }}>data<span style={{ color: t.accent }}>bi</span></span>
          </div>
          <h1 className="heading" style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.35rem" }}>
            {isLogin && "Welcome back"}
            {isRegister && "Create account"}
            {isForgot && "Reset your password"}
            {isReset && "Set a new password"}
            {isVerify && "Verify your email"}
          </h1>
          <p style={{ color: t.textMuted, fontSize: "0.9rem" }}>
            {isLogin && "Sign in to your workspace"}
            {isRegister && "Start your analytics journey"}
            {isForgot && "We'll send you a secure reset link"}
            {isReset && "Choose a strong new password"}
            {isVerify && "Checking your verification link"}
          </p>
          {actionParams?.invite && (
            <div style={{ marginTop: "0.9rem" }}>
              <Badge color="orange">You've been invited to join a team</Badge>
            </div>
          )}
        </div>

        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {isRegister && (
              <Input label="Username" value={form.username} onChange={v => setForm(p => ({ ...p, username: v }))} placeholder="yourname" />
            )}
            {(isLogin || isRegister || isForgot) && (
              <Input label="Email" type="email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder="you@company.com" required />
            )}
            {(isLogin || isRegister) && (
              <Input label="Password" type="password" value={form.password} onChange={v => setForm(p => ({ ...p, password: v }))} placeholder="********" required />
            )}
            {isReset && (
              <Input label="New Password" type="password" value={form.newPassword} onChange={v => setForm(p => ({ ...p, newPassword: v }))} placeholder="********" required />
            )}

            {error && (
              <div style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: "0.82rem" }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", background: `${t.success}15`, border: `1px solid ${t.success}40`, color: t.success, fontSize: "0.82rem" }}>
                {info}
              </div>
            )}

            {!isVerify && (
              <Btn variant="primary" size="lg" onClick={action.handler} loading={loading} style={{ width: "100%", justifyContent: "center" }}>
                {action.label}
              </Btn>
            )}

            {emailNotVerified && (
              <Btn variant="secondary" size="md" onClick={resendVerification} loading={resendLoading} style={{ justifyContent: "center" }}>
                Resend verification email
              </Btn>
            )}

            {isForgot && (
              <p style={{ fontSize: "0.8rem", color: t.textMuted }}>
                Remembered your password? <span style={{ color: t.accent, cursor: "pointer", fontWeight: 600 }} onClick={() => setPage("login")}>Sign in</span>
              </p>
            )}
          </div>
        </Card>

        {isLogin && (
          <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.85rem", color: t.textMuted }}>
            <span onClick={() => setPage("forgot")} style={{ color: t.accent, cursor: "pointer", fontWeight: 600 }}>
              Forgot password?
            </span>
          </p>
        )}

        {!isForgot && (
          <p style={{ textAlign: "center", marginTop: "1.2rem", fontSize: "0.875rem", color: t.textMuted }}>
            {isLogin ? "Don't have an account? " : isRegister ? "Already have an account? " : "Ready to sign in? "}
            <span onClick={() => setPage(isLogin ? "register" : "login")} style={{ color: t.accent, cursor: "pointer", fontWeight: 600 }}>
              {isLogin ? "Sign up" : "Sign in"}
            </span>
          </p>
        )}
        <p style={{ textAlign: "center", marginTop: "1rem" }}>
          <span onClick={() => setPage("landing")} style={{ color: t.textMuted, cursor: "pointer", fontSize: "0.82rem" }}>&lt;- Back to home</span>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
