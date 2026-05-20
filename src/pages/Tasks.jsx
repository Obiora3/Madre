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
  canDeleteTasksForRole,
  calcProgress,
  fmtDate,
  isTaskComplete,
  priorityColor,
  removeTaskAndReferences,
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
  const { tasks, setTasks, projects, setProjects, departments, comments, setComments, currentUser, users, logActivity, nav } = useApp();
  const projectById = useMemo(() => Object.fromEntries((projects||[]).map(p => [p.id, p])), [projects]);
  const { theme: t } = useTheme();
  const toast = useToast();
  const bs = mkBtnSecondary(t);
  const [commentTask, setCommentTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [viewMode, setViewMode]       = useState("All");
  const [stageCollapsed, setStageCollapsed] = useState({});
  const toggleStageCollapse = (key) => setStageCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter]   = useState("All");
  const statuses = ["All","To Do","In Progress","In Review","Done"];
  const kanbanStatuses = ["To Do","In Progress","In Review","Done"];
  const canDeleteTasks = canDeleteTasksForRole(currentUser?.role);

  const filtered = useMemo(() => {
    let result = statusFilter === "All" ? tasks : tasks.filter(t2 => t2.status === statusFilter);
    if (viewMode === "By Department" && deptFilter !== "All") {
      const dept = departments.find(d => d.name === deptFilter);
      if (dept) result = result.filter(t2 => dept.members.includes(t2.assigned_to?.email));
    }
    return result;
  }, [tasks, statusFilter, viewMode, deptFilter, departments]);

  // Group filtered tasks by their project's current stage
  const STAGE_ORDER = ["Brief","Strategy","Creative","Concept","Design","Development","Production","Review","Delivery","Delivered"];
  const stageGroups = useMemo(() => {
    const map = new Map();
    filtered.forEach(t2 => {
      const proj = t2.project_id ? projectById[t2.project_id] : null;
      const stage = proj?.stage || "No Stage";
      if (!map.has(stage)) map.set(stage, []);
      map.get(stage).push(t2);
    });
    return [...map.entries()].sort(([a], [b]) => {
      const ai = STAGE_ORDER.indexOf(a);
      const bi = STAGE_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [filtered, projectById]);

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
    const nextTasks = tasks.map(t2 => t2.id === id ? { ...t2, status: newStatus } : t2);
    setTasks(nextTasks);
    if (task?.project_id) {
      setProjects(projects.map(p => p.id === task.project_id ? { ...p, progress:calcProgress(p.id, nextTasks) } : p));
    }
    if (task) toast({ message: `"${task.title}" → ${newStatus}`, type: isTaskComplete({ ...task, status:newStatus }) ? "success" : "info" });
  };

  const deleteTask = (task) => {
    if (!task) return;
    if (!canDeleteTasks) {
      toast({ message:"Task delete blocked", sub:"Only managers and above can delete tasks.", type:"warning" });
      return;
    }
    const nextTasks = removeTaskAndReferences(tasks, task.id);
    setTasks(nextTasks);
    if (task.project_id) {
      setProjects(projects.map(p => p.id === task.project_id ? { ...p, progress:calcProgress(p.id, nextTasks) } : p));
    }
    setComments((comments || []).filter(c => !(c.entity_type === "task" && c.entity_id === task.id)));
    logActivity({ userName: currentUser?.name, eventType: "deleted", entityType: "task", entityId: task.id, entityTitle: task.title });
    toast({ message:`"${task.title}" deleted`, sub:"Task removed permanently", type:"warning" });
    if (commentTask?.id === task.id) setCommentTask(null);
  };

  const TABLE_GAP = 14;
  const TABLE_MIN_WIDTH = canDeleteTasks ? 880 : 810;
  const COLS = canDeleteTasks
    ? "32px minmax(220px, 1fr) 140px 130px 118px 110px 64px 54px"
    : "32px minmax(220px, 1fr) 140px 130px 118px 110px 54px";
  const ROW_HEADERS = canDeleteTasks ? ["","Task","Assigned To","Status","Priority","Due","",""] : ["","Task","Assigned To","Status","Priority","Due",""];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>
          Tasks
          <span style={{ marginLeft:10, fontSize:14, fontWeight:500, color:t.textFaint }}>({filtered.length})</span>
        </h1>
        <div style={{ display:"flex", gap:8 }}>
          {["All","Kanban","By Stage","By Department"].map(m=>(
            <button key={m} onClick={()=>setViewMode(m)} style={{...bs, background:viewMode===m?"#7C3AED":t.toggleBg, color:viewMode===m?"#fff":t.textSub, border:`1px solid ${viewMode===m?"#7C3AED":t.border2}`, padding:"7px 14px", fontSize:12}}>{m}</button>
          ))}
        </div>
      </div>

      {viewMode !== "Kanban" && viewMode !== "By Stage" && (
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {statuses.map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} style={{...bs, background:statusFilter===s?t.navActive:t.toggleBg, color:statusFilter===s?t.navActiveText:t.textMuted, border:`1px solid ${statusFilter===s?t.accent:t.border}`, padding:"5px 12px", fontSize:12}}>{s}</button>
          ))}
        </div>
      )}

      {viewMode === "By Department" && (
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {["All",...departments.map(d=>d.name)].map(d=>(
            <button key={d} onClick={()=>setDeptFilter(d)} style={{...bs, padding:"5px 12px", fontSize:12, background:deptFilter===d?t.navActive:t.toggleBg, color:deptFilter===d?t.navActiveText:t.textMuted, border:`1px solid ${deptFilter===d?t.accent:t.border}`}}>{d}</button>
          ))}
        </div>
      )}

      {viewMode === "Kanban" ? (
        /* ── Kanban: swimlanes by project, columns by status ─────────────── */
        <div style={{ overflowX:"auto" }}>
          {/* Column headers */}
          <div style={{ display:"grid", gridTemplateColumns:`180px repeat(${kanbanStatuses.length}, minmax(180px, 1fr))`, gap:8, marginBottom:8, minWidth:780 }}>
            <div />
            {kanbanStatuses.map(status => (
              <div key={status} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:statusColor(status), flexShrink:0 }} />
                <span style={{ fontSize:11, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{status}</span>
              </div>
            ))}
          </div>
          {/* Swimlane rows */}
          {groups.map(([projectId, groupTasks]) => {
            const proj = projectId ? projectById[projectId] : null;
            return (
              <div key={projectId||"__none__"} style={{ display:"grid", gridTemplateColumns:`180px repeat(${kanbanStatuses.length}, minmax(180px, 1fr))`, gap:8, marginBottom:16, minWidth:780, alignItems:"start" }}>
                {/* Project label */}
                <div style={{ paddingTop:4, paddingRight:8 }}>
                  <div onClick={proj ? ()=>nav("project-detail", proj.id) : undefined} style={{ fontSize:12, fontWeight:800, color: proj ? t.accent : t.textMuted, lineHeight:1.3, cursor: proj ? "pointer" : "default", textDecoration: proj ? "underline" : "none", textDecorationColor: proj ? `${t.accent}66` : "transparent" }}>{proj ? proj.title : "No Project"}</div>
                  {proj && <div style={{ fontSize:10, color:t.textFaint, marginTop:2 }}>{proj.stage} · {proj.status}</div>}
                </div>
                {/* Status columns */}
                {kanbanStatuses.map(status => {
                  const col = status;
                  const cc = statusColor(status);
                  const colTasks = groupTasks.filter(t2 => t2.status === col);
                  return (
                    <div key={col} style={{ background:t.statBg, borderRadius:10, padding:8, minHeight:60 }}>
                      {colTasks.map(t2 => {
                        const subs    = t2.subtasks || [];
                        const cnt     = (comments||[]).filter(c=>c.entity_type==="task"&&c.entity_id===t2.id).length;
                        const blocked = (t2.blocked_by||[]).some(depId => { const dep = tasks.find(x=>x.id===depId); return dep && !isTaskComplete(dep); });
                        return (
                          <div key={t2.id} style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:8, padding:10, marginBottom:6 }}>
                            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:4, marginBottom:5 }}>
                              <span style={{ fontSize:12, fontWeight:700, color:isTaskComplete(t2)?t.textFaint:t.text, lineHeight:1.35, textDecoration:isTaskComplete(t2)?"line-through":"none", flex:1 }}>{t2.title}</span>
                              {blocked && <span title="Blocked" style={{ fontSize:12, flexShrink:0 }}>🔒</span>}
                              {canDeleteTasks && (
                                <button onClick={()=>setTaskToDelete(t2)} title="Delete task" aria-label={`Delete ${t2.title}`} style={{ background:"transparent", border:"none", color:"#EF4444", cursor:"pointer", fontSize:15, lineHeight:1, padding:"0 2px", flexShrink:0 }}>x</button>
                              )}
                            </div>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                                <Avatar name={t2.assigned_to?.name||"?"} size={16} />
                                <span style={{ fontSize:10, color:t.textMuted }}>{(t2.assigned_to?.name||"").split(" ")[0]||"?"}</span>
                              </div>
                              <Badge label={t2.priority} color={priorityColor(t2.priority)} />
                            </div>
                            {subs.length > 0 && (
                              <div style={{ marginTop:6 }}>
                                <div style={{ height:3, borderRadius:99, background:t.toggleBg }}>
                                  <div style={{ height:"100%", borderRadius:99, width:`${Math.round((subs.filter(s=>s.done).length/subs.length)*100)}%`, background:cc }} />
                                </div>
                                <div style={{ fontSize:10, color:t.textGhost, marginTop:2 }}>{subs.filter(s=>s.done).length}/{subs.length} subtasks</div>
                              </div>
                            )}
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:6 }}>
                              <span style={{ fontSize:10, color:t.textGhost }}>{fmtDate(t2.due_date)}</span>
                              <button onClick={()=>setCommentTask(t2)} style={{ background:"transparent", border:`1px solid ${t.border2}`, borderRadius:5, padding:"1px 6px", fontSize:10, color:cnt>0?t.accent:t.textMuted, cursor:"pointer", fontWeight:cnt>0?700:400 }}>
                                💬{cnt>0?` ${cnt}`:""}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {colTasks.length === 0 && (
                        <div style={{ border:`1px dashed ${t.border2}`, borderRadius:8, padding:"12px 8px", textAlign:"center", color:t.textGhost, fontSize:11 }}>—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : viewMode === "By Stage" ? (
        /* ── By Stage: collapsible grouped table ───────────────────────────── */
        <div>
          {stageGroups.length === 0 && (
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:40, textAlign:"center", color:t.textFaint, fontSize:13 }}>No tasks match these filters.</div>
          )}
          {stageGroups.map(([stage, stageTasks]) => {
            const color = stageColor(stage) || t.border2;
            const collapsed = stageCollapsed[stage];
            const COLS = "32px 1fr 160px 150px 120px 110px 110px" + (canDeleteTasks ? " 72px" : "");
            const headers = ["", "Task", "Project", "Assigned To", "Status", "Priority", "Due Date", ...(canDeleteTasks ? [""] : [])];
            return (
              <div key={stage} style={{ marginBottom:18 }}>
                {/* Group header */}
                <div
                  onClick={() => toggleStageCollapse(stage)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", cursor:"pointer", borderLeft:`4px solid ${color}`, borderRadius:"4px 0 0 4px", userSelect:"none" }}
                >
                  <span style={{ fontSize:10, color:t.textGhost, width:10, flexShrink:0 }}>{collapsed ? "▶" : "▼"}</span>
                  <span style={{ fontSize:14, fontWeight:800, color }}>{stage}</span>
                  <span style={{ fontSize:12, color:t.textFaint, fontWeight:500 }}>{stageTasks.length} task{stageTasks.length !== 1 ? "s" : ""}</span>
                </div>

                {!collapsed && (
                  <div style={{ borderLeft:`4px solid ${color}`, overflowX:"auto" }}>
                    {/* Column headers */}
                    <div style={{ display:"grid", gridTemplateColumns:COLS, columnGap:12, padding:"7px 14px", background:t.statBg, borderBottom:`1px solid ${t.border2}`, minWidth:820 }}>
                      {headers.map((h, i) => (
                        <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textGhost, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>
                      ))}
                    </div>

                    {/* Task rows */}
                    {stageTasks.map(t2 => {
                      const proj = t2.project_id ? projectById[t2.project_id] : null;
                      const cnt = (comments||[]).filter(c => c.entity_type==="task" && c.entity_id===t2.id).length;
                      const blocked = (t2.blocked_by||[]).some(depId => { const dep = tasks.find(x => x.id===depId); return dep && !isTaskComplete(dep); });
                      const done = isTaskComplete(t2);
                      return (
                        <div key={t2.id} style={{ display:"grid", gridTemplateColumns:COLS, columnGap:12, padding:"10px 14px", borderBottom:`1px solid ${t.divider}`, alignItems:"center", minWidth:820, background:t.card }}>
                          <TaskStatusButton task={t2} onStatusChange={changeTaskStatus} />
                          <div style={{ minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                              <span style={{ fontSize:13, fontWeight:600, color:done?t.textFaint:t.textSub, textDecoration:done?"line-through":"none" }}>{t2.title}</span>
                              {blocked && <Badge label="🔒" color="#EF4444" />}
                              {cnt > 0 && <span style={{ fontSize:10, color:t.accent, fontWeight:700 }}>💬 {cnt}</span>}
                            </div>
                          </div>
                          <div style={{ minWidth:0 }}>
                            {proj
                              ? <span onClick={() => nav("project-detail", proj.id)} style={{ fontSize:12, color:t.accent, fontWeight:600, cursor:"pointer", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{proj.title}</span>
                              : <span style={{ fontSize:12, color:t.textGhost }}>—</span>}
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
                            {t2.assigned_to?.name
                              ? <><Avatar name={t2.assigned_to.name} size={20} /><span style={{ fontSize:12, color:t.textMuted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t2.assigned_to.name.split(" ")[0]}</span></>
                              : <span style={{ fontSize:12, color:t.textGhost }}>—</span>}
                          </div>
                          <Badge label={t2.status} color={statusColor(t2.status)} />
                          <Badge label={t2.priority} color={priorityColor(t2.priority)} />
                          <span style={{ fontSize:12, color:t.textFaint }}>{t2.due_date ? fmtDate(t2.due_date) : "—"}</span>
                          {canDeleteTasks && (
                            <button onClick={() => setTaskToDelete(t2)} style={{ background:"transparent", border:"1px solid #EF444466", borderRadius:6, padding:"3px 8px", fontSize:11, color:"#EF4444", cursor:"pointer" }}>Delete</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Global / By Department: grouped by project ────────────────────── */
        <>
          {filtered.length === 0 && (
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:40, textAlign:"center", color:t.textFaint, fontSize:13 }}>No tasks match these filters.</div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {groups.map(([projectId, groupTasks]) => {
          const proj = projectId ? projectById[projectId] : null;
          const doneCount = groupTasks.filter(t2 => isTaskComplete(t2)).length;
          return (
            <div key={projectId || "__none__"} style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflowX:"auto", overflowY:"hidden" }}>
              {/* Card header */}
              <div style={{ padding:"14px 18px", borderBottom:`1px solid ${t.border2}`, display:"flex", alignItems:"center", gap:12, background: proj ? proj.colour ? `${proj.colour}11` : `${t.accent}0d` : t.statBg }}>
                <div style={{ flex:1 }}>
                  <div onClick={proj ? ()=>nav("project-detail", proj.id) : undefined} style={{ fontSize:14, fontWeight:800, color: proj ? t.accent : t.textMuted, cursor: proj ? "pointer" : "default", textDecoration: proj ? "underline" : "none", textDecorationColor: proj ? `${t.accent}66` : "transparent" }}>
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
              <div style={{ display:"grid", gridTemplateColumns:COLS, columnGap:TABLE_GAP, minWidth:TABLE_MIN_WIDTH, padding:"8px 16px", borderBottom:`1px solid ${t.divider}` }}>
                {ROW_HEADERS.map((h,i)=>(
                  <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textGhost, letterSpacing:"0.07em", textTransform:"uppercase" }}>{h}</div>
                ))}
              </div>

              {/* Task rows */}
              {groupTasks.map(t2 => {
                const cnt = (comments||[]).filter(c=>c.entity_type==="task"&&c.entity_id===t2.id).length;
                const subs = t2.subtasks||[];
                const blocked = (t2.blocked_by||[]).some(depId => { const dep = tasks.find(x=>x.id===depId); return dep && !isTaskComplete(dep); });
                return (
                  <div key={t2.id} style={{ display:"grid", gridTemplateColumns:COLS, columnGap:TABLE_GAP, minWidth:TABLE_MIN_WIDTH, padding:"11px 16px", borderBottom:`1px solid ${t.divider}`, alignItems:"center" }}>
                    <TaskStatusButton task={t2} onStatusChange={changeTaskStatus} />
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                        <span style={{ fontSize:13, fontWeight:600, color:isTaskComplete(t2)?t.textFaint:t.textSub, textDecoration:isTaskComplete(t2)?"line-through":"none" }}>{t2.title}</span>
                        {t2.recurrence && t2.recurrence !== "none" && <span title={`Repeats ${t2.recurrence}`} style={{ fontSize:11 }}>🔄</span>}
                        {blocked && <Badge label="🔒" color="#EF4444" />}
                      </div>
                      <div style={{ fontSize:11, color:t.textGhost }}>
                        {t2.estimated_hours}h est.{t2.actual_hours ? ` · ${t2.actual_hours}h logged` : ""}
                        {subs.length > 0 ? ` · ${subs.filter(s=>s.done).length}/${subs.length} subtasks` : ""}
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:t.textMuted, display:"flex", alignItems:"center", gap:6 }}>
                      <Avatar name={t2.assigned_to?.name||"?"} size={20} />
                      {(t2.assigned_to?.name||"").split(" ")[0]}
                    </div>
                    <Badge label={t2.status} color={statusColor(t2.status)} />
                    <Badge label={t2.priority} color={priorityColor(t2.priority)} />
                    <div style={{ fontSize:11, color:t.textMuted }}>{fmtDate(t2.due_date)}</div>
                    {canDeleteTasks && (
                      <button onClick={()=>setTaskToDelete(t2)} title="Delete task" style={{ background:"transparent", border:"1px solid #EF444466", borderRadius:7, padding:"3px 7px", fontSize:11, color:"#EF4444", cursor:"pointer" }}>Delete</button>
                    )}
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
    </>
  )}

      <Modal open={!!commentTask} onClose={()=>setCommentTask(null)} title={`Comments · ${commentTask?.title || ""}`}>
        {commentTask && <CommentsPanel entityType="task" entityId={commentTask.id} comments={comments||[]} setComments={setComments} currentUser={currentUser} users={users} />}
      </Modal>

      <ConfirmModal
        open={!!taskToDelete}
        onClose={()=>setTaskToDelete(null)}
        onConfirm={()=>deleteTask(taskToDelete)}
        title={`Delete "${taskToDelete?.title || "this task"}"?`}
        message="This will permanently remove the task, its comments, and any blocker references from other tasks."
        confirmLabel="Delete Task"
      />
    </div>
  );
})
