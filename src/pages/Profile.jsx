import { useEffect, useState } from "react";
import { useApp } from "../context/app-context.jsx";
import { useTheme } from "../theme.js";
import { useToast } from "../toast.jsx";
import { Avatar, FormField } from "../components/common.jsx";
import { btnPrimary, mkBtnSecondary, mkInputStyle } from "../styles/formStyles.js";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

function AgencyPanel({ currentUser, setupAgency, t, iS, bs }) {
  const toast = useToast();
  const [agencyMode, setAgencyMode] = useState("create");
  const [agencyName, setAgencyName] = useState("");
  const [agencyCode, setAgencyCode] = useState("");
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(currentUser.agency_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const submit = async () => {
    setWorking(true);
    try {
      await setupAgency({ agencyMode, agencyName, agencyCode });
      toast({ message: agencyMode === "create" ? "Agency created!" : "Joined agency!" });
    } catch (err) {
      toast({ message: err.message, type: "error" });
    } finally {
      setWorking(false);
    }
  };

  // Already linked — show code
  if (currentUser?.agency_code) {
    return (
      <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: 20, marginTop: 16 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: t.text }}>Agency</h3>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 14 }}>
          {currentUser.agency_name || "Your Agency"}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.textFaint, letterSpacing: "0.06em", marginBottom: 8 }}>
          INVITE CODE — share with teammates
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, background: t.statBg, border: `1px solid ${t.border2}`, borderRadius: 8, padding: "10px 14px", fontFamily: "monospace", fontSize: 20, fontWeight: 800, color: t.accent, letterSpacing: "0.2em" }}>
            {currentUser.agency_code}
          </div>
          <button onClick={copyCode} style={{ background: copied ? "#059669" : t.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.2s" }}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    );
  }

  // Not linked — show setup form
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: 20, marginTop: 16 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: t.text }}>Agency Setup</h3>
      <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>
        You are not linked to an agency yet.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        {[["create", "Create Agency"], ["join", "Join Agency"]].map(([id, label]) => {
          const active = agencyMode === id;
          return (
            <button key={id} type="button" onClick={() => setAgencyMode(id)} style={{
              border: `1px solid ${active ? t.accent : t.border2}`,
              background: active ? t.accent + "22" : "transparent",
              color: active ? t.accent : t.textMuted,
              borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "8px 10px",
            }}>
              {label}
            </button>
          );
        })}
      </div>

      {agencyMode === "create" ? (
        <FormField label="Agency Name">
          <input style={iS} value={agencyName} onChange={e => setAgencyName(e.target.value)} placeholder="e.g. Nova Creative" />
        </FormField>
      ) : (
        <FormField label="Agency Code">
          <input style={{ ...iS, textTransform: "uppercase", letterSpacing: "0.1em" }}
            value={agencyCode} onChange={e => setAgencyCode(e.target.value.toUpperCase())}
            placeholder="e.g. NOVA8K2X" maxLength={8} />
        </FormField>
      )}

      <button onClick={submit} disabled={working} style={{ ...btnPrimary, opacity: working ? 0.75 : 1, marginTop: 4 }}>
        {working ? "Please wait…" : agencyMode === "create" ? "Create Agency" : "Join Agency"}
      </button>
    </div>
  );
}

