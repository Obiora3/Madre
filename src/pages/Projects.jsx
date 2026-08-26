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
  calcProgress,
  DEFAULT_PROJECT_PIPELINE_ID,
  fmtDate,
  getProjectPipeline,
  getTaskPipelines,
  mapStatusToPipeline,
  priorityColor,
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
import { sendAssignmentEmail } from "../lib/assignmentNotifications.js";

const BLANK_FORM = { title:"", client_id:"", description:"", stage:"Brief", priority:"Medium", pipeline_id:DEFAULT_PROJECT_PIPELINE_ID, assigneeId:"", start_date:"", due_date:"", status:"Active", progress:0, kpi_summary:"", budget:0, budget_spent:0 };

const CURRENCY_SYMBOLS = { USD:"$", GBP:"£", EUR:"€", AUD:"A$", NGN:"₦", CAD:"C$" };

// Solid-fill pill (vs. the app-wide outline Badge) - matches the monday.com-style
// reference for Status/Priority/Timeline cells in the grouped table below.
function SolidPill({ label, color, style }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", background:color, color:"#fff", borderRadius:6, padding:"4px 10px", fontSize:11.5, fontWeight:700, whiteSpace:"nowrap", minWidth:0, ...style }}>
      {label}
    </span>
  );
}

// ─── LIST VIEW (grouped-by-stage table, monday.com-style per reference) ───────
function ListView({ projects, tasks, clients, projectPipelines, boardStages, projectStageForBoard, CS, theme:t, nav, onDelete, onAddInStage, isMobile }) {
  const [collapsed, setCollapsed] = useState({});
  const toggleGroup = (label) => setCollapsed(c => ({ ...c, [label]: !c[label] }));

  if (isMobile) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {projects.length === 0 ? (
          <div style={{ padding:"36px 0", textAlign:"center", color:t.textFaint, fontSize:13 }}>No projects match the current filter.</div>
        ) : projects.map(p => {
          const client = clients.find(c => c.id === p.client_id);
          const pipeline = getProjectPipeline(p, projectPipelines);
          const sColor = pipeline.statuses.find(s=>s.label===p.stage)?.color || "#6B7280";
          const progress = calcProgress(p.id, tasks);
          const taskCount = tasks.filter(t2=>t2.project_id===p.id).length;
          return (
            <div key={p.id} onClick={() => nav("project-detail", p.id)} style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:16, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, color:t.text, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                  <div style={{ fontSize:12, color:t.textMuted, marginTop:2 }}>{client?.name || "No client"}</div>
                </div>
                <div style={{ display:"flex", gap:4, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                  <button onClick={() => onDelete(p)} style={{ background:"none", border:"none", color:t.textGhost, cursor:"pointer", fontSize:16, padding:"2px 4px" }}>×</button>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                <span style={{ fontSize:11, fontWeight:700, color:sColor, background:`${sColor}18`, border:`1px solid ${sColor}44`, borderRadius:6, padding:"2px 8px" }}>{p.stage}</span>
                <Badge label={p.status} color={statusColor(p.status)} />
                <Badge label={p.priority} color={priorityColor(p.priority)} />
              </div>
              <ProgressBar value={progress} color={sColor} height={5} />
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
                <span style={{ fontSize:11, color:t.textMuted }}>{progress}% · {taskCount} task{taskCount!==1?"s":""}</span>
                <span style={{ fontSize:11, color:t.textFaint }}>{p.due_date ? `Due ${fmtDate(p.due_date)}` : "No due date"}</span>
              </div>
              {p.assigned_to?.name && (
                <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8, paddingTop:8, borderTop:`1px solid ${t.divider}` }}>
                  <Avatar name={p.assigned_to.name} size={18} />
                  <span style={{ fontSize:12, color:t.textMuted }}>{p.assigned_to.name}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {boardStages.map(stage => {
        const stageProjects = projects.filter(p => projectStageForBoard(p) === stage.label);
        const isCollapsed = !!collapsed[stage.label];
        return (
          <div key={stage.id}>
            <button
              onClick={() => toggleGroup(stage.label)}
              style={{ display:"flex", alignItems:"center", gap:7, width:"100%", background:"transparent", border:"none", cursor:"pointer", padding:"2px 4px 8px", textAlign:"left" }}
            >
              <span style={{ fontSize:11, color:stage.color, transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)", transition:"transform 0.15s", display:"inline-block" }}>▾</span>
              <span style={{ fontSize:15, fontWeight:800, color:stage.color }}>{stage.label}</span>
              <span style={{ fontSize:12, color:t.textFaint }}>{stageProjects.length}</span>
            </button>
            {!isCollapsed && (
              <div style={{ display:"flex", border:`1px solid ${t.border2}`, borderRadius:10, overflow:"hidden" }}>
                <div style={{ width:4, flexShrink:0, background:stage.color }} />
                <div style={{ flex:1, overflowX:"auto", minWidth:0 }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr>
                        <th style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:t.textGhost, letterSpacing:"0.06em", background:t.statBg, minWidth:220 }}>PROJECT</th>
                        <th style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:t.textGhost, letterSpacing:"0.06em", background:t.statBg, minWidth:150 }}>OWNER</th>
                        <th style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:t.textGhost, letterSpacing:"0.06em", background:t.statBg, minWidth:110 }}>STATUS</th>
                        <th style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:t.textGhost, letterSpacing:"0.06em", background:t.statBg, minWidth:100 }}>PRIORITY</th>
                        <th style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:t.textGhost, letterSpacing:"0.06em", background:t.statBg, minWidth:170 }}>TIMELINE</th>
                        <th style={{ padding:"9px 12px", background:t.statBg, width:44 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {stageProjects.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding:"18px 12px", textAlign:"center", color:t.textFaint, fontSize:12 }}>No projects in this stage.</td></tr>
                      ) : stageProjects.map((p, i) => {
                        const client = clients.find(c => c.id === p.client_id);
                        const rowBg = i % 2 === 0 ? t.card : t.statBg;
                        const timeline = p.start_date && p.due_date ? `${fmtDate(p.start_date)} – ${fmtDate(p.due_date)}`
                          : p.due_date ? `Due ${fmtDate(p.due_date)}` : "—";
                        return (
                          <tr
                            key={p.id}
                            onClick={() => nav("project-detail", p.id)}
                            style={{ cursor:"pointer", background:rowBg, transition:"background 0.1s" }}
                            onMouseEnter={e=>e.currentTarget.style.background=`${t.accent}10`}
                            onMouseLeave={e=>e.currentTarget.style.background=rowBg}
                          >
                            <td style={{ padding:"11px 12px", borderBottom:`1px solid ${t.divider}` }}>
                              <div style={{ fontWeight:700, color:t.text, lineHeight:1.3 }}>{p.title}</div>
                              <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>{client?.name || "No client"}</div>
                            </td>
                            <td style={{ padding:"11px 12px", borderBottom:`1px solid ${t.divider}` }}>
                              {p.assigned_to?.name ? (
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <Avatar name={p.assigned_to.name} size={22} />
                                  <span style={{ fontSize:12, color:t.textMuted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:90 }}>{p.assigned_to.name}</span>
                                </div>
                              ) : <span style={{ color:t.textGhost, fontSize:12 }}>—</span>}
                            </td>
                            <td style={{ padding:"11px 12px", borderBottom:`1px solid ${t.divider}` }}>
                              <SolidPill label={p.status} color={statusColor(p.status)} />
                            </td>
                            <td style={{ padding:"11px 12px", borderBottom:`1px solid ${t.divider}` }}>
                              <SolidPill label={p.priority} color={priorityColor(p.priority)} />
                            </td>
                            <td style={{ padding:"11px 12px", borderBottom:`1px solid ${t.divider}` }}>
                              <SolidPill label={timeline} color={t.mode === "dark" ? "#2A2A3D" : "#1F2430"} style={{ borderRadius:99, padding:"4px 12px" }} />
                            </td>
                            <td style={{ padding:"11px 12px", borderBottom:`1px solid ${t.divider}` }} onClick={e=>e.stopPropagation()}>
                              <button
                                onClick={() => onDelete(p)}
                                title="Delete project"
                                style={{ background:"none", border:"none", color:t.textGhost, cursor:"pointer", fontSize:16, padding:"2px 6px", borderRadius:4 }}
                              >×</button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr>
                        <td colSpan={6} style={{ padding:0, borderBottom:"none" }}>
                          <button
                            onClick={() => onAddInStage(stage.label)}
                            style={{ display:"block", width:"100%", textAlign:"left", background:"transparent", border:"none", cursor:"pointer", padding:"9px 12px", color:t.textMuted, fontSize:12.5, fontWeight:600 }}
                          >
                            + Add project
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
export const Projects = React.memo(function Projects() {
  const { projects, setProjects, tasks, setTasks, kpis, setKpis, clients, users, nav, whiteLabelSettings, currentUser, logActivity, isMobile } = useApp();
  const CS = CURRENCY_SYMBOLS[whiteLabelSettings?.currency] || "₦";
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const projectPipelines = useMemo(() => getTaskPipelines(whiteLabelSettings), [whiteLabelSettings]);
  const [viewMode, setViewMode] = useState(() => isMobile ? "list" : "board"); // "board" | "list"
  const [filter, setFilter] = useState("All");
  const [pipelineFilter, setPipelineFilter] = useState(DEFAULT_PROJECT_PIPELINE_ID);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const boardPipeline = getProjectPipeline({ pipeline_id:pipelineFilter }, projectPipelines);
  const boardStages = boardPipeline.statuses;
  const selectedPipeline = getProjectPipeline({ pipeline_id: form.pipeline_id }, projectPipelines);
  const priorities = ["All", "Critical", "High", "Medium", "Low"];
  const filtered = projects.filter(p => (filter === "All" || p.priority === filter) && (p.pipeline_id || DEFAULT_PROJECT_PIPELINE_ID) === pipelineFilter);
  const projectStageForBoard = (p) => boardStages.some(stage => stage.label === p.stage) ? p.stage : boardStages[0]?.label;

  const handleCreate = () => {
    const { assigneeId, ...rest } = form;
    const assignee = assigneeId ? users.find(u => u.id === assigneeId) : null;
    const np = { ...rest, id: "p"+Date.now(), assigned_to: assignee ? { name: assignee.name, email: assignee.email } : {} };
    const client = clients.find(c => c.id === np.client_id);
    setProjects([...projects, np]);
    logActivity({ userName: currentUser?.name, eventType: "created", entityType: "project", entityId: np.id, entityTitle: np.title });
    toast({ message: `Project "${form.title}" created`, sub: `${form.stage} · ${form.priority} priority`, type: "success" });
    if (whiteLabelSettings?.assignment_email_alerts !== false && np.assigned_to?.email) {
      sendAssignmentEmail({
        kind: "project_assigned",
        project: { ...np, client_name: client?.name },
        assignedEmail: np.assigned_to.email,
        actorName: currentUser?.name,
      }).then((result) => {
        toast({ message: "Assignment email sent", sub: `${result.recipientCount || 1} recipient(s)`, type: "success" });
      }).catch((error) => {
        toast({ message: "Assignment email failed", sub: error.message, type: "warning" });
      });
    }
    setShowForm(false);
    setForm(BLANK_FORM);
  };

  const advanceStage = (e, p) => {
    e.stopPropagation();
    const stages = getProjectPipeline(p, projectPipelines).statuses.map(stage => stage.label);
    const currentStage = stages.includes(p.stage) ? p.stage : stages[0];
    const idx = stages.indexOf(currentStage);
    if (idx < 0 || idx >= stages.length - 1) return;
    const nextStage = stages[idx + 1];
    setProjects(projects.map(x => x.id === p.id ? { ...x, stage: nextStage } : x));
    toast({ message: `"${p.title}" moved to ${nextStage}` });
  };

  // "+ Add project" row inside a stage group (List view) - opens the create form pre-filled with that stage.
  const openAddInStage = (stageLabel) => {
    setForm({ ...BLANK_FORM, stage: stageLabel, pipeline_id: pipelineFilter });
    setShowForm(true);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 24, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: t.text }}>Projects</h1>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          {/* View toggle */}
          <div style={{ display:"flex", gap:3, background:t.statBg, borderRadius:8, padding:3 }}>
            {[["board","⊞ Board"],["list","☰ List"]].map(([id,label]) => (
              <button key={id} onClick={()=>setViewMode(id)} style={{ ...bs, padding:"5px 14px", fontSize:12, fontWeight:700, background:viewMode===id?t.card:"transparent", color:viewMode===id?t.text:t.textMuted, border:`1px solid ${viewMode===id?t.border2:"transparent"}`, borderRadius:6, boxShadow:viewMode===id?"0 1px 4px rgba(0,0,0,0.07)":"none" }}>{label}</button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)} style={btnPrimary}>+ New Project</button>
        </div>
      </div>

      {/* Priority filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {priorities.map(p => (
          <button key={p} onClick={() => setFilter(p)} style={{ ...bs, background: filter===p?"#7C3AED":t.toggleBg, color: filter===p?"#fff":t.textSub, border: `1px solid ${filter===p?"#7C3AED":t.border2}`, padding: "6px 14px", fontSize: 12 }}>{p}</button>
        ))}
      </div>

      {/* Pipeline filter - drives grouping in both Board and List views */}
      <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:11, fontWeight:700, color:t.textGhost, letterSpacing:"0.06em", textTransform:"uppercase" }}>Pipeline</span>
        {projectPipelines.map(pipeline => {
          const count = projects.filter(p => (p.pipeline_id || DEFAULT_PROJECT_PIPELINE_ID) === pipeline.id).length;
          return (
            <button key={pipeline.id} onClick={()=>setPipelineFilter(pipeline.id)} style={{ ...bs, background:pipelineFilter===pipeline.id?t.navActive:t.toggleBg, color:pipelineFilter===pipeline.id?t.navActiveText:t.textMuted, border:`1px solid ${pipelineFilter===pipeline.id?t.accent:t.border2}`, padding:"6px 12px", fontSize:12 }}>
              {pipeline.name} <span style={{ opacity:0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Board view ── */}
      {viewMode === "board" && (
        <div style={{ overflowX:"auto", width:"100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${boardStages.length}, minmax(220px, 1fr))`, gap: 14, minWidth:`${boardStages.length * 234}px` }}>
          {boardStages.map((stage, stageIdx) => (
            <div key={stage.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{stage.label}</span>
                {stageIdx < boardStages.length - 1 && <span style={{ fontSize: 10, color: t.textGhost }}>→</span>}
                <span style={{ marginLeft: "auto", fontSize: 11, color: t.textFaint }}>{filtered.filter(p=>projectStageForBoard(p)===stage.label).length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.filter(p => projectStageForBoard(p) === stage.label).map(p => {
                  const client = clients.find(c => c.id === p.client_id);
                  const pipeline = getProjectPipeline(p, projectPipelines);
                  const projectStages = pipeline.statuses.map(item => item.label);
                  const currentStage = projectStages.includes(p.stage) ? p.stage : projectStages[0];
                  const nextStage = projectStages[projectStages.indexOf(currentStage) + 1];
                  return (
                    <div key={p.id} onClick={() => nav("project-detail", p.id)} style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 12, padding: 14, cursor: "pointer", position:"relative" }}>
                      <button onClick={e => { e.stopPropagation(); setConfirmDelete(p); }} title="Delete project" style={{ position:"absolute", top:8, right:8, background:"none", border:"none", color:t.textGhost, cursor:"pointer", fontSize:15, lineHeight:1, padding:"1px 4px", borderRadius:4 }}>×</button>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6, lineHeight: 1.3, paddingRight: 16 }}>{p.title}</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                        <Badge label={pipeline.name} color={pipeline.statuses[0]?.color || t.accent} />
                      </div>
                      <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 8 }}>{client?.name || "—"}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <Badge label={p.priority} color={priorityColor(p.priority)} />
                        <Badge label={p.status} color={statusColor(p.status)} />
                      </div>
                      <ProgressBar value={calcProgress(p.id, tasks)} color={stage.color} />
                      <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>{calcProgress(p.id, tasks)}% · {fmtDate(p.due_date)}</div>
                      {p.budget > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", marginTop:7, padding:"5px 8px", background:t.statBg, borderRadius:6 }}>
                          <span style={{ fontSize:10, color:t.textFaint }}>Budget</span>
                          <span style={{ fontSize:10, fontWeight:700, color: p.budget_spent > p.budget ? "#EF4444" : t.textSub }}>
                            {CS}{((p.budget_spent||0)/1_000_000).toFixed(2)}M <span style={{ fontWeight:400, color:t.textGhost }}>/ {CS}{((p.budget||0)/1_000_000).toFixed(2)}M</span>
                          </span>
                        </div>
                      )}
                      {nextStage && (
                        <button onClick={e => advanceStage(e, p)} style={{ display:"block", width:"100%", marginTop:8, background:t.accent+"18", border:`1px solid ${t.accent}33`, color:t.accent, borderRadius:6, padding:"4px 0", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                          → Move to {nextStage}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      {/* ── List view (grouped-by-stage table) ── */}
      {viewMode === "list" && (
        <ListView
          projects={filtered}
          tasks={tasks}
          clients={clients}
          projectPipelines={projectPipelines}
          boardStages={boardStages}
          projectStageForBoard={projectStageForBoard}
          CS={CS}
          theme={t}
          nav={nav}
          onDelete={setConfirmDelete}
          onAddInStage={openAddInStage}
          isMobile={isMobile}
        />
      )}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Project">
        <FormField label="Title"><input style={iS} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Project title" /></FormField>
        <FormField label="Client">
          <select style={sS} value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}>
            <option value="">Select client</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Stage">
          <select style={sS} value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>
            {selectedPipeline.statuses.map(s=><option key={s.id} value={s.label}>{s.label}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select style={sS} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
            {["Critical","High","Medium","Low"].map(s=><option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Project Pipeline">
          <select style={sS} value={form.pipeline_id} onChange={e=>{
            const pipeline_id = e.target.value;
            setForm({...form,pipeline_id,stage:mapStatusToPipeline(form.stage,{ pipeline_id },projectPipelines)});
          }}>
            {projectPipelines.map(pipeline => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
          </select>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:7 }}>
            {selectedPipeline.statuses.map(status => (
              <span key={status.id} style={{ fontSize:10, fontWeight:700, color:status.color, border:`1px solid ${status.color}44`, background:`${status.color}12`, borderRadius:99, padding:"2px 7px" }}>{status.label}</span>
            ))}
          </div>
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Start Date"><input type="date" style={iS} value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} /></FormField>
          <FormField label="Due Date"><input type="date" style={iS} value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} /></FormField>
        </div>
        <FormField label="Assign To">
          <select style={sS} value={form.assigneeId} onChange={e=>setForm({...form,assigneeId:e.target.value})}>
            <option value="">Unassigned</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.name}{u.department?` · ${u.department}`:""}</option>)}
          </select>
        </FormField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FormField label={`Budget (${CS})`}>
            <input type="number" min="0" style={iS} value={form.budget||""} onChange={e=>setForm({...form,budget:parseFloat(e.target.value)||0})} placeholder="e.g. 5000000 for 5M" />
            {form.budget > 0 && <div style={{ fontSize:11, color:"#7C3AED", marginTop:3 }}>= {CS}{(form.budget/1_000_000).toFixed(2)}M</div>}
          </FormField>
          <FormField label={`Budget Spent (${CS})`}>
            <input type="number" min="0" style={iS} value={form.budget_spent||""} onChange={e=>setForm({...form,budget_spent:parseFloat(e.target.value)||0})} placeholder="e.g. 2500000 for 2.5M" />
            {form.budget_spent > 0 && <div style={{ fontSize:11, color: form.budget > 0 && form.budget_spent > form.budget ? "#EF4444" : "#059669", marginTop:3 }}>= {CS}{(form.budget_spent/1_000_000).toFixed(2)}M{form.budget > 0 && form.budget_spent > form.budget ? " · over budget" : ""}</div>}
          </FormField>
        </div>
        <FormField label="Description"><textarea style={{...iS,height:80,resize:"vertical"}} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></FormField>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button style={bs} onClick={()=>setShowForm(false)}>Cancel</button>
          <button style={btnPrimary} onClick={handleCreate} disabled={!form.title}>Create Project</button>
        </div>
      </Modal>
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          setTasks(tasks.map(t => t.project_id === confirmDelete.id ? { ...t, project_id: "" } : t));
          setKpis((kpis || []).map(k => k.project_id === confirmDelete.id ? { ...k, project_id: "" } : k));
          setProjects(projects.filter(p => p.id !== confirmDelete.id));
          logActivity({ userName: currentUser?.name, eventType: "deleted", entityType: "project", entityId: confirmDelete.id, entityTitle: confirmDelete.title });
          toast({ message: `"${confirmDelete.title}" deleted`, sub: "Project removed permanently", type: "warning" });
        }}
        title={`Delete "${confirmDelete?.title}"?`}
        message={`This will permanently remove the project and cannot be undone. Associated tasks and KPIs will remain but lose their project link.`}
        confirmLabel="Delete Project"
      />
    </div>
  );
})
