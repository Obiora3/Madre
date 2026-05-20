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

// ─── MEMBER DETAIL MODAL ──────────────────────────────────────────────────────
function MemberModal({ user, tasks, projects, projectById, taskPipelines, theme: t, onClose }) {
  const [tab, setTab] = useState("projects"); // "projects" | "tasks"
  const [taskFilter, setTaskFilter] = useState("all"); // "all" | "active" | "done"
  const bs = mkBtnSecondary(t);

  const userTasks     = useMemo(() => tasks.filter(t2 => t2.assigned_to?.email === user.email), [tasks, user]);
  const doneTasks     = useMemo(() => userTasks.filter(t2 => isTaskComplete(t2, projectById[t2.project_id], taskPipelines)), [userTasks, projectById, taskPipelines]);
  const activeTasks   = useMemo(() => userTasks.filter(t2 => !isTaskComplete(t2, projectById[t2.project_id], taskPipelines)), [userTasks, projectById, taskPipelines]);
  const userProjects  = useMemo(() => projects.filter(p => p.assigned_to?.email === user.email), [projects, user]);
  const activeProjects    = userProjects.filter(p => !["Completed","Archived"].includes(p.status));
  const completedProjects = userProjects.filter(p => ["Completed","Archived"].includes(p.status));
  const totalLogged   = userTasks.reduce((s, t2) => s + (t2.actual_hours || 0), 0);
  const totalEstimated = userTasks.reduce((s, t2) => s + (t2.estimated_hours || 0), 0);

  const visibleTasks = taskFilter === "active" ? activeTasks : taskFilter === "done" ? doneTasks : userTasks;
  const sortedTasks = [...visibleTasks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{ ...bs, padding:"5px 16px", fontSize:12, fontWeight:700, background:tab===id?t.card:"transparent", color:tab===id?t.text:t.textMuted, border:`1px solid ${tab===id?t.border2:"transparent"}`, borderRadius:7, boxShadow:tab===id?"0 1px 4px rgba(0,0,0,0.07)":"none" }}
    >{label}</button>
  );

  return (
    <Modal open onClose={onClose} title="" width={620}>
      {/* Header */}
      <div style={{ display:"flex", gap:16, alignItems:"center", marginBottom:20, paddingBottom:16, borderBottom:`1px solid ${t.border2}` }}>
        <Avatar name={user.name} size={52} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:800, color:t.text }}>{user.name}</div>
          <div style={{ fontSize:13, color:t.textMuted }}>{user.job_title}</div>
          <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
            <Badge label={user.role} color={user.role==="owner"||user.role==="admin"?"#7C3AED":user.role==="manager"?"#F97316":"#6B7280"} />
            {user.department && <Badge label={user.department} color="#0891B2" />}
          </div>
        </div>
        <div style={{ fontSize:12, color:t.textFaint }}>{user.email}</div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(80px,1fr))", gap:8, marginBottom:20 }}>
        {[
          { label:"Active Projects",    value:activeProjects.length,    color:"#3B82F6" },
          { label:"Completed Projects", value:completedProjects.length, color:"#059669" },
          { label:"Open Tasks",         value:activeTasks.length,       color:"#F97316" },
          { label:"Done Tasks",         value:doneTasks.length,         color:"#059669" },
          { label:"Hours Logged",       value:`${totalLogged}h`,        color:"#7C3AED" },
        ].map(s => (
          <div key={s.label} style={{ background:t.statBg, borderRadius:8, padding:"10px 8px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:9, color:t.textFaint, marginTop:2, lineHeight:1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:t.statBg, borderRadius:8, padding:3, marginBottom:16, width:"fit-content" }}>
        {tabBtn("projects", `📁 Projects (${userProjects.length})`)}
        {tabBtn("tasks",    `✓ Tasks (${userTasks.length})`)}
      </div>

      {/* Projects tab */}
      {tab === "projects" && (
        <div>
          {userProjects.length === 0 ? (
            <div style={{ padding:"24px 0", textAlign:"center", color:t.textFaint, fontSize:13 }}>No projects assigned.</div>
          ) : (
            <>
              {activeProjects.length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:700, color:t.textGhost, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>Active</div>
                  {activeProjects.map(p => (
                    <ProjectRow key={p.id} project={p} tasks={tasks} theme={t} />
                  ))}
                </>
              )}
              {completedProjects.length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:700, color:t.textGhost, letterSpacing:"0.07em", textTransform:"uppercase", margin:"14px 0 8px" }}>Completed / Archived</div>
                  {completedProjects.map(p => (
                    <ProjectRow key={p.id} project={p} tasks={tasks} theme={t} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Tasks tab */}
      {tab === "tasks" && (
        <div>
          {/* Filter */}
          <div style={{ display:"flex", gap:4, marginBottom:12 }}>
            {[["all","All"],["active","Active"],["done","Done"]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTaskFilter(id)}
                style={{ ...bs, padding:"3px 12px", fontSize:11, fontWeight:700, background:taskFilter===id?t.accent:"transparent", color:taskFilter===id?"#fff":t.textMuted, border:`1px solid ${taskFilter===id?t.accent:t.border2}`, borderRadius:6 }}
              >{label}</button>
            ))}
            {totalLogged > 0 && (
              <span style={{ marginLeft:"auto", fontSize:12, color:t.textMuted }}>
                {totalLogged}h logged · {totalEstimated}h estimated
              </span>
            )}
          </div>

          {sortedTasks.length === 0 ? (
            <div style={{ padding:"24px 0", textAlign:"center", color:t.textFaint, fontSize:13 }}>No tasks.</div>
          ) : (
            <div style={{ maxHeight:340, overflowY:"auto", overflowX:"auto" }}>
              {/* Column headers */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 130px 80px 60px 50px", gap:8, padding:"4px 8px", marginBottom:4, minWidth:400 }}>
                {["Task","Project","Status","Due","Hours"].map(h => (
                  <span key={h} style={{ fontSize:10, fontWeight:700, color:t.textGhost, letterSpacing:"0.06em" }}>{h.toUpperCase()}</span>
                ))}
              </div>
              {sortedTasks.map(task => {
                const proj = projectById[task.project_id];
                const done = isTaskComplete(task, proj, taskPipelines);
                const sc   = statusColor(task.status);
                return (
                  <div key={task.id} style={{ display:"grid", gridTemplateColumns:"1fr 130px 80px 60px 50px", gap:8, padding:"8px 8px", borderRadius:8, background:t.statBg, marginBottom:5, alignItems:"center", opacity:done?0.7:1, minWidth:400 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:t.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {done && <span style={{ color:"#059669", marginRight:4 }}>✓</span>}
                        {task.title}
                      </div>
                      {task.description && <div style={{ fontSize:10, color:t.textGhost, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{task.description}</div>}
                    </div>
                    <div style={{ fontSize:11, color:t.textFaint, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{proj?.title || "—"}</div>
                    <span style={{ fontSize:10, background:sc+"22", color:sc, border:`1px solid ${sc}44`, borderRadius:5, padding:"2px 6px", fontWeight:700, textAlign:"center" }}>{task.status}</span>
                    <span style={{ fontSize:11, color:t.textFaint }}>{task.due_date ? fmtDate(task.due_date) : "—"}</span>
                    <span style={{ fontSize:11, color:t.textMuted, textAlign:"right" }}>
                      {task.actual_hours > 0 ? `${task.actual_hours}h` : task.estimated_hours > 0 ? `~${task.estimated_hours}h` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ProjectRow({ project: p, tasks, theme: t }) {
  const projTasks = tasks.filter(t2 => t2.project_id === p.id);
  const sc = statusColor(p.status);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:8, background:t.statBg, marginBottom:6 }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:sc, flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:t.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.title}</div>
        <div style={{ fontSize:11, color:t.textFaint }}>{projTasks.length} task{projTasks.length !== 1 ? "s" : ""} · Due {fmtDate(p.due_date)}</div>
      </div>
      <Badge label={p.status} color={sc} />
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:t.text }}>{p.progress ?? 0}%</div>
        <div style={{ fontSize:9, color:t.textFaint }}>done</div>
      </div>
    </div>
  );
}

// ─── TEAM ─────────────────────────────────────────────────────────────────────
export const Team = React.memo(function Team() {
  const { users, tasks, projects, whiteLabelSettings, isMobile } = useApp();
  const { theme: t } = useTheme();
  const taskPipelines = useMemo(() => getTaskPipelines(whiteLabelSettings), [whiteLabelSettings]);
  const projectById   = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);
  const [detailUser, setDetailUser] = useState(null);

  const STATUS_ORDER = { "In Progress": 0, "In Review": 1, "To Do": 2 };

  const taskHours = (t2) => {
    if (t2.estimated_hours > 0) return t2.estimated_hours;
    if (!t2.due_date) return 0;
    const start = new Date(t2.created_at || Date.now());
    const end   = new Date(t2.due_date);
    return Math.max(0, Math.round((end - start) / 3600000));
  };

  const memberMap = useMemo(() => {
    const map = {};
    users.forEach(u => {
      const allTasks   = tasks.filter(t2 => t2.assigned_to?.email === u.email);
      const activeTasks = allTasks.filter(t2 => !isTaskComplete(t2, projectById[t2.project_id], taskPipelines));
      const doneTasks  = allTasks.filter(t2 => isTaskComplete(t2, projectById[t2.project_id], taskPipelines));
      const hours      = activeTasks.reduce((s, t2) => s + taskHours(t2), 0);
      const pct        = Math.min(100, Math.round((hours / 40) * 100));
      const activeProjects    = projects.filter(p => p.assigned_to?.email === u.email && !["Completed","Archived"].includes(p.status));
      const completedProjects = projects.filter(p => p.assigned_to?.email === u.email && ["Completed","Archived"].includes(p.status));
      const totalLogged = allTasks.reduce((s, t2) => s + (t2.actual_hours || 0), 0);
      const sorted = [...activeTasks].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));
      map[u.email] = {
        hours, pct,
        color: pct < 70 ? "#059669" : pct < 90 ? "#F59E0B" : "#EF4444",
        activeTasks: sorted,
        activeTaskCount:  activeTasks.length,
        doneTaskCount:    doneTasks.length,
        activeProjectCount:    activeProjects.length,
        completedProjectCount: completedProjects.length,
        totalLogged,
      };
    });
    return map;
  }, [users, tasks, projects, projectById, taskPipelines]);

  return (
    <div>
      <h1 style={{ margin:"0 0 24px", fontSize:26, fontWeight:800, color:t.text }}>Team</h1>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${isMobile ? 1 : 3},1fr)`, gap:16 }}>
        {users.map(u => {
          const m = memberMap[u.email] || { hours:0, pct:0, color:"#6B7280", activeTasks:[], activeTaskCount:0, doneTaskCount:0, activeProjectCount:0, completedProjectCount:0, totalLogged:0 };
          return (
            <div key={u.id} style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, display:"flex", flexDirection:"column" }}>
              {/* Avatar + name */}
              <div style={{ display:"flex", gap:14, marginBottom:14, alignItems:"center" }}>
                <Avatar name={u.name} size={44} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:t.text }}>{u.name}</div>
                  <div style={{ fontSize:12, color:t.textMuted }}>{u.job_title}</div>
                  {u.department && <span style={{ fontSize:11, background:t.navActive, color:t.navActiveText, padding:"2px 8px", borderRadius:99, marginTop:4, display:"inline-block" }}>{u.department}</span>}
                </div>
              </div>

              {/* Stats 2×2 */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:12 }}>
                <StatTile label="Active Projects" value={m.activeProjectCount} theme={t} />
                <StatTile label="Completed Projects" value={m.completedProjectCount} color="#059669" theme={t} />
                <StatTile label="Open Tasks" value={m.activeTaskCount} theme={t} />
                <StatTile label="Hours Logged" value={`${m.totalLogged}h`} color="#7C3AED" theme={t} />
              </div>

              {/* Capacity */}
              <div style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:11, color:t.textMuted }}>Capacity ({m.hours}h committed)</span>
                  <span style={{ fontSize:11, color:m.color, fontWeight:700 }}>{m.pct}%</span>
                </div>
                <ProgressBar value={m.pct} color={m.color} height={6} />
              </div>

              {/* Skills */}
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10 }}>
                {(u.skills||[]).map(s => <span key={s} style={{ fontSize:10, background:t.toggleBg, color:t.textMuted, padding:"2px 7px", borderRadius:99 }}>{s}</span>)}
              </div>

              {/* Current work preview */}
              {m.activeTasks.length > 0 && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:t.textGhost, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6 }}>Current Work</div>
                  {m.activeTasks.slice(0, 2).map(task => {
                    const proj = projectById[task.project_id];
                    const sc   = statusColor(task.status);
                    return (
                      <div key={task.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"5px 0", borderBottom:`1px solid ${t.divider}` }}>
                        <span style={{ width:7, height:7, borderRadius:"50%", background:sc, flexShrink:0, marginTop:4 }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:t.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{task.title}</div>
                          <div style={{ fontSize:10, color:t.textFaint }}>{proj?.title || ""}{proj && task.due_date ? " · " : ""}{task.due_date ? `Due ${fmtDate(task.due_date)}` : ""}</div>
                        </div>
                        <span style={{ fontSize:10, background:sc+"22", color:sc, border:`1px solid ${sc}44`, borderRadius:5, padding:"1px 5px", flexShrink:0, fontWeight:700 }}>{task.status}</span>
                      </div>
                    );
                  })}
                  {m.activeTasks.length > 2 && (
                    <div style={{ fontSize:11, color:t.textFaint, marginTop:4 }}>+{m.activeTasks.length - 2} more</div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"auto", paddingTop:10, borderTop:`1px solid ${t.divider}` }}>
                <Badge label={u.role} color={u.role==="owner"||u.role==="admin"?"#7C3AED":u.role==="manager"?"#F97316":"#6B7280"} />
                <button
                  onClick={() => setDetailUser(u)}
                  style={{ background:"transparent", border:`1px solid ${t.border2}`, borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:700, color:t.textMuted, cursor:"pointer" }}
                >
                  View Details →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {detailUser && (
        <MemberModal
          user={detailUser}
          tasks={tasks}
          projects={projects}
          projectById={projectById}
          taskPipelines={taskPipelines}
          theme={t}
          onClose={() => setDetailUser(null)}
        />
      )}
    </div>
  );
})

function StatTile({ label, value, color, theme: t }) {
  return (
    <div style={{ background:t.statBg, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
      <div style={{ fontSize:17, fontWeight:800, color:color||t.text }}>{value}</div>
      <div style={{ fontSize:9, color:t.textFaint, marginTop:1 }}>{label}</div>
    </div>
  );
}
