import {
  React,
  useState,
  DEFAULT_WHITE_LABEL_SETTINGS,
  useApp,
  useTheme,
  FormField,
  btnPrimary,
  mkBtnSecondary,
  mkInputStyle,
  mkSelectStyle
} from "./_shared.js";

// ─── TOGGLE SWITCH ────────────────────────────────────────────────────────────
function Toggle({ value, onChange, accent }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{ width:44, height:24, borderRadius:99, border:"none", cursor:"pointer", background:value?(accent||"#7C3AED"):"#D1D5DB", position:"relative", transition:"background 0.2s", flexShrink:0 }}
    >
      <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:value?23:3, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
export const WhiteLabel = React.memo(function Settings() {
  const {
    resetAllData, whiteLabelSettings, setWhiteLabelSettings, resetWhiteLabelSettings,
    currentUser, projects, tasks, clients, kpis, departments, pitches, comments,
  } = useApp();
  const { theme: t } = useTheme();
  const iS = mkInputStyle(t);
  const sS = mkSelectStyle(t);
  const bs = mkBtnSecondary(t);

  const [s, setS]     = useState(whiteLabelSettings);
  const [tab, setTab] = useState("branding");
  const [saved, setSaved]   = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (key, val) => setS(prev => ({ ...prev, [key]: val }));

  const save = () => {
    setWhiteLabelSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    resetWhiteLabelSettings();
    setS(DEFAULT_WHITE_LABEL_SETTINGS);
  };

  const copyCode = () => {
    if (!currentUser?.agency_code) return;
    navigator.clipboard.writeText(currentUser.agency_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      workspace: currentUser?.agency_name,
      projects, tasks, clients, kpis, departments, pitches, comments,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `madre-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearDismissed = () => {
    localStorage.removeItem("af_dismissed");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const TABS = [
    { id:"branding",       label:"Branding",       icon:"🎨" },
    { id:"preferences",    label:"Preferences",     icon:"⚙️" },
    { id:"notifications",  label:"Notifications",   icon:"🔔" },
    { id:"data",           label:"Data & Security", icon:"🗄️" },
  ];

  const CURRENCIES = [
    { code:"USD", symbol:"$",  label:"US Dollar" },
    { code:"GBP", symbol:"£",  label:"British Pound" },
    { code:"EUR", symbol:"€",  label:"Euro" },
    { code:"AUD", symbol:"A$", label:"Australian Dollar" },
    { code:"NGN", symbol:"₦",  label:"Nigerian Naira" },
    { code:"CAD", symbol:"C$", label:"Canadian Dollar" },
  ];

  const Row = ({ label, sub, children }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom:`1px solid ${t.divider}` }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:t.textSub }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>Settings</h1>
        <div style={{ display:"flex", gap:10 }}>
          <button style={bs} onClick={reset}>Reset Defaults</button>
          <button style={{ ...btnPrimary, minWidth:120 }} onClick={save}>
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:24, background:t.statBg, borderRadius:12, padding:4, width:"fit-content" }}>
        {TABS.map(tab2 => (
          <button key={tab2.id} onClick={() => setTab(tab2.id)} style={{ ...bs, padding:"8px 18px", fontSize:13, fontWeight:tab===tab2.id?700:400, background:tab===tab2.id?t.card:"transparent", color:tab===tab2.id?t.text:t.textMuted, border:`1px solid ${tab===tab2.id?t.border2:"transparent"}`, borderRadius:9, boxShadow:tab===tab2.id?"0 1px 4px rgba(0,0,0,0.08)":"none", gap:6, display:"flex", alignItems:"center" }}>
            <span style={{ fontSize:14 }}>{tab2.icon}</span>{tab2.label}
          </button>
        ))}
      </div>

      {/* ── BRANDING TAB ──────────────────────────────────────────────────────── */}
      {tab === "branding" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
          <div>
            {/* Workspace */}
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
              <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:t.text }}>Workspace</h3>

              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:t.textMuted, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Workspace Name</div>
                <div style={{ ...iS, background:t.statBg, border:`1px solid ${t.border}`, color:t.text, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"default" }}>
                  <span>{currentUser?.agency_name || "—"}</span>
                  <span style={{ fontSize:11, color:t.textFaint, fontWeight:400 }}>set at signup</span>
                </div>
              </div>

              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:t.textMuted, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:6 }}>Invite Code</div>
                {currentUser?.agency_code ? (
                  <>
                    <div style={{ display:"flex", gap:8 }}>
                      <div style={{ ...iS, flex:1, fontFamily:"monospace", fontWeight:800, fontSize:16, letterSpacing:"0.18em", color:t.accent, background:t.statBg, border:`1px solid ${t.border}`, userSelect:"all" }}>
                        {currentUser.agency_code}
                      </div>
                      <button onClick={copyCode} style={{ ...bs, padding:"0 16px", fontWeight:700, flexShrink:0 }}>
                        {copied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <div style={{ fontSize:11, color:t.textFaint, marginTop:6 }}>Share with teammates so they can join your workspace.</div>
                  </>
                ) : (
                  <div style={{ fontSize:13, color:t.textFaint }}>No agency connected.</div>
                )}
              </div>

              <FormField label="Tagline">
                <input style={iS} value={s.tagline} onChange={e => set("tagline", e.target.value)} placeholder="Your agency's tagline" />
              </FormField>
            </div>

            {/* Brand Colours */}
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
              <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:t.text }}>Brand Colours</h3>
              {[["primary_colour","Primary Colour","Used for active nav, buttons, accents"],["accent_colour","Accent Colour","Used for highlights and AI text"]].map(([key, label, sub]) => (
                <FormField key={key} label={label}>
                  <div style={{ fontSize:11, color:t.textFaint, marginBottom:8 }}>{sub}</div>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <input type="color" style={{ ...iS, padding:4, height:40, width:80, cursor:"pointer" }} value={s[key]} onChange={e => set(key, e.target.value)} />
                    <input style={iS} value={s[key]} onChange={e => set(key, e.target.value)} placeholder="#7C3AED" />
                  </div>
                </FormField>
              ))}
            </div>

            {/* Display */}
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
              <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Display</h3>
              <Row label="Dark Sidebar" sub="Apply a dark theme to the navigation sidebar only">
                <Toggle value={s.dark_sidebar} onChange={v => set("dark_sidebar", v)} accent={s.primary_colour} />
              </Row>
              <Row label='Hide "Powered by Madre"' sub="Remove the attribution line from the sidebar footer">
                <Toggle value={s.hide_attribution} onChange={v => set("hide_attribution", v)} accent={s.primary_colour} />
              </Row>
            </div>
          </div>

          {/* Live preview */}
          <div style={{ background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden", alignSelf:"start" }}>
            <div style={{ padding:"12px 16px", background:t.card, borderBottom:`1px solid ${t.border2}` }}>
              <span style={{ fontSize:11, fontWeight:700, color:t.textFaint, letterSpacing:"0.06em", textTransform:"uppercase" }}>Live Preview</span>
            </div>
            <div style={{ display:"flex", height:420 }}>
              <div style={{ width:180, background:s.dark_sidebar?"#0f0f1a":"#F9F9FF", borderRight:`1px solid ${t.border}`, padding:16 }}>
                <div style={{ fontSize:15, fontWeight:800, color:s.primary_colour, marginBottom:2 }}>{currentUser?.agency_name || s.agency_name}</div>
                <div style={{ fontSize:10, color:t.textFaint, marginBottom:20 }}>{s.tagline}</div>
                {["Dashboard","Projects","Tasks","Team","Reports"].map(item => (
                  <div key={item} style={{ padding:"8px 10px", borderRadius:8, marginBottom:4, fontSize:12, color:item==="Dashboard"?s.primary_colour:s.dark_sidebar?"#aaa":t.textFaint, background:item==="Dashboard"?s.primary_colour+"22":"transparent", fontWeight:item==="Dashboard"?700:400 }}>{item}</div>
                ))}
              </div>
              <div style={{ flex:1, padding:16 }}>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:s.primary_colour, marginBottom:10 }}>Dashboard</div>
                  <div style={{ height:28, background:s.primary_colour+"22", borderRadius:8, marginBottom:8, display:"flex", alignItems:"center", paddingLeft:10 }}>
                    <span style={{ fontSize:11, color:s.primary_colour, fontWeight:700 }}>Active Projects</span>
                    <span style={{ marginLeft:"auto", marginRight:10, fontSize:16, fontWeight:800, color:s.primary_colour }}>12</span>
                  </div>
                  <div style={{ height:24, background:t.toggleBg, borderRadius:8, marginBottom:8 }} />
                  <div style={{ height:24, background:t.toggleBg, borderRadius:8, marginBottom:8, width:"70%" }} />
                </div>
                <button style={{ background:s.primary_colour, color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ New Project</button>
                {!s.hide_attribution && <div style={{ fontSize:10, color:t.textGhost, marginTop:36 }}>Powered by Madre</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PREFERENCES TAB ───────────────────────────────────────────────────── */}
      {tab === "preferences" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
          {/* Finance */}
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Finance</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>Used for budget calculations in Reports.</p>
            <FormField label="Currency">
              <select style={sS} value={s.currency} onChange={e => set("currency", e.target.value)}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.label} ({c.code})</option>)}
              </select>
            </FormField>
            <FormField label="Billing Rate (per hour)">
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ ...iS, width:50, textAlign:"center", color:t.textFaint, fontSize:16, fontWeight:700, flexShrink:0, cursor:"default", background:t.statBg }}>
                  {CURRENCIES.find(c => c.code === s.currency)?.symbol || "$"}
                </div>
                <input
                  type="number" min="0" step="5" style={{ ...iS, flex:1 }}
                  value={s.billing_rate} onChange={e => set("billing_rate", Number(e.target.value))}
                  placeholder="150"
                />
                <span style={{ fontSize:12, color:t.textFaint, flexShrink:0 }}>/ hour</span>
              </div>
              <div style={{ fontSize:11, color:t.textFaint, marginTop:6 }}>
                Default rate applied when no project-specific rate is set.
              </div>
            </FormField>
          </div>

          {/* Task Defaults */}
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Task Defaults</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>Pre-filled values when creating a new task.</p>
            <FormField label="Default Priority">
              <select style={sS} value={s.default_task_priority} onChange={e => set("default_task_priority", e.target.value)}>
                {["Critical","High","Medium","Low"].map(p => <option key={p}>{p}</option>)}
              </select>
            </FormField>
          </div>

          {/* Calendar */}
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Calendar</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>Controls how dates and weeks are displayed.</p>
            <FormField label="Week Starts On">
              <select style={sS} value={s.week_starts_on} onChange={e => set("week_starts_on", e.target.value)}>
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </FormField>
          </div>

          {/* About the workspace */}
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Workspace Stats</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>Current data overview.</p>
            {[
              ["Projects",  projects?.length   || 0],
              ["Tasks",     tasks?.length       || 0],
              ["Clients",   clients?.length     || 0],
              ["KPIs",      kpis?.length        || 0],
              ["Pitches",   pitches?.length     || 0],
              ["Comments",  comments?.length    || 0],
            ].map(([label, count]) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${t.divider}` }}>
                <span style={{ fontSize:13, color:t.textMuted }}>{label}</span>
                <span style={{ fontSize:13, fontWeight:700, color:t.textSub }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS TAB ─────────────────────────────────────────────────── */}
      {tab === "notifications" && (
        <div style={{ maxWidth:600 }}>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>In-App Notifications</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 4px" }}>Choose what appears in the notification bell.</p>

            <Row label="Task Deadline Reminders" sub="Show alerts when tasks are overdue or due soon">
              <Toggle value={s.notify_deadlines} onChange={v => set("notify_deadlines", v)} accent={s.primary_colour} />
            </Row>
            <Row label="@ Mentions" sub="Notify when someone tags you in a comment">
              <Toggle value={s.notify_mentions} onChange={v => set("notify_mentions", v)} accent={s.primary_colour} />
            </Row>
            <Row label="Project Comments" sub="Show new comments added to your projects">
              <Toggle value={s.notify_comments} onChange={v => set("notify_comments", v)} accent={s.primary_colour} />
            </Row>
          </div>

          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Deadline Warning Window</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>How far in advance to flag an upcoming deadline.</p>
            <div style={{ display:"flex", gap:10 }}>
              {[["12", "12 hours"], ["24", "24 hours"], ["48", "48 hours"], ["72", "3 days"]].map(([val, label]) => (
                <button key={val} onClick={() => set("deadline_warning_hours", Number(val))} style={{ ...bs, padding:"8px 16px", fontSize:13, fontWeight:700, background:s.deadline_warning_hours===Number(val)?s.primary_colour+"22":t.toggleBg, color:s.deadline_warning_hours===Number(val)?s.primary_colour:t.textMuted, border:`1px solid ${s.deadline_warning_hours===Number(val)?s.primary_colour+"88":t.border}` }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, color:t.textFaint, marginTop:10 }}>
              Currently: tasks due within <strong style={{ color:t.textSub }}>{s.deadline_warning_hours} hours</strong> will show a deadline warning in the notification bell.
            </div>
          </div>
        </div>
      )}

      {/* ── DATA & SECURITY TAB ───────────────────────────────────────────────── */}
      {tab === "data" && (
        <div style={{ maxWidth:600 }}>
          {/* Export */}
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Export Data</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>Download a full JSON backup of your workspace data including projects, tasks, clients, KPIs, pitches and comments.</p>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <button onClick={exportData} style={{ ...btnPrimary, padding:"9px 20px" }}>⬇ Download JSON Export</button>
              <span style={{ fontSize:11, color:t.textFaint }}>
                {(projects?.length||0) + (tasks?.length||0) + (clients?.length||0)} records total
              </span>
            </div>
          </div>

          {/* Clear notifications */}
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Clear Dismissed Notifications</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>All dismissed notifications will reappear in the bell. Useful if you accidentally dismissed something important.</p>
            <button onClick={clearDismissed} style={{ ...bs, padding:"9px 20px" }}>🔔 Restore Dismissed Notifications</button>
          </div>

          {/* LocalStorage info */}
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Storage</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 12px" }}>App data is synced to your Supabase workspace. Settings and preferences are stored locally in your browser.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[
                ["Sync mode", currentUser?.agency_id ? "Supabase cloud" : "Local browser"],
                ["Workspace ID", currentUser?.agency_id || "Demo mode"],
                ["Settings storage", "Browser localStorage"],
              ].map(([label, val]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${t.divider}` }}>
                  <span style={{ fontSize:12, color:t.textMuted }}>{label}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:t.textSub, fontFamily:"monospace" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Danger zone */}
          <div style={{ background:"#EF444408", border:"1px solid #EF444433", borderRadius:14, padding:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#EF4444", marginBottom:6 }}>⚠ Danger Zone</div>
            <p style={{ fontSize:12, color:t.textMuted, margin:"0 0 14px" }}>
              Wipe all projects, tasks, clients, KPIs, departments and pitches and restore factory demo data. <strong>This cannot be undone.</strong>
            </p>
            <button
              onClick={() => { if (window.confirm("Reset ALL app data to factory defaults? This cannot be undone.")) resetAllData(); }}
              style={{ background:"#EF4444", color:"#fff", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:700, cursor:"pointer" }}
            >
              Reset All App Data
            </button>
          </div>
        </div>
      )}

      {/* Sticky save bar when on non-branding tabs */}
      {tab !== "branding" && (
        <div style={{ marginTop:24, display:"flex", gap:10 }}>
          <button style={{ ...btnPrimary, minWidth:130 }} onClick={save}>{saved ? "✓ Saved!" : "Save Changes"}</button>
          <button style={bs} onClick={reset}>Reset Defaults</button>
        </div>
      )}
    </div>
  );
});
