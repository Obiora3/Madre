import { useState } from "react";
import { useTheme } from "../theme.js";

// Floating decorative card for right panel
function FeatureCard({ style, children }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.12)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: 16,
      padding: "14px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function AuthScreen({ brand, onSignIn, onSignUp }) {
  const { theme: t } = useTheme();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [agencyMode, setAgencyMode] = useState("create");
  const [agencyName, setAgencyName] = useState("");
  const [agencyCode, setAgencyCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const accent = brand.primary_colour || "#7C3AED";

  const switchMode = (next) => { setMode(next); setError(""); };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signin") {
        await onSignIn({ email: form.email, password: form.password });
      } else {
        await onSignUp({ ...form, agencyMode, agencyName, agencyCode });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    background: t.input,
    border: `1.5px solid ${t.inputBorder}`,
    borderRadius: 50,
    color: t.textSub,
    fontSize: 14,
    outline: "none",
    padding: "13px 20px",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
    }}>
      {/* Outer card */}
      <div className="auth-split" style={{
        width: "100%",
        maxWidth: 920,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        borderRadius: 28,
        overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.25)",
        minHeight: 560,
      }}>

        {/* ── LEFT: Form panel ──────────────────────────────── */}
        <div style={{
          background: t.card,
          padding: "36px 40px 32px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}>
          {/* Brand pill top-left */}
          <div style={{ marginBottom: 32 }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: `1.5px solid ${t.border2}`,
              borderRadius: 50,
              padding: "6px 14px 6px 8px",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: `${accent}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                <img src="/logo.png" alt="logo" style={{ width: 22, height: 22, objectFit: "contain" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{brand.agency_name}</span>
            </div>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: t.text, letterSpacing: "-0.02em" }}>
              {mode === "signin" ? "Welcome back" : "Create an account"}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>
              {mode === "signin" ? "Sign in to continue to your workspace." : "Sign up and start managing your agency."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submit} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {mode === "signup" && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, paddingLeft: 4 }}>Full name</div>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, paddingLeft: 4 }}>Email</div>
              <input
                type="email"
                style={inputStyle}
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: mode === "signup" ? 16 : 22 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, paddingLeft: 4 }}>Password</div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  style={{ ...inputStyle, paddingRight: 48 }}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={mode === "signin" ? "Your password" : "Min. 8 characters"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: 15, lineHeight: 1, padding: 2 }}
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Agency section — signup only */}
            {mode === "signup" && (
              <div style={{
                background: `${accent}0d`,
                border: `1.5px solid ${accent}22`,
                borderRadius: 16,
                padding: "14px 16px",
                marginBottom: 18,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 13 }}>🏢</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: "0.08em" }}>AGENCY WORKSPACE</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                  {[["create", "Create New"], ["join", "Join Existing"]].map(([id, label]) => {
                    const active = agencyMode === id;
                    return (
                      <button key={id} type="button" onClick={() => setAgencyMode(id)} style={{
                        border: `1.5px solid ${active ? accent : t.border2}`,
                        background: active ? accent : "transparent",
                        color: active ? "#fff" : t.textMuted,
                        borderRadius: 50, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "7px 10px",
                        transition: "all 0.15s",
                      }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                {agencyMode === "create" ? (
                  <input style={{ ...inputStyle, borderRadius: 50 }} value={agencyName} onChange={e => setAgencyName(e.target.value)} placeholder="Agency name e.g. Nova Creative" />
                ) : (
                  <input style={{ ...inputStyle, borderRadius: 50, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700 }} value={agencyCode} onChange={e => setAgencyCode(e.target.value.toUpperCase())} placeholder="INVITE CODE" maxLength={8} />
                )}
              </div>
            )}

            {error && (
              <div style={{ background: "#EF444411", border: "1.5px solid #EF444433", borderRadius: 12, color: "#EF4444", fontSize: 12, lineHeight: 1.6, marginBottom: 14, padding: "10px 14px", display: "flex", gap: 8 }}>
                <span>⚠</span>{error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%",
              background: accent,
              border: "none",
              borderRadius: 50,
              color: "#fff",
              cursor: loading ? "wait" : "pointer",
              fontSize: 15,
              fontWeight: 800,
              padding: "14px 16px",
              boxShadow: loading ? "none" : `0 6px 24px ${accent}55`,
              transition: "all 0.2s",
              letterSpacing: "0.01em",
            }}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 12, color: t.textFaint }}>
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: accent, padding: 0 }}>
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: t.textGhost }}>Terms &amp; Privacy</div>
          </div>
        </div>

        {/* ── RIGHT: Decorative panel ───────────────────────── */}
        <div className="auth-right" style={{
          background: `linear-gradient(145deg, ${accent}, ${accent}cc)`,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          minHeight: 480,
        }}>
          {/* Background circles */}
          <div style={{ position:"absolute", top:-60, right:-60, width:280, height:280, borderRadius:"50%", background:"rgba(255,255,255,0.08)" }} />
          <div style={{ position:"absolute", bottom:-80, left:-40, width:240, height:240, borderRadius:"50%", background:"rgba(255,255,255,0.06)" }} />
          <div style={{ position:"absolute", top:"40%", left:-30, width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }} />

          {/* Central headline */}
          <div style={{ textAlign:"center", marginBottom:32, position:"relative", zIndex:1 }}>
            <div style={{ fontSize:28, fontWeight:800, color:"#fff", lineHeight:1.2, marginBottom:10, letterSpacing:"-0.02em" }}>
              Run your agency<br/>smarter.
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.75)", lineHeight:1.6 }}>
              Projects · Tasks · Clients · KPIs<br/>all in one place.
            </div>
          </div>

          {/* Floating feature cards */}
          <div style={{ position:"relative", width:"100%", maxWidth:280, height:220, zIndex:1 }}>
            <FeatureCard style={{ position:"absolute", top:0, left:0, right:40 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontSize:16 }}>🚀</span>
                <span style={{ fontSize:12, fontWeight:700, color:"#fff" }}>Active Projects</span>
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:"#fff", lineHeight:1 }}>12</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", marginTop:2 }}>across all clients</div>
            </FeatureCard>

            <FeatureCard style={{ position:"absolute", bottom:0, right:0, left:40 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontSize:16 }}>✅</span>
                <span style={{ fontSize:12, fontWeight:700, color:"#fff" }}>Tasks Done</span>
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:"#fff", lineHeight:1 }}>94%</div>
              <div style={{ display:"flex", gap:4, marginTop:6 }}>
                {[80,90,70,95,88,94].map((v,i) => (
                  <div key={i} style={{ flex:1, height:4, borderRadius:99, background:`rgba(255,255,255,${0.3 + v/200})` }} />
                ))}
              </div>
            </FeatureCard>

            {/* Avatar cluster */}
            <div style={{ position:"absolute", top:"42%", right:8, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              {["#F59E0B","#059669","#3B82F6"].map((c,i) => (
                <div key={i} style={{ width:32, height:32, borderRadius:"50%", background:c, border:"2px solid rgba(255,255,255,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff" }}>
                  {["A","B","C"][i]}
                </div>
              ))}
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", marginTop:2 }}>+8</div>
            </div>
          </div>
        </div>

      </div>

      {/* Responsive: hide right panel on small screens via inline media-query workaround */}
      <style>{`
        @media (max-width: 640px) {
          .auth-split { grid-template-columns: 1fr !important; }
          .auth-right { display: none !important; }
        }
      `}</style>
    </div>
  );
}
