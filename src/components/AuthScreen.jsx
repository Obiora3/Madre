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

  const iS = {
    width: "100%",
    boxSizing: "border-box",
    background: t.input,
    border: `1px solid ${t.inputBorder}`,
    borderRadius: 8,
    color: t.textSub,
    fontSize: 14,
    outline: "none",
    padding: "11px 12px",
  };

  const fieldLabel = (text) => (
    <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>
      {text}
    </span>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      color: t.textSub,
      display: "grid",
      placeItems: "center",
      padding: 24,
      fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: t.card,
        border: `1px solid ${t.border2}`,
        borderRadius: 14,
        boxShadow: t.shadow,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "26px 28px 18px", borderBottom: `1px solid ${t.border2}` }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: brand.primary_colour, marginBottom: 4 }}>
            {brand.agency_name}
          </div>
          <div style={{ fontSize: 13, color: t.textMuted }}>{brand.tagline}</div>
        </div>

        <div style={{ padding: 28 }}>
          {/* Sign in / Sign up tabs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 22 }}>
            {[["signin", "Sign In"], ["signup", "Sign Up"]].map(([id, label]) => {
              const active = mode === id;
              return (
                <button key={id} type="button" onClick={() => switchMode(id)} style={{
                  border: `1px solid ${active ? brand.primary_colour : t.border2}`,
                  background: active ? `${brand.primary_colour}22` : t.statBg,
                  color: active ? brand.primary_colour : t.textMuted,
                  borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "9px 12px",
                }}>
                  {label}
                </button>
              );
            })}
          </div>

          <form onSubmit={submit}>
            {/* Name — signup only */}
            {mode === "signup" && (
              <label style={{ display: "block", marginBottom: 14 }}>
                {fieldLabel("Full Name")}
                <input style={iS} value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  autoComplete="name" />
              </label>
            )}

            {/* Email */}
            <label style={{ display: "block", marginBottom: 14 }}>
              {fieldLabel("Email")}
              <input type="email" style={iS} value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                autoComplete="email" />
            </label>

            {/* Password */}
            <label style={{ display: "block", marginBottom: mode === "signup" ? 18 : 16 }}>
              {fieldLabel("Password")}
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  style={{ ...iS, paddingRight: 40 }}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: 16, lineHeight: 1, padding: 2 }}>
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>

            {/* Agency section — signup only */}
            {mode === "signup" && (
              <div style={{ background: t.statBg, border: `1px solid ${t.border2}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, letterSpacing: "0.07em", marginBottom: 10 }}>
                  AGENCY
                </div>

                {/* Create / Join toggle */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                  {[["create", "Create Agency"], ["join", "Join Agency"]].map(([id, label]) => {
                    const active = agencyMode === id;
                    return (
                      <button key={id} type="button" onClick={() => setAgencyMode(id)} style={{
                        border: `1px solid ${active ? brand.primary_colour : t.border2}`,
                        background: active ? `${brand.primary_colour}22` : "transparent",
                        color: active ? brand.primary_colour : t.textMuted,
                        borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "7px 10px",
                      }}>
                        {label}
                      </button>
                    );
                  })}
                </div>

                {agencyMode === "create" ? (
                  <label style={{ display: "block" }}>
                    {fieldLabel("Agency Name")}
                    <input style={iS} value={agencyName}
                      onChange={e => setAgencyName(e.target.value)}
                      placeholder="e.g. Nova Creative" />
                  </label>
                ) : (
                  <label style={{ display: "block" }}>
                    {fieldLabel("Agency Code")}
                    <input style={{ ...iS, textTransform: "uppercase", letterSpacing: "0.1em" }}
                      value={agencyCode}
                      onChange={e => setAgencyCode(e.target.value.toUpperCase())}
                      placeholder="e.g. NOVA8K2X"
                      maxLength={8} />
                  </label>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                background: "#EF444411", border: "1px solid #EF444444",
                borderRadius: 8, color: "#EF4444", fontSize: 12,
                lineHeight: 1.5, marginBottom: 14, padding: "10px 12px",
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%",
              background: brand.primary_colour,
              border: "none", borderRadius: 8, color: "#fff",
              cursor: loading ? "wait" : "pointer",
              fontSize: 14, fontWeight: 800, padding: "11px 16px",
              opacity: loading ? 0.75 : 1,
            }}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
