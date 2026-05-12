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

export const DeliveryScores = React.memo(function DeliveryScores() {
  const { tasks, kpis, users } = useApp();
  const { theme: t } = useTheme();
  const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const [quarter, setQuarter] = useState("Q2 2026");
  const [selectedUser, setSelectedUser] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const quarters = ["Q1 2025","Q2 2025","Q3 2025","Q4 2025","Q1 2026","Q2 2026","Q3 2026","Q4 2026"];
  // Quarter date ranges — stable object, no need to recreate every render
  const qRanges = useMemo(() => ({
    "Q1 2025":[new Date("2025-01-01"),new Date("2025-03-31")],
    "Q2 2025":[new Date("2025-04-01"),new Date("2025-06-30")],
    "Q3 2025":[new Date("2025-07-01"),new Date("2025-09-30")],
    "Q4 2025":[new Date("2025-10-01"),new Date("2025-12-31")],
    "Q1 2026":[new Date("2026-01-01"),new Date("2026-03-31")],
    "Q2 2026":[new Date("2026-04-01"),new Date("2026-06-30")],
    "Q3 2026":[new Date("2026-07-01"),new Date("2026-09-30")],
    "Q4 2026":[new Date("2026-10-01"),new Date("2026-12-31")],
  }), []); // empty deps — dates are constants

  const [start, end] = qRanges[quarter];

  // Per-user scoring loop — only reruns when tasks/kpis/users or selected quarter changes
  const { scores, avgScore, highPerformers } = useMemo(() => {
    const kpiAchieved = kpis.filter(k => k.status === "Achieved").length;
    const scores = users.map(u => {
      const assigned = tasks.filter(t2 =>
        t2.assigned_to?.email === u.email &&
        new Date(t2.due_date) >= start &&
        new Date(t2.due_date) <= end
      );
      const done   = assigned.filter(t2 => t2.status === "Done");
      const onTime = done.filter(t2 => (t2.actual_hours || 0) <= (t2.estimated_hours || 99));
      const compRate  = assigned.length ? Math.round((done.length / assigned.length) * 100) : 0;
      const timeRate  = done.length    ? Math.round((onTime.length / done.length) * 100)    : 0;
      const score     = Math.round(compRate * 0.5 + timeRate * 0.5);
      const tier      = score >= 80 ? "High Performer" : score >= 60 ? "Meets Expectations" : "Needs Improvement";
      const tierColor = score >= 80 ? "#059669"        : score >= 60 ? "#F59E0B"            : "#EF4444";
      return { user: u, assigned: assigned.length, done: done.length, compRate, timeRate, score, tier, tierColor, kpiTracked: kpis.length, kpiAchieved };
    });
    return {
      scores,
      avgScore:       scores.length ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0,
      highPerformers: scores.filter(r => r.score >= 80).length,
    };
  }, [tasks, kpis, users, start, end]);
  const genReport = async (scoreRow) => {
    setSelectedUser(scoreRow); setAiLoading(true); setAiReport(null); setAiError(null);
    try {
      const result = await callClaude(
        `Generate a professional HR appraisal report for ${scoreRow.user.name} for ${quarter}.\n\nData:\n- Role: ${scoreRow.user.job_title}\n- Delivery Score: ${scoreRow.score}/100 (${scoreRow.tier})\n- Completion Rate: ${scoreRow.compRate}%\n- On-time Rate: ${scoreRow.timeRate}%\n- Tasks Assigned: ${scoreRow.assigned}, Completed: ${scoreRow.done}\n- Skills: ${(scoreRow.user.skills||[]).join(", ")}\n\nStructure: 1) Professional summary 2) Top strengths (3 bullets) 3) Development areas (3 bullets) 4) HR recommendation`,
        "You are an HR performance analyst. Write formally and constructively."
      );
      setAiReport(result);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };
  const exportCSV = () => {
    const headers = "Name,Email,Quarter,Tasks Assigned,Completed,Completion Rate %,On-Time Rate %,Delivery Score,KPIs Tracked,KPIs Achieved\n";
    const rows = scores.map(r=>`${r.user.name},${r.user.email},${quarter},${r.assigned},${r.done},${r.compRate},${r.timeRate},${r.score},${r.kpiTracked},${r.kpiAchieved}`).join("\n");
    const blob = new Blob([headers+rows],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`delivery_scores_${quarter.replace(" ","_")}.csv`; a.click();
  };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>KPI Delivery Scores</h1>
        <div style={{ display:"flex", gap:10 }}>
          <select style={{...sS,width:140}} value={quarter} onChange={e=>setQuarter(e.target.value)}>{quarters.map(q=><option key={q}>{q}</option>)}</select>
          <button style={bs} onClick={exportCSV}>📥 Export CSV</button>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        <StatCard icon="👥" label="Team Members" value={users.length} />
        <StatCard icon="📋" label="Total Tasks" value={tasks.filter(t2=>new Date(t2.due_date)>=start&&new Date(t2.due_date)<=end).length} />
        <StatCard icon="⭐" label="Avg Score" value={`${avgScore}/100`} />
        <StatCard icon="🏆" label="High Performers" value={highPerformers} />
      </div>
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden", marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 80px 80px 100px 80px 80px 100px", padding:"10px 16px", borderBottom:`1px solid ${t.border2}` }}>
          {["Team Member","Assigned","Done","Comp.%","On-Time%","KPIs","Achieved","Score"].map((h,i)=>(
            <div key={i} style={{ fontSize:11, fontWeight:700, color:t.textFaint, letterSpacing:"0.05em", textTransform:"uppercase" }}>{h}</div>
          ))}
        </div>
        {scores.map(r=>(
          <div key={r.user.id} style={{ display:"grid", gridTemplateColumns:"1fr 80px 80px 80px 100px 80px 80px 100px", padding:"12px 16px", borderBottom:`1px solid ${t.divider}`, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <Avatar name={r.user.name} size={32} />
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:t.textSub }}>{r.user.name}</div>
                <div style={{ fontSize:11, color:t.textFaint }}>{r.user.job_title}</div>
              </div>
            </div>
            <div style={{ fontSize:13, color:t.textMuted }}>{r.assigned}</div>
            <div style={{ fontSize:13, color:t.textMuted }}>{r.done}</div>
            <div style={{ fontSize:13, color:t.textSub, fontWeight:600 }}>{r.compRate}%</div>
            <div style={{ fontSize:13, color:t.textSub, fontWeight:600 }}>{r.timeRate}%</div>
            <div style={{ fontSize:13, color:t.textMuted }}>{r.kpiTracked}</div>
            <div style={{ fontSize:13, color:t.textMuted }}>{r.kpiAchieved}</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:16, fontWeight:800, color:r.tierColor }}>{r.score}</span>
              <button onClick={()=>genReport(r)} style={{...btnPrimary, padding:"4px 10px", fontSize:11}}>Report</button>
            </div>
          </div>
        ))}
      </div>
      {selectedUser && (
        <div style={{ background:t.card, border:`1px solid ${t.accent}44`, borderRadius:14, padding:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <Avatar name={selectedUser.user.name} size={44} />
              <div>
                <h3 style={{ margin:0, color:t.text, fontSize:17, fontWeight:700 }}>{selectedUser.user.name} — AI Appraisal</h3>
                <div style={{ fontSize:12, color:t.textMuted }}>{quarter} · <Badge label={selectedUser.tier} color={selectedUser.tierColor} /></div>
              </div>
            </div>
            <button onClick={()=>window.print()} style={bs}>🖨 Print / PDF</button>
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
