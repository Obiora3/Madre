import {
  React,
  useMemo,
  useState,
  DEFAULT_WHITE_LABEL_SETTINGS,
  getTaskPipelines,
  isTaskComplete,
  useApp,
  useTheme,
  Avatar,
  Badge,
  FormField,
  btnPrimary,
  mkBtnSecondary,
  mkInputStyle,
  mkSelectStyle
} from "./_shared.js";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, accent }) {
  return (
    <button onClick={() => onChange(!value)} style={{ width:44, height:24, borderRadius:99, border:"none", cursor:"pointer", background:value?(accent||"#7C3AED"):"#D1D5DB", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:value?23:3, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

const timeAgo = (iso) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff/86400000)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
};

const ROLE_META = {
  owner:   { label:"Owner",   color:"#7C3AED", desc:"Full access · can manage billing and delete workspace" },
  admin:   { label:"Admin",   color:"#3B82F6", desc:"Full access · can manage team and settings" },
  manager: { label:"Manager", color:"#F59E0B", desc:"Can create & edit projects · cannot manage team" },
  member:  { label:"Member",  color:"#059669", desc:"Can create tasks and comment · cannot edit projects" },
  viewer:  { label:"Viewer",  color:"#6B7280", desc:"Read-only access to all content" },
};

const PERMISSIONS = [
  { label:"View projects & tasks",    owner:true,  admin:true,  manager:true,  member:true,  viewer:true  },
  { label:"Create & edit tasks",      owner:true,  admin:true,  manager:true,  member:true,  viewer:false },
  { label:"Delete tasks",             owner:true,  admin:true,  manager:true,  member:false, viewer:false },
  { label:"Log time on tasks",        owner:true,  admin:true,  manager:true,  member:true,  viewer:false },
  { label:"Comment on projects",      owner:true,  admin:true,  manager:true,  member:true,  viewer:false },
  { label:"Create projects",          owner:true,  admin:true,  manager:true,  member:false, viewer:false },
  { label:"Edit & delete projects",   owner:true,  admin:true,  manager:true,  member:false, viewer:false },
  { label:"Manage clients & KPIs",    owner:true,  admin:true,  manager:true,  member:false, viewer:false },
  { label:"Manage departments",       owner:true,  admin:true,  manager:false, member:false, viewer:false },
  { label:"Invite team members",      owner:true,  admin:true,  manager:false, member:false, viewer:false },
  { label:"Change member roles",      owner:true,  admin:true,  manager:false, member:false, viewer:false },
  { label:"Access settings",          owner:true,  admin:true,  manager:false, member:false, viewer:false },
  { label:"Reset & export data",      owner:true,  admin:false, manager:false, member:false, viewer:false },
];

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
export const WhiteLabel = React.memo(function Settings() {
  const {
    resetAllData, whiteLabelSettings, setWhiteLabelSettings, resetWhiteLabelSettings,
    currentUser, users, projects, tasks, clients, kpis, departments, pitches, comments, nav,
    events: activityEvents, updateMemberRole, isMobile,
  } = useApp();
  const { theme: t } = useTheme();
  const iS = mkInputStyle(t);
  const sS = mkSelectStyle(t);
  const bs = mkBtnSecondary(t);

  const [s, setS]           = useState(whiteLabelSettings);
  const [tab, setTab]       = useState("branding");
  const [saved, setSaved]   = useState(false);
  const [copied, setCopied] = useState(false);
  const [pipelineDraft, setPipelineDraft] = useState({ name:"", description:"", statuses:"To Do\nIn Progress\nIn Review\nDone" });
  const taskPipelines = useMemo(() => getTaskPipelines(s), [s]);
  const projectById = useMemo(() => Object.fromEntries((projects || []).map(p => [p.id, p])), [projects]);

  // Activity filter / pagination
  const [actFilter, setActFilter]   = useState("all");
  const [actPage, setActPage]       = useState(1);
  const ACT_PAGE_SIZE = 20;

  // Teams & Roles
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingRole, setEditingRole] = useState(null); // userId being edited
  const [pendingRoles, setPendingRoles] = useState({});  // { userId: newRole }

  const currentRole = (currentUser?.role || "member").toLowerCase();
  const canManageRoles = ["owner", "admin"].includes(currentRole);
  const canResetData = currentRole === "owner";

  const set = (key, val) => setS(prev => ({ ...prev, [key]: val }));
  const addPipeline = () => {
    const labels = pipelineDraft.statuses.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean);
    if (!pipelineDraft.name.trim() || labels.length < 2) return;
    const colors = ["#6B7280", "#3B82F6", "#F59E0B", "#059669", "#8B5CF6", "#0891B2"];
    const pipeline = {
      id: `custom-${Date.now()}`,
      name: pipelineDraft.name.trim(),
      description: pipelineDraft.description.trim(),
      builtIn: false,
      statuses: labels.map((label, idx) => ({
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `status_${idx + 1}`,
        label,
        color: colors[Math.min(idx, colors.length - 1)],
        category: idx === labels.length - 1 ? "complete" : idx === 0 ? "todo" : idx >= labels.length - 2 ? "review" : "active",
        isComplete: idx === labels.length - 1,
      })),
    };
    setS(prev => ({ ...prev, project_pipelines:[...(prev.project_pipelines || prev.task_pipelines || []), pipeline] }));
    setPipelineDraft({ name:"", description:"", statuses:"To Do\nIn Progress\nIn Review\nDone" });
  };
  const removePipeline = (pipelineId) => {
    setS(prev => ({ ...prev, project_pipelines:(prev.project_pipelines || prev.task_pipelines || []).filter(p => p.id !== pipelineId) }));
  };

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
    if (!canResetData) return;
    const blob = new Blob([JSON.stringify({ exported_at:new Date().toISOString(), workspace:currentUser?.agency_name, projects, tasks, clients, kpis, departments, pitches, comments }, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `madre-export-${new Date().toISOString().split("T")[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Activity feed — real events when available, synthetic fallback ──────────
  const EVENT_META = {
    created:   { icon:"✦",  color:"#7C3AED" },
    updated:   { icon:"✏",  color:"#3B82F6" },
    completed: { icon:"✅", color:"#059669" },
    deleted:   { icon:"🗑", color:"#EF4444" },
    commented: { icon:"💬", color:"#0891B2" },
    status:    { icon:"🔄", color:"#F59E0B" },
    deadline_warning: { icon:"⏰", color:"#F59E0B" },
    escalated: { icon:"⚠", color:"#EF4444" },
    blocked: { icon:"⛔", color:"#F59E0B" },
  };

  const activityFeed = useMemo(() => {
    if (activityEvents && activityEvents.length > 0) {
      return activityEvents.map(e => {
        const meta = EVENT_META[e.event_type] || { icon:"•", color:"#6B7280" };
        return { id:e.id, type:e.entity_type, icon:meta.icon, color:meta.color, user:e.user_name, action:e.event_type, target:e.entity_title||e.entity_id||"", targetSub:e.entity_type, ts:e.created_at };
      });
    }
    // Synthetic fallback when no real events exist yet
    const evts = [];
    comments.forEach(c => {
      const proj = c.entity_type === "project" ? projects.find(p => p.id === c.entity_id) : null;
      const task = c.entity_type === "task"    ? tasks.find(t2 => t2.id === c.entity_id) : null;
      evts.push({ id:c.id, type:"comment", icon:"💬", color:"#3B82F6", user:c.user_name||"Someone", action:"commented on", target:proj?.title||task?.title||"an item", targetSub: proj?"Project":(task?"Task":""), ts:c.created_at });
    });
    tasks.forEach(t2 => {
      if (!t2.created_at) return;
      const proj = projects.find(p => p.id === t2.project_id);
      evts.push({ id:`tc-${t2.id}`, type:"task", icon:"✓", color:"#059669", user:t2.assigned_to?.name||"Unassigned", action:"created task", target:t2.title, targetSub:proj?`in ${proj.title}`:"", ts:t2.created_at });
      if (isTaskComplete(t2, proj, taskPipelines)) evts.push({ id:`td-${t2.id}`, type:"task", icon:"✅", color:"#059669", user:t2.assigned_to?.name||"Someone", action:"completed", target:t2.title, targetSub:proj?`in ${proj.title}`:"", ts:t2.due_date||t2.created_at });
    });
    projects.forEach(p => {
      const ts = p.created_at || p.start_date;
      if (!ts) return;
      evts.push({ id:`pc-${p.id}`, type:"project", icon:"🗂", color:"#7C3AED", user:p.assigned_to?.name||"Team", action:"created project", target:p.title, targetSub:p.stage||"", ts });
      if (p.status === "Completed") evts.push({ id:`pf-${p.id}`, type:"project", icon:"🎉", color:"#7C3AED", user:p.assigned_to?.name||"Team", action:"delivered project", target:p.title, targetSub:"", ts:p.due_date||ts });
    });
    return evts.filter(e => e.ts).sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }, [activityEvents, comments, tasks, projects, taskPipelines]);

  const filteredActivity = useMemo(() => {
    if (actFilter === "all") return activityFeed;
    return activityFeed.filter(e => e.type === actFilter);
  }, [activityFeed, actFilter]);

  const activityPage = filteredActivity.slice(0, actPage * ACT_PAGE_SIZE);
  const hasMore = activityPage.length < filteredActivity.length;

  // ── Teams data ──────────────────────────────────────────────────────────────
  const enrichedUsers = useMemo(() => {
    return users.map(u => {
      const userTasks    = tasks.filter(t2 => t2.assigned_to?.email === u.email);
      const activeTasks  = userTasks.filter(t2 => !isTaskComplete(t2, projectById[t2.project_id], taskPipelines)).length;
      const completedTasks = userTasks.filter(t2 => isTaskComplete(t2, projectById[t2.project_id], taskPipelines)).length;
      const dept = departments.find(d => d.name === u.department || d.id === u.department_id);
      const role = (pendingRoles[u.id] || u.role || "member").toLowerCase();
      return { ...u, role, activeTasks, completedTasks, deptLabel: dept?.name || u.department || "—" };
    });
  }, [users, tasks, departments, pendingRoles, projectById, taskPipelines]);

  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") return enrichedUsers;
    return enrichedUsers.filter(u => u.role === roleFilter);
  }, [enrichedUsers, roleFilter]);

  const automationStats = useMemo(() => {
    const taskById = new Map((tasks || []).map(t2 => [t2.id, t2]));
    const openTasks = (tasks || []).filter(t2 => !isTaskComplete(t2, projectById[t2.project_id], taskPipelines));
    const deadlineWindow = Number(s.deadline_warning_hours || 24);
    const escalationHours = Number(s.overdue_escalation_hours || 24);
    let dueSoon = 0;
    let overdue = 0;
    let escalated = 0;
    let blocked = 0;

    openTasks.forEach(t2 => {
      if (t2.due_date) {
        const diffHours = (new Date(t2.due_date) - Date.now()) / 3600000;
        if (!Number.isNaN(diffHours)) {
          if (diffHours >= 0 && diffHours <= deadlineWindow) dueSoon += 1;
          if (diffHours < 0) overdue += 1;
          if (diffHours < -escalationHours) escalated += 1;
        }
      }
      if ((t2.blocked_by || []).some(depId => {
        const dep = taskById.get(depId);
        return dep && !isTaskComplete(dep, projectById[dep.project_id], taskPipelines);
      })) blocked += 1;
    });

    return { dueSoon, overdue, escalated, blocked, openTasks: openTasks.length };
  }, [tasks, s.deadline_warning_hours, s.overdue_escalation_hours, projectById, taskPipelines]);

  const CURRENCIES = [
    { code:"USD", symbol:"$",  label:"US Dollar" },
    { code:"GBP", symbol:"£",  label:"British Pound" },
    { code:"EUR", symbol:"€",  label:"Euro" },
    { code:"AUD", symbol:"A$", label:"Australian Dollar" },
    { code:"NGN", symbol:"₦",  label:"Nigerian Naira" },
    { code:"CAD", symbol:"C$", label:"Canadian Dollar" },
  ];

  const Row = ({ label, sub, children }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 0", borderBottom:`1px solid ${t.divider}` }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:t.textSub }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );

  const TABS = [
    { id:"branding",      label:"Branding",        icon:"🎨" },
    { id:"preferences",   label:"Preferences",     icon:"⚙️" },
    { id:"pipelines",     label:"Pipelines",       icon:"Workflow" },
    { id:"notifications", label:"Notifications",   icon:"🔔" },
    { id:"automations",   label:"Automations",     icon:"⚡" },
    { id:"activity",      label:"Activity",        icon:"📋" },
    { id:"teams",         label:"Teams & Roles",   icon:"👥" },
    { id:"data",          label:"Data & Security", icon:"🗄️" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>Settings</h1>
        {["branding","preferences","pipelines","notifications","automations"].includes(tab) && (
          <div style={{ display:"flex", gap:10 }}>
            <button style={bs} onClick={reset}>Reset Defaults</button>
            <button style={{ ...btnPrimary, minWidth:120 }} onClick={save}>
              {saved ? "✓ Saved!" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:24, background:t.statBg, borderRadius:12, padding:4, flexWrap:"wrap" }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ ...bs, padding:"8px 16px", fontSize:12, fontWeight:tab===tb.id?700:400, background:tab===tb.id?t.card:"transparent", color:tab===tb.id?t.text:t.textMuted, border:`1px solid ${tab===tb.id?t.border2:"transparent"}`, borderRadius:9, boxShadow:tab===tb.id?"0 1px 4px rgba(0,0,0,0.08)":"none", display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ fontSize:13 }}>{tb.icon}</span>{tb.label}
          </button>
        ))}
      </div>

      {/* ── BRANDING ─────────────────────────────────────────────────────────── */}
      {tab === "branding" && (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:24 }}>
          <div>
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
                      <div style={{ ...iS, flex:1, fontFamily:"monospace", fontWeight:800, fontSize:16, letterSpacing:"0.18em", color:t.accent, background:t.statBg, border:`1px solid ${t.border}`, userSelect:"all" }}>{currentUser.agency_code}</div>
                      <button onClick={copyCode} style={{ ...bs, padding:"0 16px", fontWeight:700, flexShrink:0 }}>{copied?"✓ Copied":"Copy"}</button>
                    </div>
                    <div style={{ fontSize:11, color:t.textFaint, marginTop:6 }}>Share with teammates so they can join your workspace.</div>
                  </>
                ) : <div style={{ fontSize:13, color:t.textFaint }}>No agency connected.</div>}
              </div>
              <FormField label="Tagline"><input style={iS} value={s.tagline} onChange={e=>set("tagline",e.target.value)} placeholder="Your agency's tagline" /></FormField>
            </div>
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
              <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:t.text }}>Brand Colours</h3>
              {[["primary_colour","Primary Colour","Used for active nav, buttons, accents"],["accent_colour","Accent Colour","Used for highlights and AI text"]].map(([key,label,sub])=>(
                <FormField key={key} label={label}>
                  <div style={{ fontSize:11, color:t.textFaint, marginBottom:8 }}>{sub}</div>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <input type="color" style={{ ...iS, padding:4, height:40, width:80, cursor:"pointer" }} value={s[key]} onChange={e=>set(key,e.target.value)} />
                    <input style={iS} value={s[key]} onChange={e=>set(key,e.target.value)} />
                  </div>
                </FormField>
              ))}
            </div>
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
              <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Display</h3>
              <Row label="Dark Sidebar" sub="Apply dark theme to the navigation sidebar only"><Toggle value={s.dark_sidebar} onChange={v=>set("dark_sidebar",v)} accent={s.primary_colour} /></Row>
              <Row label='Hide "Powered by Madre"' sub="Remove attribution from sidebar footer"><Toggle value={s.hide_attribution} onChange={v=>set("hide_attribution",v)} accent={s.primary_colour} /></Row>
            </div>
          </div>
          <div style={{ background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden", alignSelf:"start" }}>
            <div style={{ padding:"12px 16px", background:t.card, borderBottom:`1px solid ${t.border2}` }}>
              <span style={{ fontSize:11, fontWeight:700, color:t.textFaint, letterSpacing:"0.06em", textTransform:"uppercase" }}>Live Preview</span>
            </div>
            <div style={{ display:"flex", height:420 }}>
              <div style={{ width:180, background:s.dark_sidebar?"#0f0f1a":"#F9F9FF", borderRight:`1px solid ${t.border}`, padding:16 }}>
                <div style={{ fontSize:15, fontWeight:800, color:s.primary_colour, marginBottom:2 }}>{currentUser?.agency_name||s.agency_name}</div>
                <div style={{ fontSize:10, color:t.textFaint, marginBottom:20 }}>{s.tagline}</div>
                {["Dashboard","Projects","Tasks","Team","Reports"].map(item=>(
                  <div key={item} style={{ padding:"8px 10px", borderRadius:8, marginBottom:4, fontSize:12, color:item==="Dashboard"?s.primary_colour:s.dark_sidebar?"#aaa":t.textFaint, background:item==="Dashboard"?s.primary_colour+"22":"transparent", fontWeight:item==="Dashboard"?700:400 }}>{item}</div>
                ))}
              </div>
              <div style={{ flex:1, padding:16 }}>
                <div style={{ fontSize:14, fontWeight:800, color:s.primary_colour, marginBottom:10 }}>Dashboard</div>
                <div style={{ height:28, background:s.primary_colour+"22", borderRadius:8, marginBottom:8, display:"flex", alignItems:"center", paddingLeft:10 }}>
                  <span style={{ fontSize:11, color:s.primary_colour, fontWeight:700 }}>Active Projects</span>
                  <span style={{ marginLeft:"auto", marginRight:10, fontSize:16, fontWeight:800, color:s.primary_colour }}>12</span>
                </div>
                <div style={{ height:24, background:t.toggleBg, borderRadius:8, marginBottom:8 }} />
                <div style={{ height:24, background:t.toggleBg, borderRadius:8, marginBottom:16, width:"70%" }} />
                <button style={{ background:s.primary_colour, color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ New Project</button>
                {!s.hide_attribution && <div style={{ fontSize:10, color:t.textGhost, marginTop:36 }}>Powered by Madre</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PREFERENCES ──────────────────────────────────────────────────────── */}
      {tab === "preferences" && (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:24 }}>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Finance</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>Used for budget calculations in Reports.</p>
            <FormField label="Currency">
              <select style={sS} value={s.currency} onChange={e=>set("currency",e.target.value)}>
                {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.symbol} {c.label} ({c.code})</option>)}
              </select>
            </FormField>
            <FormField label="Billing Rate (per hour)">
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ ...iS, width:50, textAlign:"center", color:t.textFaint, fontSize:16, fontWeight:700, flexShrink:0, cursor:"default", background:t.statBg }}>{CURRENCIES.find(c=>c.code===s.currency)?.symbol||"$"}</div>
                <input type="number" min="0" step="5" style={{ ...iS, flex:1 }} value={s.billing_rate} onChange={e=>set("billing_rate",Number(e.target.value))} />
                <span style={{ fontSize:12, color:t.textFaint, flexShrink:0 }}>/ hour</span>
              </div>
            </FormField>
          </div>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Task Defaults</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>Pre-filled values when creating a new task.</p>
            <FormField label="Default Priority">
              <select style={sS} value={s.default_task_priority} onChange={e=>set("default_task_priority",e.target.value)}>
                {["Critical","High","Medium","Low"].map(p=><option key={p}>{p}</option>)}
              </select>
            </FormField>
          </div>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Calendar</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>Controls how dates and weeks are displayed.</p>
            <FormField label="Week Starts On">
              <select style={sS} value={s.week_starts_on} onChange={e=>set("week_starts_on",e.target.value)}>
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </FormField>
          </div>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Workspace Stats</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 12px" }}>Current data overview.</p>
            {[["Projects",projects?.length||0],["Tasks",tasks?.length||0],["Clients",clients?.length||0],["KPIs",kpis?.length||0],["Pitches",pitches?.length||0],["Comments",comments?.length||0]].map(([l,c])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${t.divider}` }}>
                <span style={{ fontSize:13, color:t.textMuted }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:700, color:t.textSub }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS ────────────────────────────────────────────────────── */}
      {tab === "pipelines" && (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1.3fr 0.9fr", gap:24 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {taskPipelines.map(pipeline => (
              <div key={pipeline.id} style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:18 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:12 }}>
                  <div style={{ flex:1 }}>
                    <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:800, color:t.text }}>{pipeline.name}</h3>
                    <p style={{ margin:0, fontSize:12, color:t.textFaint }}>{pipeline.description || "Custom workflow"}</p>
                  </div>
                  {pipeline.builtIn ? (
                    <Badge label="Built in" color={s.primary_colour} />
                  ) : (
                    <button onClick={()=>removePipeline(pipeline.id)} style={{ ...bs, padding:"5px 10px", fontSize:11, color:"#EF4444", borderColor:"#EF444466" }}>Remove</button>
                  )}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {pipeline.statuses.map(status => (
                    <span key={status.id} style={{ fontSize:11, fontWeight:700, color:status.color, border:`1px solid ${status.color}44`, background:`${status.color}12`, borderRadius:99, padding:"4px 9px" }}>
                      {status.label}{status.isComplete ? " complete" : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, alignSelf:"start" }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:800, color:t.text }}>Add Custom Pipeline</h3>
            <p style={{ margin:"0 0 16px", fontSize:12, color:t.textFaint }}>The final stage is treated as delivered for the project board.</p>
            <FormField label="Name"><input style={iS} value={pipelineDraft.name} onChange={e=>setPipelineDraft({...pipelineDraft,name:e.target.value})} placeholder="e.g. Event Production" /></FormField>
            <FormField label="Description"><input style={iS} value={pipelineDraft.description} onChange={e=>setPipelineDraft({...pipelineDraft,description:e.target.value})} placeholder="Short workflow purpose" /></FormField>
            <FormField label="Project Stages">
              <textarea style={{ ...iS, height:120, resize:"vertical" }} value={pipelineDraft.statuses} onChange={e=>setPipelineDraft({...pipelineDraft,statuses:e.target.value})} placeholder="One stage per line" />
            </FormField>
            <button style={{ ...btnPrimary, width:"100%", opacity:pipelineDraft.name.trim()?1:0.6 }} disabled={!pipelineDraft.name.trim()} onClick={addPipeline}>Add Pipeline</button>
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <div style={{ maxWidth:600 }}>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>In-App Notifications</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 4px" }}>Choose what appears in the notification bell.</p>
            <Row label="Task Deadline Reminders" sub="Show alerts when tasks are overdue or due soon"><Toggle value={s.notify_deadlines} onChange={v=>set("notify_deadlines",v)} accent={s.primary_colour} /></Row>
            <Row label="@ Mentions" sub="Notify when someone tags you in a comment"><Toggle value={s.notify_mentions} onChange={v=>set("notify_mentions",v)} accent={s.primary_colour} /></Row>
            <Row label="Project Comments" sub="Show new comments added to your projects"><Toggle value={s.notify_comments} onChange={v=>set("notify_comments",v)} accent={s.primary_colour} /></Row>
          </div>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Deadline Warning Window</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>How far in advance to flag an upcoming deadline.</p>
            <div style={{ display:"flex", gap:10 }}>
              {[["12","12 hours"],["24","24 hours"],["48","48 hours"],["72","3 days"]].map(([val,label])=>(
                <button key={val} onClick={()=>set("deadline_warning_hours",Number(val))} style={{ ...bs, padding:"8px 16px", fontSize:13, fontWeight:700, background:s.deadline_warning_hours===Number(val)?s.primary_colour+"22":t.toggleBg, color:s.deadline_warning_hours===Number(val)?s.primary_colour:t.textMuted, border:`1px solid ${s.deadline_warning_hours===Number(val)?s.primary_colour+"88":t.border}` }}>{label}</button>
              ))}
            </div>
            <div style={{ fontSize:11, color:t.textFaint, marginTop:10 }}>Tasks due within <strong style={{ color:t.textSub }}>{s.deadline_warning_hours} hours</strong> will show in the notification bell.</div>
          </div>
          <div style={{ marginTop:20, display:"flex", gap:10 }}>
            <button style={{ ...btnPrimary, minWidth:130 }} onClick={save}>{saved?"✓ Saved!":"Save Changes"}</button>
            <button style={bs} onClick={reset}>Reset Defaults</button>
          </div>
        </div>
      )}

      {/* Automations */}
      {tab === "automations" && (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 300px", gap:24, alignItems:"start" }}>
          <div>
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
              <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Operational Rules</h3>
              <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 4px" }}>Run lightweight workspace automations in the browser and activity feed.</p>
              <Row label="Enable Automations" sub="Allow Madre to monitor open tasks and log operational events"><Toggle value={s.automation_enabled} onChange={v=>set("automation_enabled",v)} accent={s.primary_colour} /></Row>
              <Row label="Deadline Warnings" sub="Log an activity event when an open task enters the warning window"><Toggle value={s.automation_deadline_warnings} onChange={v=>set("automation_deadline_warnings",v)} accent={s.primary_colour} /></Row>
              <Row label="Overdue Escalation" sub="Escalate tasks that remain overdue past the threshold below"><Toggle value={s.automation_overdue_escalation} onChange={v=>set("automation_overdue_escalation",v)} accent={s.primary_colour} /></Row>
              <Row label="Blocked Task Alerts" sub="Flag tasks waiting on unfinished dependencies"><Toggle value={s.automation_blocked_alerts} onChange={v=>set("automation_blocked_alerts",v)} accent={s.primary_colour} /></Row>
              <Row label="Toast Alerts" sub="Show immediate pop-up alerts when automations run"><Toggle value={s.automation_toasts} onChange={v=>set("automation_toasts",v)} accent={s.primary_colour} /></Row>
            </div>
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
              <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Outbound Channels</h3>
              <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 4px" }}>Send assignment and automation alerts outside the app when provider environment variables are configured.</p>
              <Row label="Assignment Emails" sub="Email users when a new assigned task or project is created"><Toggle value={s.assignment_email_alerts} onChange={v=>set("assignment_email_alerts",v)} accent={s.primary_colour} /></Row>
              <Row label="Email Alerts" sub="Send through Resend to task assignees and configured fallback recipients"><Toggle value={s.automation_email} onChange={v=>set("automation_email",v)} accent={s.primary_colour} /></Row>
              <Row label="WhatsApp Alerts" sub="Send through Meta WhatsApp Cloud API to configured recipients"><Toggle value={s.automation_whatsapp} onChange={v=>set("automation_whatsapp",v)} accent={s.primary_colour} /></Row>
            </div>
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
              <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Escalation Threshold</h3>
              <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>How long a task can remain overdue before automation escalates it.</p>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {[["6","6 hours"],["12","12 hours"],["24","24 hours"],["48","2 days"]].map(([val,label])=>(
                  <button key={val} onClick={()=>set("overdue_escalation_hours",Number(val))} style={{ ...bs, padding:"8px 16px", fontSize:13, fontWeight:700, background:s.overdue_escalation_hours===Number(val)?s.primary_colour+"22":t.toggleBg, color:s.overdue_escalation_hours===Number(val)?s.primary_colour:t.textMuted, border:`1px solid ${s.overdue_escalation_hours===Number(val)?s.primary_colour+"88":t.border}` }}>{label}</button>
                ))}
              </div>
              <div style={{ fontSize:11, color:t.textFaint, marginTop:10 }}>Escalations run once per task per day and appear in Activity.</div>
            </div>
            <div style={{ marginTop:20, display:"flex", gap:10 }}>
              <button style={{ ...btnPrimary, minWidth:130 }} onClick={save}>{saved?"✓ Saved!":"Save Changes"}</button>
              <button style={bs} onClick={reset}>Reset Defaults</button>
            </div>
          </div>

          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700, color:t.text }}>Automation Watchlist</h3>
            {[
              ["Open Tasks", automationStats.openTasks, t.accent],
              ["Due Soon", automationStats.dueSoon, "#3B82F6"],
              ["Overdue", automationStats.overdue, "#EF4444"],
              ["Escalated", automationStats.escalated, "#B91C1C"],
              ["Blocked", automationStats.blocked, "#F59E0B"],
            ].map(([label, value, color]) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${t.divider}` }}>
                <span style={{ fontSize:13, color:t.textMuted }}>{label}</span>
                <span style={{ minWidth:30, textAlign:"center", fontSize:13, fontWeight:800, color, background:color+"18", borderRadius:6, padding:"3px 8px" }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop:14, padding:"12px 14px", background:s.automation_enabled?t.accent+"12":t.statBg, borderRadius:10, border:`1px solid ${s.automation_enabled?t.accent+"33":t.border}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:s.automation_enabled?t.accent:t.textMuted }}>{s.automation_enabled ? "Automation is active" : "Automation is paused"}</div>
              <div style={{ fontSize:11, color:t.textFaint, marginTop:3, lineHeight:1.5 }}>Rules run while a workspace member has the app open.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVITY ─────────────────────────────────────────────────────────── */}
      {tab === "activity" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ display:"flex", gap:6 }}>
              {[["all","All"],["project","Projects"],["task","Tasks"],["comment","Comments"]].map(([val,label])=>(
                <button key={val} onClick={()=>{ setActFilter(val); setActPage(1); }} style={{ ...bs, padding:"6px 14px", fontSize:12, fontWeight:700, background:actFilter===val?t.accent+"22":t.toggleBg, color:actFilter===val?t.accent:t.textMuted, border:`1px solid ${actFilter===val?t.accent+"88":t.border}` }}>{label}</button>
              ))}
            </div>
            <span style={{ fontSize:12, color:t.textFaint }}>{filteredActivity.length} events</span>
          </div>

          {filteredActivity.length === 0 ? (
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:60, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:15, fontWeight:700, color:t.text, marginBottom:6 }}>No activity yet</div>
              <div style={{ fontSize:13, color:t.textMuted }}>Activity will appear here as your team creates projects, tasks and comments.</div>
            </div>
          ) : (
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden" }}>
              <div style={{ overflowX:"auto" }}>
              {/* Column header */}
              <div style={{ display:"grid", gridTemplateColumns:"36px 1fr 140px 120px", gap:0, padding:"10px 20px", background:t.statBg, borderBottom:`1px solid ${t.border2}`, minWidth:420 }}>
                {["","Activity","Entity","When"].map((h,i) => (
                  <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textGhost, letterSpacing:"0.07em", textTransform:"uppercase" }}>{h}</div>
                ))}
              </div>

              {activityPage.map((ev, i) => (
                <div key={ev.id} style={{ display:"grid", gridTemplateColumns:"36px 1fr 140px 120px", gap:0, padding:"12px 20px", borderBottom:`1px solid ${t.divider}`, alignItems:"center", background:i%2===0?"transparent":t.statBg+"44", minWidth:420 }}>
                  {/* Icon */}
                  <div style={{ width:28, height:28, borderRadius:"50%", background:ev.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>{ev.icon}</div>
                  {/* Description */}
                  <div>
                    <div style={{ fontSize:13, color:t.textSub }}>
                      <span style={{ fontWeight:700, color:t.text }}>{ev.user}</span>
                      {" "}{ev.action}{" "}
                      <span style={{ fontWeight:600, color:ev.color }}>{ev.target}</span>
                    </div>
                    {ev.targetSub && <div style={{ fontSize:11, color:t.textFaint, marginTop:1 }}>{ev.targetSub}</div>}
                  </div>
                  {/* Type badge */}
                  <div>
                    <span style={{ fontSize:10, fontWeight:700, color:ev.color, background:ev.color+"18", borderRadius:4, padding:"2px 7px", textTransform:"capitalize" }}>
                      {ev.type}
                    </span>
                  </div>
                  {/* Timestamp */}
                  <div style={{ fontSize:11, color:t.textFaint }}>{timeAgo(ev.ts)}</div>
                </div>
              ))}

              </div>{/* end overflowX scroll */}
              {hasMore && (
                <div style={{ padding:"14px 20px", textAlign:"center", borderTop:`1px solid ${t.divider}` }}>
                  <button onClick={() => setActPage(p => p+1)} style={{ ...bs, padding:"8px 24px", fontSize:12 }}>
                    Load more ({filteredActivity.length - activityPage.length} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TEAMS & ROLES ────────────────────────────────────────────────────── */}
      {tab === "teams" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 380px", gap:24, alignItems:"start" }}>
            {/* Left: member roster */}
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {[["all","All members"],["owner","Owners"],["admin","Admins"],["manager","Managers"],["member","Members"],["viewer","Viewers"]].map(([val,label])=>(
                    <button key={val} onClick={()=>setRoleFilter(val)} style={{ ...bs, padding:"5px 12px", fontSize:11, fontWeight:700, background:roleFilter===val?t.accent+"22":t.toggleBg, color:roleFilter===val?t.accent:t.textMuted, border:`1px solid ${roleFilter===val?t.accent+"88":t.border}` }}>{label}</button>
                  ))}
                </div>
                <span style={{ fontSize:12, color:t.textFaint, flexShrink:0 }}>{filteredUsers.length} member{filteredUsers.length!==1?"s":""}</span>
              </div>

              {filteredUsers.length === 0 ? (
                <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:40, textAlign:"center" }}>
                  <div style={{ fontSize:13, color:t.textFaint }}>No members with this role.</div>
                </div>
              ) : (
                <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden" }}>
                  {!isMobile && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 90px 70px 70px", padding:"10px 20px", background:t.statBg, borderBottom:`1px solid ${t.border2}` }}>
                      {["Member","Role","Department","Active","Done"].map(h => (
                        <div key={h} style={{ fontSize:10, fontWeight:700, color:t.textGhost, letterSpacing:"0.07em", textTransform:"uppercase" }}>{h}</div>
                      ))}
                    </div>
                  )}

                  {filteredUsers.map(u => {
                    const rm = ROLE_META[u.role] || ROLE_META.member;
                    const isMe = u.email === currentUser?.email;
                    if (isMobile) {
                      return (
                        <div key={u.id} style={{ padding:"14px 16px", borderBottom:`1px solid ${t.divider}`, background:isMe?t.accent+"07":"transparent" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                            <Avatar name={u.name} size={36} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:t.text, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                                {u.name}
                                {isMe && <span style={{ fontSize:9, color:t.accent, background:t.accent+"18", borderRadius:4, padding:"1px 5px", fontWeight:800 }}>YOU</span>}
                              </div>
                              <div style={{ fontSize:11, color:t.textFaint, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</div>
                              {u.job_title && <div style={{ fontSize:10, color:t.textGhost }}>{u.job_title}</div>}
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                            {editingRole === u.id ? (
                              <select
                                autoFocus
                                style={{ ...sS, fontSize:11, padding:"4px 6px" }}
                                value={pendingRoles[u.id] || u.role || "member"}
                                onChange={e => setPendingRoles(p => ({ ...p, [u.id]: e.target.value }))}
                                onBlur={async () => {
                                  const newRole = pendingRoles[u.id];
                                  const originalRole = (users.find(x => x.id === u.id)?.role || "member").toLowerCase();
                                  if (newRole && newRole !== originalRole) {
                                    const saved = await updateMemberRole(u.id, newRole);
                                    if (!saved) {
                                      setPendingRoles(p => { const next = { ...p }; delete next[u.id]; return next; });
                                    }
                                  }
                                  setEditingRole(null);
                                }}
                              >
                                {Object.keys(ROLE_META).map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                              </select>
                            ) : (
                              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                                <span style={{ fontSize:11, fontWeight:700, color:rm.color, background:rm.color+"18", borderRadius:5, padding:"2px 8px" }}>{rm.label}</span>
                                {!isMe && canManageRoles && (
                                  <button onClick={() => setEditingRole(u.id)} style={{ background:"none", border:"none", cursor:"pointer", color:t.textGhost, fontSize:13, padding:0, lineHeight:1 }} title="Edit role">✏</button>
                                )}
                              </div>
                            )}
                            {u.deptLabel && <span style={{ fontSize:11, color:t.textMuted, background:t.statBg, borderRadius:5, padding:"2px 8px", border:`1px solid ${t.border}` }}>{u.deptLabel}</span>}
                            <span style={{ fontSize:11, color:t.textFaint }}><span style={{ fontWeight:700, color:u.activeTasks>0?t.accent:t.textFaint }}>{u.activeTasks}</span> active</span>
                            <span style={{ fontSize:11, color:t.textFaint }}><span style={{ fontWeight:700, color:u.completedTasks>0?"#059669":t.textFaint }}>{u.completedTasks}</span> done</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={u.id} style={{ display:"grid", gridTemplateColumns:"1fr 100px 90px 70px 70px", padding:"13px 20px", borderBottom:`1px solid ${t.divider}`, alignItems:"center", background:isMe?t.accent+"07":"transparent" }}>
                        {/* Name / email */}
                        <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                          <Avatar name={u.name} size={32} />
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:t.text, display:"flex", alignItems:"center", gap:6 }}>
                              {u.name}
                              {isMe && <span style={{ fontSize:9, color:t.accent, background:t.accent+"18", borderRadius:4, padding:"1px 5px", fontWeight:800 }}>YOU</span>}
                            </div>
                            <div style={{ fontSize:11, color:t.textFaint, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</div>
                            {u.job_title && <div style={{ fontSize:10, color:t.textGhost }}>{u.job_title}</div>}
                          </div>
                        </div>
                        {/* Role */}
                        <div>
                          {editingRole === u.id ? (
                            <select
                              autoFocus
                              style={{ ...sS, fontSize:11, padding:"4px 6px" }}
                              value={pendingRoles[u.id] || u.role || "member"}
                              onChange={e => setPendingRoles(p => ({ ...p, [u.id]: e.target.value }))}
                              onBlur={async () => {
                                const newRole = pendingRoles[u.id];
                                const originalRole = (users.find(x => x.id === u.id)?.role || "member").toLowerCase();
                                if (newRole && newRole !== originalRole) {
                                  const saved = await updateMemberRole(u.id, newRole);
                                  if (!saved) {
                                    setPendingRoles(p => {
                                      const next = { ...p };
                                      delete next[u.id];
                                      return next;
                                    });
                                  }
                                }
                                setEditingRole(null);
                              }}
                            >
                              {Object.keys(ROLE_META).map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                            </select>
                          ) : (
                            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                              <span style={{ fontSize:11, fontWeight:700, color:rm.color, background:rm.color+"18", borderRadius:5, padding:"2px 8px" }}>{rm.label}</span>
                              {!isMe && canManageRoles && (
                                <button onClick={() => setEditingRole(u.id)} style={{ background:"none", border:"none", cursor:"pointer", color:t.textGhost, fontSize:13, padding:0, lineHeight:1 }} title="Edit role">✏</button>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Dept */}
                        <div style={{ fontSize:12, color:t.textMuted }}>{u.deptLabel}</div>
                        {/* Tasks active */}
                        <div style={{ fontSize:13, fontWeight:600, color:u.activeTasks>0?t.accent:t.textFaint }}>{u.activeTasks}</div>
                        {/* Tasks done */}
                        <div style={{ fontSize:13, fontWeight:600, color:u.completedTasks>0?"#059669":t.textFaint }}>{u.completedTasks}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Invite */}
              <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginTop:20 }}>
                <h3 style={{ margin:"0 0 8px", fontSize:14, fontWeight:700, color:t.text }}>Invite a Team Member</h3>
                <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 14px" }}>Share your workspace invite code. Once they sign up using this code, they'll be added to your workspace automatically.</p>
                <div style={{ display:"flex", gap:10 }}>
                  <div style={{ ...iS, flex:1, fontFamily:"monospace", fontWeight:800, fontSize:18, letterSpacing:"0.2em", color:t.accent, background:t.statBg, border:`1px solid ${t.border}`, userSelect:"all", textAlign:"center" }}>
                    {currentUser?.agency_code || "—"}
                  </div>
                  <button onClick={copyCode} style={{ ...btnPrimary, padding:"0 20px", flexShrink:0, fontWeight:700 }}>{copied?"✓ Copied!":"Copy Code"}</button>
                </div>
              </div>
            </div>

            {/* Right: role definitions + permissions matrix */}
            <div>
              <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
                <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:t.text }}>Role Definitions</h3>
                {Object.entries(ROLE_META).map(([key, rm]) => (
                  <div key={key} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:12, padding:"10px 12px", background:t.statBg, borderRadius:9, border:`1px solid ${rm.color}22` }}>
                    <span style={{ fontSize:12, fontWeight:800, color:rm.color, background:rm.color+"18", borderRadius:5, padding:"3px 9px", flexShrink:0, marginTop:1 }}>{rm.label}</span>
                    <span style={{ fontSize:12, color:t.textMuted, lineHeight:1.5 }}>{rm.desc}</span>
                  </div>
                ))}
              </div>

              <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
                <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:t.text }}>Permissions Matrix</h3>
                {/* Header row */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(5,32px)", gap:4, marginBottom:6 }}>
                  <div />
                  {Object.entries(ROLE_META).map(([key, rm]) => (
                    <div key={key} title={rm.label} style={{ fontSize:9, fontWeight:800, color:rm.color, textAlign:"center", letterSpacing:"0.04em", lineHeight:1.3 }}>
                      {rm.label.slice(0,3).toUpperCase()}
                    </div>
                  ))}
                </div>
                {PERMISSIONS.map((perm, i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr repeat(5,32px)", gap:4, padding:"5px 0", borderBottom:`1px solid ${t.divider}44`, alignItems:"center" }}>
                    <div style={{ fontSize:11, color:t.textSub }}>{perm.label}</div>
                    {["owner","admin","manager","member","viewer"].map(role => (
                      <div key={role} style={{ textAlign:"center", fontSize:13 }}>
                        {perm[role]
                          ? <span style={{ color:"#059669" }}>✓</span>
                          : <span style={{ color:t.border2 }}>—</span>
                        }
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DATA & SECURITY ───────────────────────────────────────────────────── */}
      {tab === "data" && (
        <div style={{ maxWidth:600 }}>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Export Data</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>Download a full JSON backup of your workspace including projects, tasks, clients, KPIs, pitches and comments.</p>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <button
                onClick={exportData}
                disabled={!canResetData}
                title={canResetData ? "Download JSON export" : "Only workspace owners can export all data"}
                style={{ ...btnPrimary, padding:"9px 20px", opacity:canResetData?1:0.5, cursor:canResetData?"pointer":"not-allowed" }}
              >⬇ Download JSON Export</button>
              <span style={{ fontSize:11, color:t.textFaint }}>{(projects?.length||0)+(tasks?.length||0)+(clients?.length||0)} records total</span>
            </div>
          </div>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Clear Dismissed Notifications</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 16px" }}>All dismissed notifications will reappear in the bell.</p>
            <button onClick={()=>{ localStorage.removeItem("af_dismissed"); setSaved(true); setTimeout(()=>setSaved(false),2000); }} style={{ ...bs, padding:"9px 20px" }}>
              {saved?"✓ Done":"🔔 Restore Dismissed Notifications"}
            </button>
          </div>
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:16 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Storage</h3>
            <p style={{ fontSize:12, color:t.textFaint, margin:"0 0 12px" }}>App data is synced to your Supabase workspace. Settings and preferences are stored locally in your browser.</p>
            {[["Sync mode",currentUser?.agency_id?"Supabase cloud":"Local browser"],["Workspace ID",currentUser?.agency_id||"Demo mode"],["Settings storage","Browser localStorage"]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${t.divider}` }}>
                <span style={{ fontSize:12, color:t.textMuted }}>{l}</span>
                <span style={{ fontSize:12, fontWeight:600, color:t.textSub, fontFamily:"monospace" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background:"#EF444408", border:"1px solid #EF444433", borderRadius:14, padding:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#EF4444", marginBottom:6 }}>⚠ Danger Zone</div>
            <p style={{ fontSize:12, color:t.textMuted, margin:"0 0 14px" }}>Wipe all projects, tasks, clients, KPIs, departments and pitches and restore factory demo data. <strong>This cannot be undone.</strong></p>
            <button
              onClick={()=>{ if(canResetData && window.confirm("Reset ALL app data to factory defaults? This cannot be undone.")) resetAllData(); }}
              disabled={!canResetData}
              title={canResetData ? "Reset all app data" : "Only workspace owners can reset all data"}
              style={{ background:"#EF4444", color:"#fff", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:700, cursor:canResetData?"pointer":"not-allowed", opacity:canResetData?1:0.5 }}
            >Reset All App Data</button>
          </div>
        </div>
      )}
    </div>
  );
});
