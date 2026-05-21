import {
  React,
  useEffect,
  useMemo,
  useRef,
  useState,
  MOCK_ACTIVITIES,
  useApp,
  useTheme,
  useToast,
  callClaude,
  fmtDate,
  getTaskPipelines,
  isTaskComplete,
  priorityColor,
  stageColor,
  statusColor,
  AIBlock,
  Avatar,
  Badge,
  ConfirmModal,
  FormField,
  Modal,
  ProgressBar,
  StatCard,
  TaskStatusButton,
  btnPrimary,
  mkBtnSecondary,
  mkInputStyle,
  mkSelectStyle
} from "./_shared.js";

const QUARTERS = [
  "Q1 2025","Q2 2025","Q3 2025","Q4 2025",
  "Q1 2026","Q2 2026","Q3 2026","Q4 2026",
];
const Q_RANGES = {
  "Q1 2025":[new Date("2025-01-01"),new Date("2025-03-31")],
  "Q2 2025":[new Date("2025-04-01"),new Date("2025-06-30")],
  "Q3 2025":[new Date("2025-07-01"),new Date("2025-09-30")],
  "Q4 2025":[new Date("2025-10-01"),new Date("2025-12-31")],
  "Q1 2026":[new Date("2026-01-01"),new Date("2026-03-31")],
  "Q2 2026":[new Date("2026-04-01"),new Date("2026-06-30")],
  "Q3 2026":[new Date("2026-07-01"),new Date("2026-09-30")],
  "Q4 2026":[new Date("2026-10-01"),new Date("2026-12-31")],
};

function prevQuarter(q) {
  const idx = QUARTERS.indexOf(q);
  return idx > 0 ? QUARTERS[idx - 1] : null;
}

function scoreUsers(tasks, kpis, users, quarter, projectById, taskPipelines) {
  const [start, end] = Q_RANGES[quarter] || [new Date(0), new Date()];
  const kpiAchieved  = kpis.filter(k => k.status === "Achieved").length;
  return users.map(u => {
    const assigned = tasks.filter(t2 =>
      t2.assigned_to?.email === u.email &&
      t2.due_date &&
      new Date(t2.due_date) >= start &&
      new Date(t2.due_date) <= end
    );
    const done      = assigned.filter(t2 => isTaskComplete(t2, projectById[t2.project_id], taskPipelines));
    const onTime    = done.filter(t2 => (t2.actual_hours || 0) <= (t2.estimated_hours || 99));
    const compRate  = assigned.length ? Math.round((done.length   / assigned.length) * 100) : 0;
    const timeRate  = done.length     ? Math.round((onTime.length / done.length)     * 100) : 0;
    const score     = Math.round(compRate * 0.5 + timeRate * 0.5);
    const tier      = score >= 80 ? "High Performer" : score >= 60 ? "Meets Expectations" : "Needs Improvement";
    const tierColor = score >= 80 ? "#059669"        : score >= 60 ? "#F59E0B"            : "#EF4444";
    return { user: u, assigned: assigned.length, done: done.length, compRate, timeRate, score, tier, tierColor, kpiTracked: kpis.length, kpiAchieved };
  });
}

