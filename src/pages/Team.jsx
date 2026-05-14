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

// ─── TEAM ─────────────────────────────────────────────────────────────────────
export const Team = React.memo(function Team() {
  const { users, tasks, projects } = useApp();
  const { theme: t } = useTheme();

  const STATUS_ORDER = { "In Progress": 0, "In Review": 1, "To Do": 2 };

  // Pre-compute workload + current tasks for every user in one pass
  const workloadMap = useMemo(() => {
    const map = {};
    users.forEach(u => {
      const userTasks = tasks.filter(t2 => t2.assigned_to?.email === u.email && t2.status !== "Done");
      const hours = userTasks.reduce((s, t2) => s + (t2.estimated_hours || 0), 0);
      const pct   = Math.min(100, Math.round((hours / 40) * 100));
      const sorted = [...userTasks].sort((a, b) =>
        (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
      );
      map[u.email] = { hours, pct, count: userTasks.length, color: pct < 70 ? "#059669" : pct < 90 ? "#F59E0B" : "#EF4444", activeTasks: sorted };
    });
    return map;
  }, [users, tasks]);

  // Active project counts per user
  const activeProjectMap = useMemo(() => {
    const map = {};
    users.forEach(u => {
      map[u.email] = projects.filter(p => p.assigned_to?.email === u.email && p.status === "Active").length;
    });
    return map;
  }, [users, projects]);

  const projectById = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);
  return (
    <div>
      <h1 style={{ margin:"0 0 24px", fontSize:26, fontWeight:800, color:t.text }}>Team</h1>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
        {users.map(u=>{
          const wl = workloadMap[u.email] || { hours:0, pct:0, count:0, color:"#6B7280" };
          const activeProj = activeProjectMap[u.email] || 0;
          return (
            <div key={u.id} style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
              <div style={{ display:"flex", gap:14, marginBottom:14, alignItems:"center" }}>
                <Avatar name={u.name} size={44} />
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:t.text }}>{u.name}</div>
                  <div style={{ fontSize:12, color:t.textMuted }}>{u.job_title}</div>
                  {u.department && <span style={{ fontSize:11, background:t.navActive, color:t.navActiveText, padding:"2px 8px", borderRadius:99, marginTop:4, display:"inline-block" }}>{u.department}</span>}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                <div style={{ background:t.statBg, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:t.text }}>{activeProj}</div>
                  <div style={{ fontSize:10, color:t.textFaint }}>Projects</div>
                </div>
                <div style={{ background:t.statBg, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:t.text }}>{wl.count}</div>
                  <div style={{ fontSize:10, color:t.textFaint }}>Open Tasks</div>
                </div>
              </div>
              <div style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:11, color:t.textMuted }}>Capacity ({wl.hours}h remaining)</span>
                  <span style={{ fontSize:11, color:wl.color, fontWeight:700 }}>{wl.pct}%</span>
                </div>
                <ProgressBar value={wl.pct} color={wl.color} height={6} />
              </div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:8 }}>
                {(u.skills||[]).map(s=><span key={s} style={{ fontSize:10, background:t.toggleBg, color:t.textMuted, padding:"2px 7px", borderRadius:99 }}>{s}</span>)}
              </div>
              {wl.activeTasks.length > 0 && (
                <div style={{ marginTop:10, marginBottom:8 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:t.textGhost, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6 }}>Current Work</div>
                  {wl.activeTasks.slice(0, 3).map(task => {
                    const proj = projectById[task.project_id];
                    const sc = statusColor(task.status);
                    return (
                      <div key={task.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"6px 0", borderBottom:`1px solid ${t.divider}` }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", background:sc, flexShrink:0, marginTop:4 }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:t.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{task.title}</div>
                          <div style={{ fontSize:10, color:t.textFaint }}>
                            {proj ? proj.title : ""}
                            {proj && task.due_date ? " · " : ""}
                            {task.due_date ? `Due ${fmtDate(task.due_date)}` : ""}
                          </div>
                        </div>
                        <span style={{ fontSize:10, background:sc+"22", color:sc, border:`1px solid ${sc}44`, borderRadius:5, padding:"1px 6px", flexShrink:0, fontWeight:700 }}>{task.status}</span>
                      </div>
                    );
                  })}
                  {wl.activeTasks.length > 3 && (
                    <div style={{ fontSize:11, color:t.textFaint, marginTop:5 }}>+{wl.activeTasks.length - 3} more task{wl.activeTasks.length - 3 > 1 ? "s" : ""}</div>
                  )}
                </div>
              )}
              <Badge label={u.role} color={u.role==="admin"?"#7C3AED":u.role==="lead"?"#F59E0B":"#6B7280"} />
            </div>
          );
        })}
      </div>
    </div>
  );
})
