import { useState } from "react";
import { useTheme } from "../theme.js";

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
    borderRadius: 10,
    color: t.textSub,
    fontSize: 14,
    outline: "none",
    padding: "12px 14px",
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
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Decorative blobs */}
      <div style={{ position:"fixed", top:-120, right:-120, width:400, height:400, borderRadius:"50%", background:`${accent}12`, filter:"blur(60px)", pointerEvents:"none" }} />
      <div style={{ position:"fixed", bottom:-80, left:-80, width:300, height:300, borderRadius:"50%", background:`${accent}0d`, filter:"blur(50px)", pointerEvents:"none" }} />

      <div style={{
        width: "100%",
        maxWidth: 460,
        position: "relative",
        zIndex: 1,
      }}>
        {/* Logo + branding above card */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 80, height: 80,
            borderRadius: 20,
            background: `${accent}18`,
            border: `1.5px solid ${accent}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            overflow: "hidden",
          }}>
            <img src="/logo.png" alt="logo" style={{ width: 60, height: 60, objectFit: "contain" }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: "-0.02em" }}>
            {brand.agency_name}
          </div>
          {brand.tagline && (
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>{brand.tagline}</div>
          )}
        </div>

        {/* Card */}
        <div style={{
          background: t.card,
          border: `1px solid ${t.border2}`,
          borderRadius: 20,
          boxShadow: `0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px ${accent}11`,
          overflow: "hidden",
        }}>
          {/* Accent top bar */}
          <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />

          <div style={{ padding: "28px 32px 32px" }}>
            {/* Tab switcher */}
            <div style={{
              display: "flex",
              background: t.statBg,
              borderRadius: 12,
              padding: 4,
              marginBottom: 28,
              border: `1px solid ${t.border}`,
            }}>
              {[["signin", "Sign In"], ["signup", "Create Account"]].map(([id, label]) => {
                const active = mode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => switchMode(id)}
                    style={{
                      flex: 1,
                      border: "none",
                      borderRadius: 9,
                      background: active ? t.card : "transparent",
                      color: active ? accent : t.textMuted,
                      fontWeight: active ? 700 : 500,
                      fontSize: 13,
                      padding: "9px 12px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: active ? `0 1px 6px rgba(0,0,0,0.1)` : "none",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={submit}>
              {mode === "signup" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>Full Name</label>
                  <input
                    style={inputStyle}
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>Email address</label>
                <input
                  type="email"
                  style={inputStyle}
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div style={{ marginBottom: mode === "signup" ? 20 : 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    style={{ ...inputStyle, paddingRight: 44 }}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder={mode === "signin" ? "Your password" : "Min. 8 characters"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: t.textMuted, fontSize: 15, lineHeight: 1, padding: 2,
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              {/* Agency section — signup only */}
              {mode === "signup" && (
                <div style={{
                  background: `${accent}09`,
                  border: `1.5px solid ${accent}22`,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 20,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: 14 }}>🏢</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: "0.08em" }}>AGENCY WORKSPACE</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                    {[["create", "Create New"], ["join", "Join Existing"]].map(([id, label]) => {
                      const active = agencyMode === id;
                      return (
                        <button key={id} type="button" onClick={() => setAgencyMode(id)} style={{
                          border: `1.5px solid ${active ? accent : t.border2}`,
                          background: active ? accent : "transparent",
                          color: active ? "#fff" : t.textMuted,
                          borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "8px 10px",
                          transition: "all 0.15s",
                        }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {agencyMode === "create" ? (
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>Agency Name</label>
                      <input
                        style={inputStyle}
                        value={agencyName}
                        onChange={e => setAgencyName(e.target.value)}
                        placeholder="e.g. Nova Creative"
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>Invite Code</label>
                      <input
                        style={{ ...inputStyle, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, fontSize: 16 }}
                        value={agencyCode}
                        onChange={e => setAgencyCode(e.target.value.toUpperCase())}
                        placeholder="XXXXXXXX"
                        maxLength={8}
                      />
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div style={{
                  background: "#EF444411",
                  border: "1.5px solid #EF444433",
                  borderRadius: 10,
                  color: "#EF4444",
                  fontSize: 12,
                  lineHeight: 1.6,
                  marginBottom: 16,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  background: loading ? `${accent}99` : accent,
                  border: "none",
                  borderRadius: 12,
                  color: "#fff",
                  cursor: loading ? "wait" : "pointer",
                  fontSize: 15,
                  fontWeight: 800,
                  padding: "13px 16px",
                  letterSpacing: "0.01em",
                  boxShadow: loading ? "none" : `0 4px 20px ${accent}44`,
                  transition: "all 0.2s",
                }}
              >
                {loading ? "Please wait…" : mode === "signin" ? "Sign In →" : "Create Account →"}
              </button>

              {mode === "signin" && (
                <div style={{ textAlign: "center", marginTop: 18 }}>
                  <span style={{ fontSize: 12, color: t.textFaint }}>Don't have an account? </span>
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: accent, padding: 0 }}
                  >
                    Sign up free
                  </button>
                </div>
              )}
              {mode === "signup" && (
                <div style={{ textAlign: "center", marginTop: 18 }}>
                  <span style={{ fontSize: 12, color: t.textFaint }}>Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: accent, padding: 0 }}
                  >
                    Sign in
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: t.textGhost }}>
          Secured by Madre · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