export const DeliveryScores = React.memo(function DeliveryScores() {
  const { tasks, kpis, users, departments, projects, whiteLabelSettings, isMobile } = useApp();
  const { theme: t } = useTheme();
  const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const taskPipelines = useMemo(() => getTaskPipelines(whiteLabelSettings), [whiteLabelSettings]);
  const projectById = useMemo(() => Object.fromEntries((projects || []).map(p => [p.id, p])), [projects]);

  const [quarter,      setQuarter]      = useState("Q2 2026");
  const [selectedUser, setSelectedUser] = useState(null);
  const [aiReport,     setAiReport]     = useState(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState(null);
  const [tab,          setTab]          = useState("team");

  const scores = useMemo(() => scoreUsers(tasks, kpis, users, quarter, projectById, taskPipelines), [tasks, kpis, users, quarter, projectById, taskPipelines]);
  const prevQ  = prevQuarter(quarter);
  const prevScores = useMemo(() => prevQ ? scoreUsers(tasks, kpis, users, prevQ, projectById, taskPipelines) : [], [tasks, kpis, users, prevQ, projectById, taskPipelines]);

  const { avgScore, highPerformers, meetCount, needCount, deptScores } = useMemo(() => {
    const avgScore        = scores.length ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0;
    const highPerformers  = scores.filter(r => r.score >= 80).length;
    const meetCount       = scores.filter(r => r.score >= 60 && r.score < 80).length;
    const needCount       = scores.filter(r => r.score < 60).length;

    const deptScores = (departments || []).map(dept => {
      const members = scores.filter(r => r.user.department === dept.name);
      const avg     = members.length ? Math.round(members.reduce((s, r) => s + r.score, 0) / members.length) : 0;
      return { name: dept.name, count: members.length, avg };
    }).filter(d => d.count > 0);

    return { avgScore, highPerformers, meetCount, needCount, deptScores };
  }, [scores, departments]);

  const [start] = Q_RANGES[quarter] || [new Date(0)];

  const genReport = async (scoreRow) => {
    setSelectedUser(scoreRow); setAiLoading(true); setAiReport(null); setAiError(null);
    const prev = prevScores.find(r => r.user.id === scoreRow.user.id);
    const trendText = prev ? `Previous quarter score: ${prev.score}/100 (${prev.tier}). Change: ${scoreRow.score >= prev.score ? "+" : ""}${scoreRow.score - prev.score} points.` : "No prior quarter data.";
    try {
      const result = await callClaude(
        `Generate a professional HR appraisal report for ${scoreRow.user.name} for ${quarter}.\n\nData:\n- Role: ${scoreRow.user.job_title}\n- Department: ${scoreRow.user.department || "—"}\n- Delivery Score: ${scoreRow.score}/100 (${scoreRow.tier})\n- Completion Rate: ${scoreRow.compRate}%\n- On-time Rate: ${scoreRow.timeRate}%\n- Tasks Assigned: ${scoreRow.assigned}, Completed: ${scoreRow.done}\n- Skills: ${(scoreRow.user.skills || []).join(", ") || "Not recorded"}\n- Trend: ${trendText}\n\nStructure: 1) Professional summary (2-3 sentences) 2) Top strengths (3 bullets) 3) Development areas (3 bullets) 4) Quarter-on-quarter trend analysis 5) HR recommendation`,
        "You are an HR performance analyst. Write formally and constructively. Reference specific numbers."
      );
      setAiReport(result);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = "Name,Email,Department,Quarter,Tasks Assigned,Completed,Completion Rate %,On-Time Rate %,Delivery Score,Tier,KPIs Tracked,KPIs Achieved\n";
    const rows    = scores.map(r =>
      `${r.user.name},${r.user.email},${r.user.department||""},${quarter},${r.assigned},${r.done},${r.compRate},${r.timeRate},${r.score},${r.tier},${r.kpiTracked},${r.kpiAchieved}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = `delivery_scores_${quarter.replace(" ","_")}.csv`; a.click();
  };

  const teamColor = avgScore >= 80 ? "#059669" : avgScore >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:isMobile?"flex-start":"center", marginBottom:20, flexDirection:isMobile?"column":"row", gap:isMobile?10:0 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>KPI Delivery Scores</h1>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <select style={{...sS, width:isMobile?"100%":140}} value={quarter} onChange={e => setQuarter(e.target.value)}>
            {QUARTERS.map(q => <option key={q}>{q}</option>)}
          </select>
          <button style={bs} onClick={exportCSV}>📥 Export CSV</button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(5,1fr)", gap:14, marginBottom:24 }}>
        <StatCard icon="👥" label="Team Members"    value={users.length} />
        <StatCard icon="📋" label="Tasks in Quarter" value={tasks.filter(t2=>t2.due_date&&new Date(t2.due_date)>=start).length} />
        <StatCard icon="⭐" label="Team Avg Score"  value={`${avgScore}/100`} sub={avgScore >= 80 ? "High performing" : avgScore >= 60 ? "Meeting targets" : "Needs attention"} />
        <StatCard icon="🏆" label="High Performers" value={highPerformers} sub={`${meetCount} meeting · ${needCount} below`} />
        <StatCard icon="📊" label="KPI Achievement"  value={`${kpis.filter(k=>k.status==="Achieved").length}/${kpis.length}`} sub={kpis.length ? `${Math.round((kpis.filter(k=>k.status==="Achieved").length/kpis.length)*100)}% achieved` : "No KPIs set"} />
      </div>

      {/* Team health bar */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:"16px 20px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ fontSize:13, fontWeight:700, color:t.text }}>Overall Team Health — {quarter}</span>
          <span style={{ fontSize:22, fontWeight:800, color:teamColor }}>{avgScore}/100</span>
        </div>
        <div style={{ display:"flex", gap:0, height:24, borderRadius:8, overflow:"hidden" }}>
          {[
            { count:highPerformers, color:"#059669", label:"High Performer" },
            { count:meetCount,      color:"#F59E0B", label:"Meets Expectations" },
            { count:needCount,      color:"#EF4444", label:"Needs Improvement" },
          ].filter(s => s.count > 0).map(s => (
            <div
              key={s.label}
              title={`${s.label}: ${s.count}`}
              style={{ flex:s.count, background:s.color, display:"flex", alignItems:"center", justifyContent:"center", transition:"flex 0.4s" }}
            >
              {s.count > 0 && <span style={{ fontSize:11, fontWeight:700, color:"#fff" }}>{s.count}</span>}
            </div>
          ))}
          {users.length === 0 && <div style={{ flex:1, background:t.toggleBg }} />}
        </div>
        <div style={{ display:"flex", gap:16, marginTop:8 }}>
          {[["#059669","High Performer"],["#F59E0B","Meets Expectations"],["#EF4444","Needs Improvement"]].map(([c,l]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:c }} />
              <span style={{ fontSize:11, color:t.textFaint }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:16, border:`1px solid ${t.border2}`, borderRadius:10, overflow:"hidden", width:"fit-content" }}>
        {[["team","Team Scores"],["dept","By Department"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:"8px 20px", background:tab===id?"#7C3AED":t.card, color:tab===id?"#fff":t.textMuted, border:"none", cursor:"pointer", fontSize:13, fontWeight:tab===id?700:400, transition:"background 0.15s" }}>{label}</button>
        ))}
      </div>

      {/* Team scores table */}
      {tab === "team" && (
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden", marginBottom:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 80px 90px 70px 70px 160px 90px", padding:"10px 16px", borderBottom:`1px solid ${t.border2}`, background:t.statBg }}>
            {["Team Member","Assigned","Done","Comp.%","On-Time %","KPIs","Achieved","Score","Report"].map((h,i) => (
              <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textFaint, letterSpacing:"0.05em", textTransform:"uppercase" }}>{h}</div>
            ))}
          </div>
          {scores.map(r => {
            const prev      = prevScores.find(p => p.user.id === r.user.id);
            const trend     = prev ? r.score - prev.score : null;
            const trendIcon = trend === null ? "" : trend > 0 ? "↑" : trend < 0 ? "↓" : "→";
            const trendColor = trend === null ? t.textGhost : trend > 0 ? "#059669" : trend < 0 ? "#EF4444" : t.textGhost;
            return (
              <div key={r.user.id} style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 80px 90px 70px 70px 160px 90px", padding:"14px 16px", borderBottom:`1px solid ${t.divider}`, alignItems:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <Avatar name={r.user.name} size={32} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:t.textSub }}>{r.user.name}</div>
                    <div style={{ fontSize:11, color:t.textFaint }}>{r.user.job_title}{r.user.department ? ` · ${r.user.department}` : ""}</div>
                  </div>
                </div>
                <div style={{ fontSize:13, color:t.textMuted }}>{r.assigned}</div>
                <div style={{ fontSize:13, color:t.textMuted }}>{r.done}</div>
                <div style={{ fontSize:13, color:t.textSub, fontWeight:600 }}>{r.compRate}%</div>
                <div style={{ fontSize:13, color:t.textSub, fontWeight:600 }}>{r.timeRate}%</div>
                <div style={{ fontSize:13, color:t.textMuted }}>{r.kpiTracked}</div>
                <div style={{ fontSize:13, color:t.textMuted }}>{r.kpiAchieved}</div>

                {/* Score with bar + trend */}
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:16, fontWeight:800, color:r.tierColor }}>{r.score}</span>
                    <Badge label={r.tier} color={r.tierColor} />
                    {trend !== null && (
                      <span style={{ fontSize:11, fontWeight:700, color:trendColor }}>{trendIcon}{Math.abs(trend)}</span>
                    )}
                  </div>
                  <div style={{ height:4, borderRadius:99, background:t.toggleBg }}>
                    <div style={{ height:"100%", borderRadius:99, width:`${r.score}%`, background:r.tierColor, transition:"width 0.4s" }} />
                  </div>
                </div>

                <button
                  onClick={() => genReport(r)}
                  style={{ ...btnPrimary, padding:"5px 12px", fontSize:11 }}
                >
                  {selectedUser?.user.id === r.user.id && aiLoading ? "…" : "✦ Report"}
                </button>
              </div>
            );
          })}
          {scores.length === 0 && (
            <div style={{ padding:40, textAlign:"center", color:t.textGhost, fontSize:13 }}>No team members found.</div>
          )}
        </div>
      )}

      {/* Department tab */}
      {tab === "dept" && (
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden", marginBottom:20 }}>
          {deptScores.length === 0 ? (
            <div style={{ padding:40, textAlign:"center", color:t.textGhost, fontSize:13 }}>No departments with assigned members for this quarter.</div>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 180px 100px", padding:"10px 20px", borderBottom:`1px solid ${t.border2}`, background:t.statBg }}>
                {["Department","Members","Avg Score","Tier"].map((h,i) => (
                  <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textFaint, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</div>
                ))}
              </div>
              {deptScores.sort((a,b) => b.avg - a.avg).map(d => {
                const dc    = d.avg >= 80 ? "#059669" : d.avg >= 60 ? "#F59E0B" : "#EF4444";
                const dtier = d.avg >= 80 ? "Strong"  : d.avg >= 60 ? "Moderate" : "Weak";
                return (
                  <div key={d.name} style={{ display:"grid", gridTemplateColumns:"1fr 80px 180px 100px", padding:"14px 20px", borderBottom:`1px solid ${t.divider}`, alignItems:"center" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:t.textSub }}>{d.name}</div>
                    <div style={{ fontSize:13, color:t.textMuted }}>{d.count}</div>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:15, fontWeight:800, color:dc }}>{d.avg}/100</span>
                      </div>
                      <div style={{ height:4, borderRadius:99, background:t.toggleBg }}>
                        <div style={{ height:"100%", borderRadius:99, width:`${d.avg}%`, background:dc, transition:"width 0.4s" }} />
                      </div>
                    </div>
                    <Badge label={dtier} color={dc} />
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* AI Appraisal report panel */}
      {selectedUser && (
        <div style={{ background:t.card, border:`1px solid ${t.accent}44`, borderRadius:14, padding:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <Avatar name={selectedUser.user.name} size={48} />
              <div>
                <h3 style={{ margin:0, color:t.text, fontSize:17, fontWeight:700 }}>{selectedUser.user.name}</h3>
                <div style={{ fontSize:12, color:t.textMuted, marginTop:2 }}>
                  {selectedUser.user.job_title} · {quarter}
                  <span style={{ display:"inline-block", marginLeft:8 }}>
                    <Badge label={selectedUser.tier} color={selectedUser.tierColor} />
                  </span>
                </div>
                <div style={{ display:"flex", gap:20, marginTop:8 }}>
                  {[
                    ["Score",        `${selectedUser.score}/100`, selectedUser.tierColor],
                    ["Completion",   `${selectedUser.compRate}%`, t.textSub],
                    ["On-Time",      `${selectedUser.timeRate}%`, t.textSub],
                    ["Tasks Done",   `${selectedUser.done}/${selectedUser.assigned}`, t.textSub],
                  ].map(([l, v, c]) => (
                    <div key={l}>
                      <div style={{ fontSize:10, color:t.textGhost, textTransform:"uppercase", letterSpacing:"0.05em" }}>{l}</div>
                      <div style={{ fontSize:15, fontWeight:700, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => window.print()} style={bs}>🖨 Print</button>
              <button onClick={() => { setSelectedUser(null); setAiReport(null); setAiError(null); }} style={{ background:"none", border:`1px solid ${t.border2}`, color:t.textMuted, borderRadius:7, padding:"5px 12px", fontSize:12, cursor:"pointer" }}>Close</button>
            </div>
          </div>
          {aiLoading || aiError || aiReport
            ? <AIBlock loading={aiLoading} error={aiError} result={aiReport} onRetry={() => genReport(selectedUser)} />
            : null
          }
        </div>
      )}
    </div>
  );
})
