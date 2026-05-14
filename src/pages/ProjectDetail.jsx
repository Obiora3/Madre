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

// ─── PROJECT DETAIL ───────────────────────────────────────────────────────────
export const ProjectDetail = React.memo(function ProjectDetail() {
  const { projects, setProjects, tasks, setTasks, kpis, clients, users, departments, comments, setComments, currentUser, nav, pageParam: id } = useApp();
  const onBack = () => nav("projects");
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const project = projects.find(p => p.id === id);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title:"", description:"", status:"To Do", priority:"Medium", due_date:"", estimated_hours:0 });
  const [taskAssigneeKey, setTaskAssigneeKey] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiError, setAiError] = useState(null);
  const [commentTask, setCommentTask] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState(null);
  const [editTaskAssigneeKey, setEditTaskAssigneeKey] = useState("");
  const taskCommentCount = (tid) => (comments || []).filter(c => c.entity_type === "task" && c.entity_id === tid).length;

  if (!project) return <div style={{color:t.textMuted,padding:40}}>Project not found.</div>;
  const client = clients.find(c => c.id === project.client_id);
  const projectTasks = tasks.filter(t2 => t2.project_id === id);
  const projectKPIs = kpis.filter(k => k.project_id === id);

  const openEdit = () => {
    setEditForm({
      title: project.title || "",
      client_id: project.client_id || "",
      description: project.description || "",
      stage: project.stage || "Brief",
      priority: project.priority || "Medium",
      status: project.status || "Active",
      assigneeId: users.find(u => u.email === project.assigned_to?.email || u.name === project.assigned_to?.name)?.id || "",
      start_date: project.start_date || "",
      due_date: project.due_date || "",
      progress: project.progress ?? 0,
      kpi_summary: project.kpi_summary || "",
    });
    setShowEditForm(true);
  };

  const handleEditSave = () => {
    if (!editForm?.title?.trim()) { toast({ message: "Title is required.", type: "error" }); return; }
    const { assigneeId, ...rest } = editForm;
    const assignee = assigneeId ? users.find(u => u.id === assigneeId) : null;
    setProjects(projects.map(p => p.id === id ? { ...project, ...rest, assigned_to: assignee ? { name: assignee.name, email: assignee.email } : {} } : p));
    toast({ message: "Project updated." });
    setShowEditForm(false);
  };

  const handleAddTask = () => {
    let assignedTo = {};
    if (taskAssigneeKey.startsWith("user:")) {
      const u = users.find(x => x.id === taskAssigneeKey.slice(5));
      if (u) assignedTo = { name: u.name, email: u.email, department: u.department || "" };
    } else if (taskAssigneeKey.startsWith("dept:")) {
      const d = departments.find(x => x.id === taskAssigneeKey.slice(5));
      if (d) assignedTo = { name: d.name, email: "" };
    }
    const newTasks = [...tasks, { ...taskForm, id: "t"+Date.now(), project_id: id, assigned_to: assignedTo }];
    setTasks(newTasks);
    setProjects(projects.map(p => p.id === id ? { ...p, progress: calcProgress(id, newTasks) } : p));
    toast({ message: `Task "${taskForm.title}" added`, sub: `${taskForm.priority} priority · Due ${fmtDate(taskForm.due_date)}`, type: "success" });
    setShowTaskForm(false);
    setTaskForm({ title:"", description:"", status:"To Do", priority:"Medium", due_date:"", estimated_hours:0 });
    setTaskAssigneeKey("");
  };
  const openEditTask = (task) => {
    const assignee = task.assigned_to;
    let key = "";
    if (assignee?.email) {
      const u = users.find(x => x.email === assignee.email);
      if (u) key = `user:${u.id}`;
    } else if (assignee?.name) {
      const d = departments.find(x => x.name === assignee.name);
      if (d) key = `dept:${d.id}`;
    }
    setEditTaskAssigneeKey(key);
    setEditTaskForm({ title: task.title||"", description: task.description||"", status: task.status||"To Do", priority: task.priority||"Medium", due_date: task.due_date||"", estimated_hours: task.estimated_hours||0 });
    setEditTask(task);
  };

  const handleEditTaskSave = () => {
    if (!editTaskForm?.title?.trim()) { toast({ message: "Title is required.", type: "error" }); return; }
    let assignedTo = editTask.assigned_to || {};
    if (editTaskAssigneeKey.startsWith("user:")) {
      const u = users.find(x => x.id === editTaskAssigneeKey.slice(5));
      if (u) assignedTo = { name: u.name, email: u.email, department: u.department || "" };
    } else if (editTaskAssigneeKey.startsWith("dept:")) {
      const d = departments.find(x => x.id === editTaskAssigneeKey.slice(5));
      if (d) assignedTo = { name: d.name, email: "" };
    } else {
      assignedTo = {};
    }
    const newTasks = tasks.map(t2 => t2.id === editTask.id ? { ...t2, ...editTaskForm, assigned_to: assignedTo } : t2);
    setTasks(newTasks);
    setProjects(projects.map(p => p.id === id ? { ...p, progress: calcProgress(id, newTasks) } : p));
    toast({ message: `Task "${editTaskForm.title}" updated.` });
    setEditTask(null); setEditTaskForm(null);
  };

  const changeTaskStatus = (tid, newStatus) => {
    const task = tasks.find(t2 => t2.id === tid);
    const newTasks = tasks.map(t2 => t2.id === tid ? { ...t2, status: newStatus } : t2);
    setTasks(newTasks);
    setProjects(projects.map(p => p.id === id ? { ...p, progress: calcProgress(id, newTasks) } : p));
    if (task) toast({ message: `"${task.title}" → ${newStatus}`, type: newStatus === "Done" ? "success" : "info" });
  };
  const simulateAI = async () => {
    setAiLoading(true); setAiResult(""); setAiError(null);
    try {
      const result = await callClaude(
        `Analyze this project and provide a critical path delay simulation:\n\nProject: ${project.title}\nStage: ${project.stage}\nProgress: ${calcProgress(id, tasks)}%\nDue: ${project.due_date}\nTasks: ${projectTasks.map(t2=>`${t2.title} (${t2.status}, due ${t2.due_date})`).join("; ")}\n\nGive a brief risk assessment and 2-3 recommendations.`,
        "You are a project management AI. Be concise and specific."
      );
      setAiResult(result);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <button onClick={onBack} style={{...bs, fontSize:12}}>← Back to Projects</button>
        <button onClick={openEdit} style={{...bs, fontSize:12}}>✏ Edit Project</button>
      </div>
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:24, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <h1 style={{ margin:"0 0 6px", fontSize:22, fontWeight:800, color:t.text }}>{project.title}</h1>
            <div style={{ color:t.textMuted, fontSize:13 }}>{client?.name}{project.description ? ` · ${project.description}` : ""}</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Badge label={project.stage} color={stageColor(project.stage)} />
            <Badge label={project.priority} color={priorityColor(project.priority)} />
            <Badge label={project.status} color={statusColor(project.status)} />
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:16 }}>
          {[["Assigned","👤",project.assigned_to?.name||"—"],["Start","📅",fmtDate(project.start_date)],["Due","🗓",fmtDate(project.due_date)],["Progress","📈",`${calcProgress(id, tasks)}%`]].map(([l,i,v])=>(
            <div key={l} style={{ background:t.statBg, borderRadius:10, padding:"10px 14px" }}>
              <div style={{ fontSize:11, color:t.textFaint, marginBottom:4 }}>{i} {l}</div>
              <div style={{ fontSize:14, fontWeight:700, color:t.textSub }}>{v}</div>
            </div>
          ))}
        </div>
        <ProgressBar value={calcProgress(id, tasks)} color="#7C3AED" height={8} />
      </div>
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ margin:0, color:t.text, fontSize:15, fontWeight:700 }}>Tasks ({projectTasks.length})</h3>
          <button onClick={()=>setShowTaskForm(true)} style={{...btnPrimary, padding:"7px 14px", fontSize:12}}>+ Add Task</button>
        </div>
        {projectTasks.map(t2=>{
          const cnt = taskCommentCount(t2.id);
          return (
            <div key={t2.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${t.divider}` }}>
              <TaskStatusButton task={t2} onStatusChange={changeTaskStatus} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color: t2.status==="Done"?t.textFaint:t.textSub, textDecoration:t2.status==="Done"?"line-through":"none" }}>{t2.title}</div>
                <div style={{ fontSize:11, color:t.textFaint }}>Due {fmtDate(t2.due_date)} · {t2.estimated_hours}h est.</div>
              </div>
              <Badge label={t2.status} color={statusColor(t2.status)} />
              <Badge label={t2.priority} color={priorityColor(t2.priority)} />
              <button onClick={()=>setCommentTask(t2)} style={{ display:"flex", alignItems:"center", gap:4, background:"transparent", border:`1px solid ${t.border2}`, borderRadius:7, padding:"3px 9px", fontSize:11, color:cnt>0?t.accent:t.textMuted, cursor:"pointer", fontWeight:cnt>0?700:400 }}>
                💬 {cnt > 0 ? cnt : ""}
              </button>
              <button onClick={()=>openEditTask(t2)} style={{ background:"transparent", border:`1px solid ${t.border2}`, borderRadius:7, padding:"3px 9px", fontSize:11, color:t.textMuted, cursor:"pointer" }}>✏</button>
            </div>
          );
        })}
      </div>
      {projectKPIs.length > 0 && (
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:20 }}>
          <h3 style={{ margin:"0 0 14px", color:t.text, fontSize:15, fontWeight:700 }}>KPI Performance</h3>
          {projectKPIs.map(k=>(
            <div key={k.id} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600, color:t.textSub }}>{k.name}</span>
                <Badge label={k.status} color={statusColor(k.status)} />
              </div>
              <ProgressBar value={k.current_value} max={k.target_value} color={statusColor(k.status)} height={6} />
              <div style={{ fontSize:11, color:t.textFaint, marginTop:3 }}>{k.current_value.toLocaleString()} {k.unit} / {k.target_value.toLocaleString()} {k.unit} target</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ background:t.card, border:`1px solid ${t.accent}44`, borderRadius:14, padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <h3 style={{ margin:0, color:t.text, fontSize:15, fontWeight:700 }}>🤖 AI Critical Path Analysis</h3>
          <button onClick={simulateAI} style={btnPrimary} disabled={aiLoading}>{aiLoading ? "Analysing…" : "Run Analysis"}</button>
        </div>
        <AIBlock loading={aiLoading} error={aiError} result={aiResult} placeholder='Click "Run Analysis" to simulate delay impact and get AI recommendations.' onRetry={simulateAI} />
      </div>
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginTop:20 }}>
        <h3 style={{ margin:"0 0 14px", color:t.text, fontSize:15, fontWeight:700 }}>💬 Project Discussion</h3>
        <CommentsPanel entityType="project" entityId={id} comments={comments||[]} setComments={setComments} currentUser={currentUser} users={users} />
      </div>

      <Modal open={!!commentTask} onClose={()=>setCommentTask(null)} title={`Comments · ${commentTask?.title || ""}`}>
        {commentTask && <CommentsPanel entityType="task" entityId={commentTask.id} comments={comments||[]} setComments={setComments} currentUser={currentUser} users={users} />}
      </Modal>

      {editTaskForm && (
        <Modal open={!!editTask} onClose={()=>{setEditTask(null);setEditTaskForm(null);}} title="Edit Task">
          <FormField label="Title"><input style={iS} value={editTaskForm.title} onChange={e=>setEditTaskForm({...editTaskForm,title:e.target.value})} /></FormField>
          <FormField label="Assign To">
            <select style={sS} value={editTaskAssigneeKey} onChange={e=>setEditTaskAssigneeKey(e.target.value)}>
              <option value="">Unassigned</option>
              {users.length > 0 && <optgroup label="Team Members">{users.map(u=><option key={u.id} value={`user:${u.id}`}>{u.name}{u.department?` (${u.department})`:""}</option>)}</optgroup>}
              {departments.length > 0 && <optgroup label="Departments">{departments.map(d=><option key={d.id} value={`dept:${d.id}`}>{d.name}</option>)}</optgroup>}
            </select>
          </FormField>
          <FormField label="Description"><input style={iS} value={editTaskForm.description} onChange={e=>setEditTaskForm({...editTaskForm,description:e.target.value})} /></FormField>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label="Status"><select style={sS} value={editTaskForm.status} onChange={e=>setEditTaskForm({...editTaskForm,status:e.target.value})}>{["To Do","In Progress","In Review","Done"].map(s=><option key={s}>{s}</option>)}</select></FormField>
            <FormField label="Priority"><select style={sS} value={editTaskForm.priority} onChange={e=>setEditTaskForm({...editTaskForm,priority:e.target.value})}>{["Critical","High","Medium","Low"].map(s=><option key={s}>{s}</option>)}</select></FormField>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label="Due Date"><input type="date" style={iS} value={editTaskForm.due_date} onChange={e=>setEditTaskForm({...editTaskForm,due_date:e.target.value})} /></FormField>
            <FormField label="Est. Hours"><input type="number" style={iS} value={editTaskForm.estimated_hours} onChange={e=>setEditTaskForm({...editTaskForm,estimated_hours:Number(e.target.value)})} /></FormField>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={bs} onClick={()=>{setEditTask(null);setEditTaskForm(null);}}>Cancel</button>
            <button style={btnPrimary} onClick={handleEditTaskSave} disabled={!editTaskForm.title}>Save Changes</button>
          </div>
        </Modal>
      )}

      <Modal open={showTaskForm} onClose={()=>setShowTaskForm(false)} title="Add Task">
        <FormField label="Title"><input style={iS} value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} /></FormField>
        <FormField label="Assign To">
          <select style={sS} value={taskAssigneeKey} onChange={e=>setTaskAssigneeKey(e.target.value)}>
            <option value="">Unassigned</option>
            {users.length > 0 && <optgroup label="Team Members">{users.map(u=><option key={u.id} value={`user:${u.id}`}>{u.name}{u.department?` (${u.department})`:""}</option>)}</optgroup>}
            {departments.length > 0 && <optgroup label="Departments">{departments.map(d=><option key={d.id} value={`dept:${d.id}`}>{d.name}</option>)}</optgroup>}
          </select>
        </FormField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FormField label="Status"><select style={sS} value={taskForm.status} onChange={e=>setTaskForm({...taskForm,status:e.target.value})}>{["To Do","In Progress","In Review","Done"].map(s=><option key={s}>{s}</option>)}</select></FormField>
          <FormField label="Priority"><select style={sS} value={taskForm.priority} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})}>{["Critical","High","Medium","Low"].map(s=><option key={s}>{s}</option>)}</select></FormField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FormField label="Due Date"><input type="date" style={iS} value={taskForm.due_date} onChange={e=>setTaskForm({...taskForm,due_date:e.target.value})} /></FormField>
          <FormField label="Est. Hours"><input type="number" style={iS} value={taskForm.estimated_hours} onChange={e=>setTaskForm({...taskForm,estimated_hours:Number(e.target.value)})} /></FormField>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={bs} onClick={()=>setShowTaskForm(false)}>Cancel</button>
          <button style={btnPrimary} onClick={handleAddTask} disabled={!taskForm.title}>Add Task</button>
        </div>
      </Modal>

      {editForm && (
        <Modal open={showEditForm} onClose={()=>setShowEditForm(false)} title="Edit Project">
          <FormField label="Title"><input style={iS} value={editForm.title} onChange={e=>setEditForm({...editForm,title:e.target.value})} /></FormField>
          <FormField label="Client">
            <select style={sS} value={editForm.client_id} onChange={e=>setEditForm({...editForm,client_id:e.target.value})}>
              <option value="">No client</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Description"><input style={iS} value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})} /></FormField>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label="Stage">
              <select style={sS} value={editForm.stage} onChange={e=>setEditForm({...editForm,stage:e.target.value})}>
                {["Brief","Strategy","Creative","Review","Delivered"].map(s=><option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Priority">
              <select style={sS} value={editForm.priority} onChange={e=>setEditForm({...editForm,priority:e.target.value})}>
                {["Critical","High","Medium","Low"].map(s=><option key={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label="Status">
              <select style={sS} value={editForm.status} onChange={e=>setEditForm({...editForm,status:e.target.value})}>
                {["Active","On Hold","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Progress">
              <div style={{ ...iS, display:"flex", alignItems:"center", gap:8, cursor:"default" }}>
                <span style={{ fontWeight:700 }}>{calcProgress(id, tasks)}%</span>
                <span style={{ fontSize:11, opacity:0.6 }}>auto · from tasks</span>
              </div>
            </FormField>
          </div>
          <FormField label="Assign To">
            <select style={sS} value={editForm.assigneeId} onChange={e=>setEditForm({...editForm,assigneeId:e.target.value})}>
              <option value="">Unassigned</option>
              {users.map(u=><option key={u.id} value={u.id}>{u.name}{u.department?` · ${u.department}`:""}</option>)}
            </select>
          </FormField>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label="Start Date"><input type="date" style={iS} value={editForm.start_date} onChange={e=>setEditForm({...editForm,start_date:e.target.value})} /></FormField>
            <FormField label="Due Date"><input type="date" style={iS} value={editForm.due_date} onChange={e=>setEditForm({...editForm,due_date:e.target.value})} /></FormField>
          </div>
          <FormField label="KPI Summary"><input style={iS} value={editForm.kpi_summary} onChange={e=>setEditForm({...editForm,kpi_summary:e.target.value})} placeholder="Brief summary of KPI targets" /></FormField>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={bs} onClick={()=>setShowEditForm(false)}>Cancel</button>
            <button style={btnPrimary} onClick={handleEditSave} disabled={!editForm.title}>Save Changes</button>
          </div>
        </Modal>
      )}
    </div>
  );
})
