import { useState } from "react";
import { useTheme } from "../theme.js";

export function AuthScreen({ brand, onSignIn, onSignUp, onDemo }) {
  const { theme: t } = useTheme();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signin") {
        await onSignIn({ email: form.email, password: form.password });
      } else {
        await onSignUp(form);
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
    border: `1px solid ${t.inputBorder}`,
    borderRadius: 8,
    color: t.textSub,
    fontSize: 14,
    outline: "none",
    padding: "11px 12px"
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      color: t.textSub,
      display: "grid",
      placeItems: "center",
      padding: 24,
      fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif"
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: t.card,
        border: `1px solid ${t.border2}`,
        borderRadius: 14,
        boxShadow: t.shadow,
        overflow: "hidden"
      }}>
        <div style={{ padding: "26px 28px 18px", borderBottom: `1px solid ${t.border2}` }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: brand.primary_colour, marginBottom: 4 }}>
            {brand.agency_name}
          </div>
          <div style={{ fontSize: 13, color: t.textMuted }}>{brand.tagline}</div>
        </div>

        <div style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 22 }}>
            {[
              ["signin", "Sign In"],
              ["signup", "Sign Up"]
            ].map(([id, label]) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setMode(id); setError(""); }}
                  style={{
                    border: `1px solid ${active ? brand.primary_colour : t.border2}`,
                    background: active ? `${brand.primary_colour}22` : t.statBg,
                    color: active ? brand.primary_colour : t.textMuted,
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "9px 12px"
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <form onSubmit={submit}>
            {mode === "signup" && (
              <label style={{ display: "block", marginBottom: 14 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>
                  Name
                </span>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  autoComplete="name"
                />
              </label>
            )}

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>
                Email
              </span>
              <input
                type="email"
                style={inputStyle}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="email"
              />
            </label>

            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>
                Password
              </span>
              <input
                type="password"
                style={inputStyle}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </label>

            {error && (
              <div style={{
                background: "#EF444411",
                border: "1px solid #EF444444",
                borderRadius: 8,
                color: "#EF4444",
                fontSize: 12,
                lineHeight: 1.5,
                marginBottom: 14,
                padding: "10px 12px"
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: brand.primary_colour,
                border: "none",
                borderRadius: 8,
                color: "#fff",
                cursor: loading ? "wait" : "pointer",
                fontSize: 14,
                fontWeight: 800,
                padding: "11px 16px",
                opacity: loading ? 0.75 : 1
              }}
            >
              {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <button
            type="button"
            onClick={onDemo}
            style={{
              width: "100%",
              background: "transparent",
              border: `1px solid ${t.border2}`,
              borderRadius: 8,
              color: t.textMuted,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              marginTop: 12,
              padding: "10px 16px"
            }}
          >
            Continue with demo account
          </button>

          <div style={{ color: t.textFaint, fontSize: 11, lineHeight: 1.5, marginTop: 16 }}>
            Demo sign in: adaeze@agency.io with password agencyflow.
          </div>
        </div>
      </div>
    </div>
  );
}
