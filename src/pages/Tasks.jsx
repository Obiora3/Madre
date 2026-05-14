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
  const PAGE_SIZE = 25;
  const [commentTask, setCommentTask] = useState(null);
  const [viewMode, setViewMode]       = useState("Global");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter]   = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const statuses = ["All","To Do","In Progress","In Review","Done"];

  // Reset to page 1 whenever filters change
  const handleStatusFilter = (s) => { setStatusFilter(s); setCurrentPage(1); };
  const handleDeptFilter   = (d) => { setDeptFilter(d);   setCurrentPage(1); };
  const handleViewMode     = (m) => { setViewMode(m);     setCurrentPage(1); };

  const filtered = useMemo(() => {
    let result = statusFilter === "All" ? tasks : tasks.filter(t2 => t2.status === statusFilter);
    if (viewMode === "By Department" && deptFilter !== "All") {
      const dept = departments.find(d => d.name === deptFilter);
      if (dept) result = result.filter(t2 => dept.members.includes(t2.assigned_to?.email));
    }
    return result;
  }, [tasks, statusFilter, viewMode, deptFilter, departments]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const pageSlice  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const changeTaskStatus = (id, newStatus) => {
    const task = tasks.find(t2 => t2.id === id);
    setTasks(tasks.map(t2 => t2.id === id ? { ...t2, status: newStatus } : t2));
    if (task) toast({ message: `"${task.title}" → ${newStatus}`, type: newStatus === "Done" ? "success" : "info" });
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>
          Tasks
          <span style={{ marginLeft:10, fontSize:14, fontWeight:500, color:t.textFaint }}>
            ({filtered.length})
          </span>
        </h1>
        <div style={{ display:"flex", gap:8 }}>
          {["Global","By Department"].map(m=>(
            <button key={m} onClick={()=>handleViewMode(m)} style={{...bs, background:viewMode===m?"#7C3AED":t.toggleBg, color:viewMode===m?"#fff":t.textSub, border:`1px solid ${viewMode===m?"#7C3AED":t.border2}`, padding:"7px 14px", fontSize:12}}>{m}</button>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {statuses.map(s=>(
          <button key={s} onClick={()=>handleStatusFilter(s)} style={{...bs, background:statusFilter===s?t.navActive:t.toggleBg, color:statusFilter===s?t.navActiveText:t.textMuted, border:`1px solid ${statusFilter===s?t.accent:t.border}`, padding:"5px 12px", fontSize:12}}>{s}</button>
        ))}
      </div>
      {viewMode === "By Department" && (
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {["All",...departments.map(d=>d.name)].map(d=>(
            <button key={d} onClick={()=>handleDeptFilter(d)} style={{...bs, padding:"5px 12px", fontSize:12, background:deptFilter===d?t.navActive:t.toggleBg, color:deptFilter===d?t.navActiveText:t.textMuted, border:`1px solid ${deptFilter===d?t.accent:t.border}`}}>{d}</button>
          ))}
        </div>
      )}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"40px 1fr 120px 100px 100px 90px 50px", gap:0, padding:"10px 16px", borderBottom:`1px solid ${t.border2}` }}>
          {["","Task","Assigned To","Status","Priority","Due",""].map((h,i)=>(
            <div key={i} style={{ fontSize:11, fontWeight:700, color:t.textFaint, letterSpacing:"0.06em", textTransform:"uppercase" }}>{h}</div>
          ))}
        </div>
        {pageSlice.map(t2=>{
          const cnt = (comments||[]).filter(c=>c.entity_type==="task"&&c.entity_id===t2.id).length;
          const proj = projectById[t2.project_id];
          return (
            <div key={t2.id} style={{ display:"grid", gridTemplateColumns:"40px 1fr 120px 100px 100px 90px 50px", gap:0, padding:"12px 16px", borderBottom:`1px solid ${t.divider}`, alignItems:"center" }}>
              <TaskStatusButton task={t2} onStatusChange={changeTaskStatus} />
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:t2.status==="Done"?t.textFaint:t.textSub, textDecoration:t2.status==="Done"?"line-through":"none" }}>{t2.title}</div>
                <div style={{ fontSize:11, color:t.textGhost }}>
                  {proj && <span style={{ color:t.accent, fontWeight:600, marginRight:6 }}>↗ {proj.title}</span>}
                  {t2.estimated_hours}h est. · {t2.actual_hours}h actual
                </div>
              </div>
              <div style={{ fontSize:12, color:t.textMuted, display:"flex", alignItems:"center", gap:6 }}><Avatar name={t2.assigned_to?.name||"?"} size={22} />{(t2.assigned_to?.name||"").split(" ")[0]}</div>
              <Badge label={t2.status} color={statusColor(t2.status)} />
              <Badge label={t2.priority} color={priorityColor(t2.priority)} />
              <div style={{ fontSize:11, color:t.textMuted }}>{fmtDate(t2.due_date)}</div>
              <button onClick={()=>setCommentTask(t2)} style={{ display:"flex", alignItems:"center", gap:3, background:"transparent", border:`1px solid ${t.border2}`, borderRadius:7, padding:"3px 8px", fontSize:11, color:cnt>0?t.accent:t.textMuted, cursor:"pointer", fontWeight:cnt>0?700:400 }}>
                💬{cnt>0?` ${cnt}`:""}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding:32, textAlign:"center", color:t.textFaint, fontSize:13 }}>No tasks match these filters.</div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:14, padding:"0 4px" }}>
          <span style={{ fontSize:12, color:t.textFaint }}>
            Showing {(safePage-1)*PAGE_SIZE+1}–{Math.min(safePage*PAGE_SIZE, filtered.length)} of {filtered.length} tasks
          </span>
          <div style={{ display:"flex", gap:4 }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              style={{...bs, padding:"5px 10px", fontSize:12, opacity: safePage===1 ? 0.4 : 1}}
            >«</button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p-1))}
              disabled={safePage === 1}
              style={{...bs, padding:"5px 10px", fontSize:12, opacity: safePage===1 ? 0.4 : 1}}
            >‹</button>
            {Array.from({ length: totalPages }, (_, i) => i+1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx-1] > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) => item === "…"
                ? <span key={`ellipsis-${i}`} style={{ padding:"5px 8px", color:t.textFaint, fontSize:12 }}>…</span>
                : <button key={item} onClick={() => setCurrentPage(item)}
                    style={{...bs, padding:"5px 10px", fontSize:12,
                      background: item===safePage ? "#7C3AED" : t.toggleBg,
                      color:      item===safePage ? "#fff"    : t.textSub,
                      border:     `1px solid ${item===safePage ? "#7C3AED" : t.border2}`
                    }}>{item}</button>
              )
            }
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))}
              disabled={safePage === totalPages}
              style={{...bs, padding:"5px 10px", fontSize:12, opacity: safePage===totalPages ? 0.4 : 1}}
            >›</button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              style={{...bs, padding:"5px 10px", fontSize:12, opacity: safePage===totalPages ? 0.4 : 1}}
            >»</button>
          </div>
        </div>
      )}

      <Modal open={!!commentTask} onClose={()=>setCommentTask(null)} title={`Comments · ${commentTask?.title || ""}`}>
        {commentTask && <CommentsPanel entityType="task" entityId={commentTask.id} comments={comments||[]} setComments={setComments} currentUser={currentUser} />}
      </Modal>
    </div>
  );
})