function DiagnosticsPanel({ t }) {
  const { currentUser } = useApp();
  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    const result = {
      agency_id: currentUser?.agency_id ?? "NOT SET",
      mode: isSupabaseConfigured && currentUser?.agency_id ? "LIVE (Supabase)" : "LOCAL (localStorage only)",
      supabase_connected: isSupabaseConfigured,
    };
    if (isSupabaseConfigured && supabase) {
      const [pr, cl, ta] = await Promise.all([
        supabase.from("projects").select("id, agency_id", { count: "exact" }),
        supabase.from("clients").select("id, agency_id", { count: "exact" }),
        supabase.from("tasks").select("id, agency_id", { count: "exact" }),
      ]);
      result.projects_in_db = pr.count ?? pr.data?.length ?? "error";
      result.clients_in_db = cl.count ?? cl.data?.length ?? "error";
      result.tasks_in_db = ta.count ?? ta.data?.length ?? "error";
      result.projects_error = pr.error?.message;
      result.clients_error = cl.error?.message;

      // Check profile directly
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", currentUser?.id).single();
      result.db_agency_id = profile?.agency_id ?? "NULL in database";
      result.agency_match = profile?.agency_id === currentUser?.agency_id ? "✓ Match" : "✗ MISMATCH";
    }
    setInfo(result);
    setChecking(false);
  };

  const row = (label, value, warn) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${t.border}` }}>
      <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: warn ? "#ef4444" : t.text, fontFamily: "monospace" }}>{String(value)}</span>
    </div>
  );

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: 20, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text }}>Diagnostics</h3>
        <button onClick={check} disabled={checking} style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12 }}>
          {checking ? "Checking…" : "Run Check"}
        </button>
      </div>
      {info && (
        <div>
          {row("Mode", info.mode, !info.agency_id || info.mode.includes("LOCAL"))}
          {row("Frontend agency_id", info.agency_id, info.agency_id === "NOT SET")}
          {info.db_agency_id !== undefined && row("Database agency_id", info.db_agency_id, !info.db_agency_id || info.db_agency_id === "NULL in database")}
          {info.agency_match !== undefined && row("Frontend ↔ DB match", info.agency_match, info.agency_match.includes("✗"))}
          {info.projects_in_db !== undefined && row("Projects visible in DB", info.projects_in_db)}
          {info.clients_in_db !== undefined && row("Clients visible in DB", info.clients_in_db)}
          {info.tasks_in_db !== undefined && row("Tasks visible in DB", info.tasks_in_db)}
          {info.projects_error && row("Projects error", info.projects_error, true)}
          {info.clients_error && row("Clients error", info.clients_error, true)}
        </div>
      )}
      {!info && <div style={{ fontSize: 12, color: t.textMuted }}>Click "Run Check" to inspect your live connection state.</div>}
    </div>
  );
}

export function Profile() {
  const { currentUser, updateProfile, setupAgency, resetAllData, isMobile } = useApp();
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t);
  const bs = mkBtnSecondary(t);
  const canResetData = (currentUser?.role || "member").toLowerCase() === "owner";

  const [form, setForm] = useState({
    name: currentUser?.name || "",
    job_title: currentUser?.job_title || "",
    department: currentUser?.department || "",
    skills: (currentUser?.skills || []).join(", "),
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { toast({ message: "Name is required.", type: "error" }); return; }
    setSaving(true);
    try {
      await updateProfile({
        name: form.name.trim(),
        job_title: form.job_title.trim(),
        department: form.department.trim(),
        skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
      });
      toast({ message: "Profile updated successfully." });
    } catch (err) {
      toast({ message: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 24px", fontSize: 26, fontWeight: 800, color: t.text }}>My Profile</h1>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24, maxWidth: 820 }}>

        {/* Left — edit form */}
        <div>
          <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar name={currentUser?.name} size={60} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{currentUser?.name}</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{currentUser?.email}</div>
              <span style={{ display: "inline-block", marginTop: 6, background: t.accent + "22", color: t.accent, border: `1px solid ${t.accent}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                {currentUser?.role}
              </span>
            </div>
          </div>

          <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: t.text }}>Edit Details</h3>
            <FormField label="Full Name">
              <input style={iS} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="Job Title">
              <input style={iS} value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} placeholder="e.g. Creative Director" />
            </FormField>
            <FormField label="Department">
              <input style={iS} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. Creative" />
            </FormField>
            <FormField label="Skills (comma-separated)">
              <input style={iS} value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="e.g. Branding, Strategy, Design" />
            </FormField>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={{ ...btnPrimary, opacity: saving ? 0.75 : 1 }} onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button style={bs} onClick={() => setForm({
                name: currentUser?.name || "",
                job_title: currentUser?.job_title || "",
                department: currentUser?.department || "",
                skills: (currentUser?.skills || []).join(", "),
              })}>
                Cancel
              </button>
            </div>
          </div>
          <AgencyPanel currentUser={currentUser} setupAgency={setupAgency} t={t} iS={iS} bs={bs} />
          <DiagnosticsPanel t={t} />

          {/* Danger zone */}
          <div style={{ background: t.card, border: `1px solid #ef444466`, borderRadius: 14, padding: 20, marginTop: 16 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#ef4444" }}>Clear All Data</h3>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14 }}>
              Permanently deletes every project, task, client, KPI, department and pitch. This cannot be undone.
            </div>
            <button
              onClick={async () => {
                if (!canResetData) return;
                if (!window.confirm("Delete ALL data permanently? This cannot be undone.")) return;
                try {
                  await resetAllData();
                  toast({ message: "All data cleared.", type: "success" });
                } catch (err) {
                  toast({ message: err.message, type: "error" });
                }
              }}
              disabled={!canResetData}
              title={canResetData ? "Clear all data" : "Only workspace owners can clear all data"}
              style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: canResetData ? "pointer" : "not-allowed", opacity: canResetData ? 1 : 0.5 }}
            >
              Clear All Data
            </button>
          </div>
        </div>

        {/* Right — account info */}
        <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: 20, height: "fit-content" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: t.text }}>Account Info</h3>
          {[
            ["Email", currentUser?.email],
            ["Role", currentUser?.role],
            ["Department", currentUser?.department || "—"],
            ["Job Title", currentUser?.job_title || "—"],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 12, color: t.text, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
          {currentUser?.skills?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginBottom: 8 }}>Skills</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {currentUser.skills.map(skill => (
                  <span key={skill} style={{ background: t.statBg, border: `1px solid ${t.border2}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, color: t.textSub, fontWeight: 600 }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
