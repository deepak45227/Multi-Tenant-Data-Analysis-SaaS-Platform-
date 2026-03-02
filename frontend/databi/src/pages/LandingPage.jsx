import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const Landing = ({ ui, hooks }) => {
  const { Btn, Card, Badge, Icon } = ui;
  const { useTheme, useNav } = hooks;
  const t = useTheme();
  const { setPage } = useNav();

  const features = [
    { icon: "pipeline", title: "Visual Pipeline Builder", desc: "Drag-and-drop data transformation pipeline with live preview. Add SQL nodes, type conversions, null removal and more — all without code." },
    { icon: "dataset", title: "Multi-Version Datasets", desc: "Every transformation creates a new version. Roll back to any previous state instantly. Full data lineage out of the box." },
    { icon: "chart", title: "BI-Grade Visualizations", desc: "Build bar charts, line graphs, and custom dashboards from your data. Execute queries and render results in real time." },
    { icon: "query", title: "SQL Query Engine", desc: "Write ad-hoc SQL or save queries for reuse. Chain SQL steps directly inside your transformation pipeline." },
    { icon: "org", title: "Multi-Tenant Organizations", desc: "Isolated workspaces for every team. Each organization manages its own datasets, pipelines, and dashboards securely." },
    { icon: "report", title: "Scheduled Reports", desc: "Automate insights delivery. Create reports from dashboards and trigger them manually or on a schedule." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: `${t.bg}dd`, backdropFilter: "blur(16px)", borderBottom: `1px solid ${t.border}`, padding: "0 2rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: 32, height: 32, borderRadius: "8px", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="logo" size={18} style={{ color: "#fff" }} />
            </div>
            <span className="heading" style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>data<span style={{ color: t.accent }}>bi</span></span>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Btn variant="ghost" onClick={() => setPage("login")}>Sign In</Btn>
            <Btn variant="primary" onClick={() => setPage("register")}>Get Started</Btn>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "7rem 2rem 5rem", textAlign: "center" }}>
        <div className="fade-in" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 1rem", borderRadius: "20px", background: t.accentGlow, border: `1px solid ${t.accent}40`, marginBottom: "2rem" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.success }} />
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: t.accent }}>Now in Beta — Free to use</span>
        </div>
        <h1 className="heading fade-in" style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: "1.5rem", animationDelay: "0.05s" }}>
          Analytics Platform<br /><span style={{ color: t.accent }}>Built for Teams</span>
        </h1>
        <p className="fade-in" style={{ fontSize: "1.15rem", color: t.textMuted, maxWidth: 560, margin: "0 auto 2.5rem", lineHeight: 1.7, animationDelay: "0.1s" }}>
          Transform, query, and visualize your data with a Power BI-style interface backed by a powerful REST API. No code required.
        </p>
        <div className="fade-in" style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", animationDelay: "0.15s" }}>
          <Btn variant="primary" size="lg" onClick={() => setPage("register")} icon="arrow">Start for Free</Btn>
          <Btn variant="secondary" size="lg" onClick={() => setPage("login")}>Sign In</Btn>
        </div>
      </section>

      {/* Dashboard preview */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem 6rem" }}>
        <div className="fade-in" style={{ border: `1px solid ${t.border}`, borderRadius: "20px", overflow: "hidden", boxShadow: t.shadowLg, background: t.surface }}>
          <div style={{ background: t.sidebar, borderBottom: `1px solid ${t.sidebarBorder}`, padding: "0.75rem 1rem", display: "flex", gap: "0.5rem" }}>
            {["#ff5f57","#febc2e","#28c840"].map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", minHeight: 380 }}>
            <div style={{ background: t.sidebar, borderRight: `1px solid ${t.sidebarBorder}`, padding: "1rem" }}>
              {["dashboard","dataset","pipeline","chart","query"].map((icon, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.75rem", borderRadius: "8px", marginBottom: "0.25rem", background: i === 0 ? t.accentGlow : "transparent", color: i === 0 ? t.accent : t.textMuted, fontSize: "0.82rem", fontWeight: 500 }}>
                  <Icon name={icon} size={15} />
                  <span style={{ textTransform: "capitalize" }}>{icon}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              {[["Total Datasets","24","+3","blue"],["Active Sessions","7","Live","green"],["Queries Run","1,204","+89","orange"]].map(([label, val, sub, color], i) => (
                <div key={i} style={{ background: t.surfaceAlt, borderRadius: "10px", padding: "1rem", border: `1px solid ${t.border}` }}>
                  <p style={{ fontSize: "0.75rem", color: t.textMuted, marginBottom: "0.4rem" }}>{label}</p>
                  <p className="heading" style={{ fontSize: "1.8rem", fontWeight: 800, color: t.text }}>{val}</p>
                  <Badge color={color}>{sub}</Badge>
                </div>
              ))}
              <div style={{ gridColumn: "1/-1", background: t.surfaceAlt, borderRadius: "10px", padding: "1rem", border: `1px solid ${t.border}`, display: "flex", alignItems: "flex-end", gap: "8px", height: 100 }}>
                {[40,65,50,80,60,90,75,95,70,85,60,100].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "4px 4px 0 0", background: `${t.accent}${i === 11 ? "ff" : "60"}` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem 8rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2 className="heading" style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "0.75rem" }}>Everything you need</h2>
          <p style={{ color: t.textMuted, fontSize: "1rem" }}>A complete analytics stack in one platform</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
          {features.map((f, i) => (
            <Card key={i} style={{ animationDelay: `${i * 0.05}s` }} className="fade-in">
              <div style={{ width: 40, height: 40, borderRadius: "10px", background: t.accentGlow, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
                <Icon name={f.icon} size={20} style={{ color: t.accent }} />
              </div>
              <h3 className="heading" style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.5rem" }}>{f.title}</h3>
              <p style={{ fontSize: "0.875rem", color: t.textMuted, lineHeight: 1.65 }}>{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem 8rem" }}>
        <div style={{ borderRadius: "20px", background: t.accent, padding: "4rem 2rem", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%)" }} />
          <h2 className="heading" style={{ fontSize: "2rem", fontWeight: 800, color: "#fff", marginBottom: "1rem", position: "relative" }}>Ready to transform your data?</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "2rem", position: "relative" }}>Join teams already using DataBI to make faster decisions.</p>
          <Btn style={{ background: "#fff", color: t.accent, borderColor: "#fff", position: "relative" }} size="lg" onClick={() => setPage("register")}>Create Free Account</Btn>
        </div>
      </section>
    </div>
  );
};

export default Landing;

// ── AUTH PAGES ───────────────────────────────────────────────────────────────

