import {
  React,
  useMemo,
  useState,
  useApp,
  useTheme,
  callClaude,
  stageColor,
  statusColor,
  AIBlock,
  FormField,
  Modal,
  ProgressBar,
  StatCard,
  btnPrimary,
  mkBtnSecondary,
  mkInputStyle,
  mkSelectStyle
} from "./_shared.js";

// ─── SVG CHARTS ───────────────────────────────────────────────────────────────
function BurndownChart({ data, t }) {
  if (!data?.length) return (
    <div style={{ color:t.textFaint, fontSize:12, textAlign:"center", padding:"32px 0" }}>
      No tasks with due dates for this project.
    </div>
  );
  const W = 480, H = 160, PL = 24, PR = 10, PT = 10, PB = 28;
  const cW = W - PL - PR, cH = H - PT - PB;
  const maxVal = Math.max(...data.map(d => d.done + d.active + d.todo), 1);
  const bW = (cW / data.length) * 0.65;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:H }}>
      {[0, 0.5, 1].map(f => (
        <line key={f} x1={PL} y1={PT + cH - f * cH} x2={W - PR} y2={PT + cH - f * cH}
          stroke={t.divider} strokeWidth="0.5" strokeDasharray="3 3" />
      ))}
      {data.map((d, i) => {
        const total = d.done + d.active + d.todo;
        const scale = (total / maxVal) * cH;
        const dH = (d.done / Math.max(total, 1)) * scale;
        const aH = (d.active / Math.max(total, 1)) * scale;
        const tdH = (d.todo / Math.max(total, 1)) * scale;
        const x = PL + (i + 0.5) * (cW / data.length) - bW / 2;
        const base = PT + cH;
        return (
          <g key={i}>
            <rect x={x} y={base - dH} width={bW} height={dH} fill="#059669" rx="1" />
            <rect x={x} y={base - dH - aH} width={bW} height={aH} fill="#F59E0B" rx="1" />
            <rect x={x} y={base - dH - aH - tdH} width={bW} height={tdH} fill={t.border2} rx="1" />
            {data.length <= 12 && (
              <text x={x + bW / 2} y={H - 6} textAnchor="middle" fontSize="8" fill={t.textGhost}>{d.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function HBarChart({ items, t }) {
  if (!items?.length) return (
    <div style={{ color:t.textFaint, fontSize:12, padding:"24px 0" }}>No active assignments in this period.</div>
  );
  const maxVal = Math.max(...items.map(d => d.max || d.value), 1);
  return (
    <div>
      {items.map((d, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9 }}>
          <div style={{ width:80, fontSize:12, color:t.textMuted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.label}</div>
          <div style={{ flex:1, background:t.statBg, borderRadius:99, height:8, overflow:"hidden" }}>
            <div style={{ width:`${(d.value / maxVal) * 100}%`, background:d.color || "#7C3AED", height:"100%", borderRadius:99, transition:"width 0.4s" }} />
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:d.color || t.text, width:40, textAlign:"right" }}>{d.display}</div>
        </div>
      ))}
    </div>
  );
}

// ─── REPORTS PAGE ─────────────────────────────────────────────────────────────
export const Reports = React.memo(function Reports() {
  const { projects, tasks, kpis, clients, users, whiteLabelSettings } = useApp();
  const { theme: t } = useTheme();
  const RATE = whiteLabelSettings?.billing_rate || 150;
  const CURRENCY_SYMBOL = { USD:"$", GBP:"£", EUR:"€", AUD:"A$", NGN:"₦", CAD:"C$" }[whiteLabelSettings?.currency] || "$";
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);

  // ── Date range filter ────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [activePreset, setActivePreset] = useState("This Month");

  const setPreset = (label) => {
    const now = new Date();
    setActivePreset(label);
    if (label === "This Month") {
      setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
      setDateTo(now.toISOString().split("T")[0]);
    } else if (label === "Last 30 Days") {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      setDateFrom(d.toISOString().split("T")[0]);
      setDateTo(now.toISOString().split("T")[0]);
    } else if (label === "This Quarter") {
      const q = Math.floor(now.getMonth() / 3);
      setDateFrom(new Date(now.getFullYear(), q * 3, 1).toISOString().split("T")[0]);
      setDateTo(now.toISOString().split("T")[0]);
    } else if (label === "This Year") {
      setDateFrom(new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]);
      setDateTo(now.toISOString().split("T")[0]);
    } else {
      setDateFrom(""); setDateTo("");
    }
  };

  const inRange = (d) => {
    if (!d) return true;
    const dt = new Date(d);
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo   ? new Date(dateTo + "T23:59:59") : null;
    return (!from || dt >= from) && (!to || dt <= to);
  };

  // ── Filtered collections ─────────────────────────────────────────────────
  const filteredTasks    = useMemo(() => tasks.filter(t2 => inRange(t2.due_date || t2.created_at)),    [tasks, dateFrom, dateTo]);
  const filteredProjects = useMemo(() => projects.filter(p  => inRange(p.due_date  || p.created_at)), [projects, dateFrom, dateTo]);

  // ── Summary stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    const done     = filteredTasks.filter(t2 => t2.status === "Done").length;
    const overdue  = filteredTasks.filter(t2 => t2.status !== "Done" && t2.due_date && new Date(t2.due_date) < now).length;
    const totalEst = Math.round(filteredTasks.reduce((s, t2) => s + (t2.estimated_hours || 0), 0));
    const totalAct = Math.round(filteredTasks.reduce((s, t2) => s + (t2.actual_hours    || 0), 0));
    const pct      = filteredTasks.length ? Math.round((done / filteredTasks.length) * 100) : 0;
    return { active: filteredProjects.filter(p => p.status === "Active").length, done, overdue, totalEst, totalAct, pct };
  }, [filteredTasks, filteredProjects]);

  // ── Team utilisation ─────────────────────────────────────────────────────
  const teamLoad = useMemo(() => {
    return users.map(u => {
      const uTasks = filteredTasks.filter(t2 => t2.assigned_to?.email === u.email && t2.status !== "Done");
      const hours = Math.round(uTasks.reduce((s, t2) => s + (t2.estimated_hours || 0), 0));
      const pct   = Math.min(100, Math.round((hours / 40) * 100));
      const color = pct < 70 ? "#059669" : pct < 90 ? "#F59E0B" : "#EF4444";
      return { label: u.name, value: hours, max: 40, color, display: `${hours}h`, pct };
    }).filter(u => u.value > 0).sort((a, b) => b.value - a.value);
  }, [users, filteredTasks]);

  // ── Budget tracking ──────────────────────────────────────────────────────
  const budgetData = useMemo(() => {
    return filteredProjects.map(p => {
      const pt      = tasks.filter(t2 => t2.project_id === p.id);
      const planned = pt.reduce((s, t2) => s + (t2.estimated_hours || 0), 0) * RATE;
      const actual  = pt.reduce((s, t2) => s + (t2.actual_hours    || 0), 0) * RATE;
      const used    = planned > 0 ? Math.min(150, Math.round((actual / planned) * 100)) : 0;
      return { id:p.id, title:p.title, client:clients.find(c=>c.id===p.client_id)?.name||"—", planned, actual, variance:planned-actual, used };
    }).filter(p => p.planned > 0 || p.actual > 0).sort((a, b) => b.planned - a.planned);
  }, [filteredProjects, tasks, clients]);

  // ── Task distribution by week (burndown proxy) ───────────────────────────
  const [burnProject, setBurnProject] = useState("");
  const burndownData = useMemo(() => {
    if (!burnProject) return [];
    const pt = tasks.filter(t2 => t2.project_id === burnProject && t2.due_date);
    if (!pt.length) return [];
    const weeks = {};
    pt.forEach(t2 => {
      const d = new Date(t2.due_date);
      d.setDate(d.getDate() - d.getDay());
      const key   = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en", { month:"short", day:"numeric" });
      if (!weeks[key]) weeks[key] = { label, done:0, active:0, todo:0 };
      if (t2.status === "Done") weeks[key].done++;
      else if (["In Progress","In Review"].includes(t2.status)) weeks[key].active++;
      else weeks[key].todo++;
    });
    return Object.entries(weeks).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [burnProject, tasks]);

  // ── AI Client Report ─────────────────────────────────────────────────────
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportClient, setReportClient]       = useState("");
  const [reportType, setReportType]           = useState("Monthly");
  const [report, setReport]                   = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [reportError, setReportError]         = useState(null);

  const genReport = async () => {
    setLoading(true); setReport(null); setReportError(null);
    try {
      const cl       = clients.find(c => c.id === reportClient);
      const cProjs   = projects.filter(p => p.client_id === reportClient);
      const cKPIs    = kpis.filter(k => cProjs.map(p => p.id).includes(k.project_id));
      const result   = await callClaude(
        `Generate a professional ${reportType} client report for ${cl?.name}.\n\nProjects: ${cProjs.map(p=>`${p.title} (${p.stage}, ${p.progress||0}% complete)`).join("; ")}\nKPIs: ${cKPIs.map(k=>`${k.name}: ${k.current_value}${k.unit} vs ${k.target_value}${k.unit} target (${k.status})`).join("; ")}\n\nInclude: Executive Summary, Project Highlights, KPI Performance, Key Wins, Areas of Focus, Strategic Recommendations.`,
        "You are a senior account director writing a client report. Be strategic, data-driven, and professional."
      );
      setReport(result);
    } catch (err) { setReportError(err.message); }
    finally { setLoading(false); }
  };

  const exportPDF = () => {
    const cl  = clients.find(c => c.id === reportClient);
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>${cl?.name||"Client"} Report</title>
    <style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;color:#111;line-height:1.7}
    h1{font-size:24px;margin-bottom:4px}.meta{color:#666;font-size:13px;margin-bottom:32px;border-bottom:1px solid #ddd;padding-bottom:12px}
    pre{white-space:pre-wrap;font-family:inherit;font-size:14px}@media print{body{margin:0}}</style>
    </head><body>
    <h1>${cl?.name||"Client"} · ${reportType} Report</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString("en",{dateStyle:"long"})} · Powered by Madre</div>
    <pre>${report||""}</pre></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const PRESETS  = ["This Month","Last 30 Days","This Quarter","This Year","All Time"];
  const stages   = ["Brief","Strategy","Creative","Review","Delivered"];
  const kpiStats = ["On Track","At Risk","Behind","Achieved","Not Started"];

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>Reports & Analytics</h1>
        <button style={btnPrimary} onClick={()=>setShowReportModal(true)}>Generate Report ✨</button>
      </div>

      {/* Date range filter */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:12, padding:"12px 16px", marginBottom:20, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <span style={{ fontSize:11, fontWeight:700, color:t.textGhost, letterSpacing:"0.07em" }}>DATE RANGE</span>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {PRESETS.map(p => (
            <button key={p} onClick={()=>setPreset(p)} style={{ ...bs, padding:"5px 11px", fontSize:11, background:activePreset===p?t.navActive:"transparent", color:activePreset===p?t.navActiveText:t.textMuted, border:`1px solid ${activePreset===p?t.accent:t.border2}` }}>{p}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:"auto" }}>
          <input type="date" style={{...iS, padding:"5px 10px", fontSize:12}} value={dateFrom} onChange={e=>{setDateFrom(e.target.value); setActivePreset("");}} />
          <span style={{ color:t.textFaint, fontSize:12 }}>→</span>
          <input type="date" style={{...iS, padding:"5px 10px", fontSize:12}} value={dateTo} onChange={e=>{setDateTo(e.target.value); setActivePreset("");}} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:24 }}>
        <StatCard icon="🚀" label="Active Projects"  value={stats.active} />
        <StatCard icon="✅" label="Tasks Completed"  value={stats.done} />
        <StatCard icon="⚠️" label="Overdue Tasks"    value={stats.overdue} />
        <StatCard icon="⏱"  label="Hours Estimated"  value={`${stats.totalEst}h`} />
        <StatCard icon="📊" label="Completion Rate"  value={`${stats.pct}%`} />
      </div>

      {/* Burndown + Team load */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div>
              <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:t.text }}>Task Distribution by Week</h3>
              <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>Stacked by status per due-date week</div>
            </div>
            <select style={{...sS, padding:"4px 8px", fontSize:11, width:"auto"}} value={burnProject} onChange={e=>setBurnProject(e.target.value)}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          {burnProject
            ? <BurndownChart data={burndownData} t={t} />
            : <div style={{ color:t.textFaint, fontSize:12, textAlign:"center", padding:"32px 0" }}>Select a project to see weekly task distribution.</div>
          }
          {burndownData.length > 0 && (
            <div style={{ display:"flex", gap:14, marginTop:10, justifyContent:"center" }}>
              {[["#059669","Done"],["#F59E0B","Active"],[t.border2,"To Do"]].map(([c,l]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:c }} />
                  <span style={{ fontSize:11, color:t.textFaint }}>{l}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
          <h3 style={{ margin:"0 0 4px", fontSize:14, fontWeight:700, color:t.text }}>Team Utilisation</h3>
          <div style={{ fontSize:11, color:t.textFaint, marginBottom:14 }}>Committed hours vs 40h baseline</div>
          <HBarChart items={teamLoad} t={t} />
          <div style={{ display:"flex", gap:14, marginTop:14 }}>
            {[["#059669","< 70%  "],["#F59E0B","70–90%"],["#EF4444","≥ 90%"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:c }} />
                <span style={{ fontSize:10, color:t.textFaint }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Budget tracking */}
      {budgetData.length > 0 && (
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden", marginBottom:20 }}>
          <div style={{ padding:"14px 20px", borderBottom:`1px solid ${t.border2}` }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:t.text }}>Budget Tracking · Planned vs Actual</h3>
            <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>Based on estimated & actual hours at {CURRENCY_SYMBOL}{RATE}/h · adjust in Settings → Preferences</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px 100px 90px", padding:"8px 20px", borderBottom:`1px solid ${t.border2}`, background:t.statBg }}>
            {["Project","Planned","Actual","Variance","Used %"].map((h,i) => (
              <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textFaint, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</div>
            ))}
          </div>
          {budgetData.map(p => (
            <div key={p.id} style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px 100px 90px", padding:"12px 20px", borderBottom:`1px solid ${t.divider}`, alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:t.textSub }}>{p.title}</div>
                <div style={{ fontSize:11, color:t.textFaint }}>{p.client}</div>
              </div>
              <div style={{ fontSize:13, color:t.textMuted }}>{CURRENCY_SYMBOL}{Math.round(p.planned/1000)}k</div>
              <div style={{ fontSize:13, fontWeight:600, color:t.textSub }}>{CURRENCY_SYMBOL}{Math.round(p.actual/1000)}k</div>
              <div style={{ fontSize:13, fontWeight:700, color: p.variance >= 0 ? "#059669" : "#EF4444" }}>
                {p.variance >= 0 ? "+" : "−"}{CURRENCY_SYMBOL}{Math.round(Math.abs(p.variance)/1000)}k
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color: p.used > 100 ? "#EF4444" : t.textFaint }}>{p.used}%</div>
                <div style={{ background:t.statBg, borderRadius:99, height:4, marginTop:3, overflow:"hidden" }}>
                  <div style={{ width:`${Math.min(100, p.used)}%`, background: p.used > 100 ? "#EF4444" : "#059669", height:"100%", borderRadius:99 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Projects by Stage + KPI breakdown */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
          <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:t.text }}>Projects by Stage</h3>
          {stages.map(s => {
            const count = filteredProjects.filter(p => p.stage === s).length;
            return (
              <div key={s} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{ width:80, fontSize:12, color:t.textMuted }}>{s}</div>
                <ProgressBar value={count} max={Math.max(filteredProjects.length, 1)} color={stageColor(s)} height={8} />
                <div style={{ fontSize:13, fontWeight:700, color:t.text, width:20 }}>{count}</div>
              </div>
            );
          })}
        </div>
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
          <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:t.text }}>KPI Status Breakdown</h3>
          {kpiStats.map(s => {
            const count = kpis.filter(k => k.status === s).length;
            return (
              <div key={s} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{ width:90, fontSize:12, color:t.textMuted }}>{s}</div>
                <ProgressBar value={count} max={Math.max(kpis.length, 1)} color={statusColor(s)} height={8} />
                <div style={{ fontSize:13, fontWeight:700, color:t.text, width:20 }}>{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Client breakdown */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:20 }}>
        <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:t.text }}>Client Project Breakdown</h3>
        {clients.length ? clients.map(c => {
          const count = filteredProjects.filter(p => p.client_id === c.id).length;
          return (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
              <div style={{ width:120, fontSize:12, color:t.textMuted }}>{c.name}</div>
              <ProgressBar value={count} max={Math.max(filteredProjects.length, 1)} color="#7C3AED" height={8} />
              <div style={{ fontSize:13, fontWeight:700, color:t.accentLight }}>{count}</div>
            </div>
          );
        }) : <div style={{ color:t.textFaint, fontSize:13 }}>No clients yet.</div>}
      </div>

      {/* AI Report modal */}
      <Modal open={showReportModal} onClose={()=>setShowReportModal(false)} title="Generate Client Report" width={700}>
        <FormField label="Client">
          <select style={sS} value={reportClient} onChange={e=>setReportClient(e.target.value)}>
            <option value="">Select client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Report Type">
          <select style={sS} value={reportType} onChange={e=>setReportType(e.target.value)}>
            {["Monthly","Quarterly","Campaign","Annual"].map(r => <option key={r}>{r}</option>)}
          </select>
        </FormField>
        <div style={{ display:"flex", gap:10, marginBottom:20 }}>
          <button style={btnPrimary} onClick={genReport} disabled={!reportClient || loading}>
            {loading ? "Generating…" : "Generate ✨"}
          </button>
          {report && (
            <button onClick={exportPDF} style={{ ...bs, display:"flex", alignItems:"center", gap:6 }}>
              🖨 Export PDF
            </button>
          )}
        </div>
        <AIBlock loading={loading} error={reportError} result={report} onRetry={genReport} />
      </Modal>
    </div>
  );
})
