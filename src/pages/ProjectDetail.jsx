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

// ─── PROJECT DETAIL ───────────────────────────────────────────────────────────
export const ProjectDetail = React.memo(function ProjectDetail() {
  const { projects, setProjects, tasks, setTasks, kpis, clients, users, departments, nav, pageParam: id } = useApp();
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
      assigned_to_name: project.assigned_to?.name || "",
      assigned_to_email: project.assigned_to?.email || "",
      start_date: project.start_date || "",
      due_date: project.due_date || "",
      progress: project.progress ?? 0,
      kpi_summary: project.kpi_summary || "",
    });
    setShowEditForm(true);
  };

  const handleEditSave = () => {
    if (!editForm?.title?.trim()) { toast({ message: "Title is required.", type: "error" }); return; }
    const { assigned_to_name, assigned_to_email, ...rest } = editForm;
    setProjects(projects.map(p => p.id === id ? { ...project, ...rest, assigned_to: { name: assigned_to_name, email: assigned_to_email } } : p));
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
    setTasks([...tasks, { ...taskForm, id: "t"+Date.now(), project_id: id, assigned_to: assignedTo }]);
    toast({ message: `Task "${taskForm.title}" added`, sub: `${taskForm.priority} priority · Due ${fmtDate(taskForm.due_date)}`, type: "success" });
    setShowTaskForm(false);
    setTaskForm({ title:"", description:"", status:"To Do", priority:"Medium", due_date:"", estimated_hours:0 });
    setTaskAssigneeKey("");
  };
  const changeTaskStatus = (tid, newStatus) => {
    const task = tasks.find(t2 => t2.id === tid);
    setTasks(tasks.map(t2 => t2.id === tid ? { ...t2, status: newStatus } : t2));
    if (task) toast({ message: `"${task.title}" → ${newStatus}`, type: newStatus === "Done" ? "success" : "info" });
  };
  const simulateAI = async () => {
    setAiLoading(true); setAiResult(""); setAiError(null);
    try {
      const result = await callClaude(
        `Analyze this project and provide a critical path delay simulation:\n\nProject: ${project.title}\nStage: ${project.stage}\nProgress: ${project.progress}%\nDue: ${project.due_date}\nTasks: ${projectTasks.map(t2=>`${t2.title} (${t2.status}, due ${t2.due_date})`).join("; ")}\n\nGive a brief risk assessment and 2-3 recommendations.`,
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
          {[["Assigned","👤",project.assigned_to?.name||"—"],["Start","📅",fmtDate(project.start_date)],["Due","🗓",fmtDate(project.due_date)],["Progress","📈",`${project.progress}%`]].map(([l,i,v])=>(
            <div key={l} style={{ background:t.statBg, borderRadius:10, padding:"10px 14px" }}>
              <div style={{ fontSize:11, color:t.textFaint, marginBottom:4 }}>{i} {l}</div>
              <div style={{ fontSize:14, fontWeight:700, color:t.textSub }}>{v}</div>
            </div>
          ))}
        </div>
        <ProgressBar value={project.progress} color="#7C3AED" height={8} />
      </div>
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ margin:0, color:t.text, fontSize:15, fontWeight:700 }}>Tasks ({projectTasks.length})</h3>
          <button onClick={()=>setShowTaskForm(true)} style={{...btnPrimary, padding:"7px 14px", fontSize:12}}>+ Add Task</button>
        </div>
        {projectTasks.map(t2=>(
          <div key={t2.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${t.divider}` }}>
            <TaskStatusButton task={t2} onStatusChange={changeTaskStatus} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color: t2.status==="Done"?t.textFaint:t.textSub, textDecoration:t2.status==="Done"?"line-through":"none" }}>{t2.title}</div>
              <div style={{ fontSize:11, color:t.textFaint }}>Due {fmtDate(t2.due_date)} · {t2.estimated_hours}h est.</div>
            </div>
            <Badge label={t2.status} color={statusColor(t2.status)} />
            <Badge label={t2.priority} color={priorityColor(t2.priority)} />
          </div>
        ))}
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
            <FormField label="Progress (%)">
              <input type="number" min="0" max="100" style={iS} value={editForm.progress} onChange={e=>setEditForm({...editForm,progress:Math.min(100,Math.max(0,Number(e.target.value)))})} />
            </FormField>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label="Assigned To (name)"><input style={iS} value={editForm.assigned_to_name} onChange={e=>setEditForm({...editForm,assigned_to_name:e.target.value})} /></FormField>
            <FormField label="Assigned To (email)"><input style={iS} value={editForm.assigned_to_email} onChange={e=>setEditForm({...editForm,assigned_to_email:e.target.value})} /></FormField>
          </div>
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
