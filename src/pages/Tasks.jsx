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
  CommentsPanel,
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

// ─── TASKS ────────────────────────────────────────────────────────────────────
export const Tasks = React.memo(function Tasks() {
  const { tasks, setTasks, projects, departments, comments, setComments, currentUser } = useApp();
  const projectById = useMemo(() => Object.fromEntries((projects||[]).map(p => [p.id, p])), [projects]);
  const { theme: t } = useTheme();
  const toast = useToast();
  const bs = mkBtnSecondary(t);
  const [commentTask, setCommentTask] = useState(null);
  const [viewMode, setViewMode]       = useState("Global");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter]   = useState("All");
  const statuses = ["All","To Do","In Progress","In Review","Done"];

  const filtered = useMemo(() => {
    let result = statusFilter === "All" ? tasks : tasks.filter(t2 => t2.status === statusFilter);
    if (viewMode === "By Department" && deptFilter !== "All") {
      const dept = departments.find(d => d.name === deptFilter);
      if (dept) result = result.filter(t2 => dept.members.includes(t2.assigned_to?.email));
    }
    return result;
  }, [tasks, statusFilter, viewMode, deptFilter, departments]);

  // Group filtered tasks by project; unlinked tasks go under null key
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(t2 => {
      const key = t2.project_id || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t2);
    });
    // Sort: named projects alphabetically, then unlinked at end
    return [...map.entries()].sort(([a], [b]) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return (projectById[a]?.title || "").localeCompare(projectById[b]?.title || "");
    });
  }, [filtered, projectById]);

  const changeTaskStatus = (id, newStatus) => {
    const task = tasks.find(t2 => t2.id === id);
    setTasks(tasks.map(t2 => t2.id === id ? { ...t2, status: newStatus } : t2));
    if (task) toast({ message: `"${task.title}" → ${newStatus}`, type: newStatus === "Done" ? "success" : "info" });
  };

  const COLS = "32px 1fr 130px 110px 100px 90px 44px";
  const ROW_HEADERS = ["","Task","Assigned To","Status","Priority","Due",""];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>
          Tasks
          <span style={{ marginLeft:10, fontSize:14, fontWeight:500, color:t.textFaint }}>({filtered.length})</span>
        </h1>
        <div style={{ display:"flex", gap:8 }}>
          {["Global","By Department"].map(m=>(
            <button key={m} onClick={()=>setViewMode(m)} style={{...bs, background:viewMode===m?"#7C3AED":t.toggleBg, color:viewMode===m?"#fff":t.textSub, border:`1px solid ${viewMode===m?"#7C3AED":t.border2}`, padding:"7px 14px", fontSize:12}}>{m}</button>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {statuses.map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)} style={{...bs, background:statusFilter===s?t.navActive:t.toggleBg, color:statusFilter===s?t.navActiveText:t.textMuted, border:`1px solid ${statusFilter===s?t.accent:t.border}`, padding:"5px 12px", fontSize:12}}>{s}</button>
        ))}
      </div>

      {viewMode === "By Department" && (
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {["All",...departments.map(d=>d.name)].map(d=>(
            <button key={d} onClick={()=>setDeptFilter(d)} style={{...bs, padding:"5px 12px", fontSize:12, background:deptFilter===d?t.navActive:t.toggleBg, color:deptFilter===d?t.navActiveText:t.textMuted, border:`1px solid ${deptFilter===d?t.accent:t.border}`}}>{d}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:40, textAlign:"center", color:t.textFaint, fontSize:13 }}>No tasks match these filters.</div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {groups.map(([projectId, groupTasks]) => {
          const proj = projectId ? projectById[projectId] : null;
          const doneCount = groupTasks.filter(t2 => t2.status === "Done").length;
          return (
            <div key={projectId || "__none__"} style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden" }}>
              {/* Card header */}
              <div style={{ padding:"14px 18px", borderBottom:`1px solid ${t.border2}`, display:"flex", alignItems:"center", gap:12, background: proj ? proj.colour ? `${proj.colour}11` : `${t.accent}0d` : t.statBg }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, color: proj ? t.text : t.textMuted }}>
                    {proj ? proj.title : "No Project"}
                  </div>
                  {proj && (
                    <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>
                      {proj.client_id ? "" : ""}
                      {proj.stage} · {proj.status}
                    </div>
                  )}
                </div>
                <span style={{ fontSize:12, color:t.textFaint }}>{doneCount}/{groupTasks.length} done</span>
                {proj && <Badge label={proj.priority} color={priorityColor(proj.priority)} />}
              </div>

              {/* Column headers */}
              <div style={{ display:"grid", gridTemplateColumns:COLS, gap:0, padding:"8px 16px", borderBottom:`1px solid ${t.divider}` }}>
                {ROW_HEADERS.map((h,i)=>(
                  <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textGhost, letterSpacing:"0.07em", textTransform:"uppercase" }}>{h}</div>
                ))}
              </div>

              {/* Task rows */}
              {groupTasks.map(t2 => {
                const cnt = (comments||[]).filter(c=>c.entity_type==="task"&&c.entity_id===t2.id).length;
                return (
                  <div key={t2.id} style={{ display:"grid", gridTemplateColumns:COLS, gap:0, padding:"11px 16px", borderBottom:`1px solid ${t.divider}`, alignItems:"center" }}>
                    <TaskStatusButton task={t2} onStatusChange={changeTaskStatus} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:t2.status==="Done"?t.textFaint:t.textSub, textDecoration:t2.status==="Done"?"line-through":"none" }}>{t2.title}</div>
                      <div style={{ fontSize:11, color:t.textGhost }}>{t2.estimated_hours}h est.{t2.actual_hours ? ` · ${t2.actual_hours}h actual` : ""}</div>
                    </div>
                    <div style={{ fontSize:12, color:t.textMuted, display:"flex", alignItems:"center", gap:6 }}>
                      <Avatar name={t2.assigned_to?.name||"?"} size={20} />
                      {(t2.assigned_to?.name||"").split(" ")[0]}
                    </div>
                    <Badge label={t2.status} color={statusColor(t2.status)} />
                    <Badge label={t2.priority} color={priorityColor(t2.priority)} />
                    <div style={{ fontSize:11, color:t.textMuted }}>{fmtDate(t2.due_date)}</div>
                    <button onClick={()=>setCommentTask(t2)} style={{ display:"flex", alignItems:"center", gap:3, background:"transparent", border:`1px solid ${t.border2}`, borderRadius:7, padding:"3px 8px", fontSize:11, color:cnt>0?t.accent:t.textMuted, cursor:"pointer", fontWeight:cnt>0?700:400 }}>
                      💬{cnt>0?` ${cnt}`:""}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <Modal open={!!commentTask} onClose={()=>setCommentTask(null)} title={`Comments · ${commentTask?.title || ""}`}>
        {commentTask && <CommentsPanel entityType="task" entityId={commentTask.id} comments={comments||[]} setComments={setComments} currentUser={currentUser} />}
      </Modal>
    </div>
  );
})
