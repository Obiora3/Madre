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
import { sendAssignmentEmail } from "../lib/assignmentNotifications.js";

// ─── TASK TEMPLATES ───────────────────────────────────────────────────────────
const TASK_TEMPLATES = [
  { name:"Social Media Campaign", icon:"📱", tasks:[
    { title:"Brief & Strategy",       priority:"High",   description:"Define campaign goals and target audience" },
    { title:"Content Calendar",        priority:"High",   description:"Plan post schedule and themes" },
    { title:"Creative Assets",         priority:"Medium", description:"Design graphics and write copy" },
    { title:"Scheduling & Publishing", priority:"Medium", description:"Schedule posts across platforms" },
    { title:"Performance Review",      priority:"Low",    description:"Analyse engagement and results" },
  ]},
  { name:"Brand Identity", icon:"🎨", tasks:[
    { title:"Discovery & Research",  priority:"High",   description:"Competitive analysis and brand audit" },
    { title:"Concept Development",   priority:"High",   description:"Create brand concepts and moodboards" },
    { title:"Logo Design",           priority:"High",   description:"Design primary and secondary logo variants" },
    { title:"Brand Guidelines",      priority:"Medium", description:"Document colors, fonts and usage rules" },
    { title:"Asset Delivery",        priority:"Low",    description:"Export final files in all required formats" },
  ]},
  { name:"Website Launch", icon:"🌐", tasks:[
    { title:"Sitemap & Wireframes", priority:"High",   description:"Plan site structure and page layouts" },
    { title:"Design Mockups",       priority:"High",   description:"Design key pages in high fidelity" },
    { title:"Development",          priority:"High",   description:"Build and code the website" },
    { title:"Content Population",   priority:"Medium", description:"Add all copy, images and media" },
    { title:"QA & Testing",         priority:"Medium", description:"Test across devices and browsers" },
    { title:"Launch & Handover",    priority:"Low",    description:"Deploy and hand over to client" },
  ]},
  { name:"Content Strategy", icon:"📝", tasks:[
    { title:"Audience Research",  priority:"High",   description:"Define audience personas and pain points" },
    { title:"Content Audit",      priority:"Medium", description:"Review existing content performance" },
    { title:"Editorial Plan",     priority:"High",   description:"Define topics, formats and cadence" },
    { title:"Content Production", priority:"Medium", description:"Write and design content pieces" },
    { title:"Distribution Plan",  priority:"Low",    description:"Define channels and promotion strategy" },
  ]},
];

const KANBAN_COLS = ["To Do","In Progress","In Review","Done"];
const uniqueEmails = (items) => [...new Set(items.filter(email => /\S+@\S+\.\S+/.test(String(email || ""))))];

// ─── PROJECT DETAIL ───────────────────────────────────────────────────────────
export const ProjectDetail = React.memo(function ProjectDetail() {
  const { projects, setProjects, tasks, setTasks, kpis, clients, users, departments, comments, setComments, currentUser, nav, pageParam: id, whiteLabelSettings, logActivity } = useApp();
  const CS = ({ USD:"$", GBP:"£", EUR:"€", AUD:"A$", NGN:"₦", CAD:"C$" })[whiteLabelSettings?.currency] || "$";
  const onBack = () => nav("projects");
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const project = projects.find(p => p.id === id);
  const canDeleteTasks = canDeleteTasksForRole(currentUser?.role);

  // ── Task form state ─────────────────────────────────────────────────────────
  const [showTaskForm, setShowTaskForm] = useState(false);
  const BLANK_TASK = { title:"", description:"", status:"To Do", priority:"Medium", due_date:"", estimated_hours:0, actual_hours:0, subtasks:[], recurrence:"none", blocked_by:[] };
  const [taskForm, setTaskForm] = useState(BLANK_TASK);
  const [taskAssigneeKey, setTaskAssigneeKey] = useState("");

  // ── Project edit state ──────────────────────────────────────────────────────
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState(null);

  // ── AI state ────────────────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiError, setAiError] = useState(null);

  // ── Task comment / edit state ───────────────────────────────────────────────
  const [commentTask, setCommentTask] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState(null);
  const [editTaskAssigneeKey, setEditTaskAssigneeKey] = useState("");
  const [taskToDelete, setTaskToDelete] = useState(null);

  // ── Subtask / time / template state ────────────────────────────────────────
  const [expanded, setExpanded]       = useState(new Set());
  const [subtaskInput, setSubtaskInput] = useState({});
  const [logTimeTask, setLogTimeTask] = useState(null);
  const [logHours, setLogHours]       = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  // ── View mode (list vs kanban) ──────────────────────────────────────────────
  const [taskView, setTaskView] = useState("list");

  // ── Milestones ──────────────────────────────────────────────────────────────
  const [milestones, setMilestones] = useState(() => project?.milestones || []);
  const [newMsTitle, setNewMsTitle] = useState("");
  const [newMsDate, setNewMsDate]   = useState("");

  // Sync milestones if project changes (e.g. after save)
  useEffect(() => {
    setMilestones(project?.milestones || []);
  }, [project?.id]);

  const saveMilestones = (ms) => {
    setMilestones(ms);
    setProjects(projects.map(p => p.id === id ? { ...p, milestones: ms } : p));
  };
  const addMilestone = () => {
    if (!newMsTitle.trim()) return;
    const ms = { id:`ms${Date.now()}`, title:newMsTitle.trim(), date:newMsDate, done:false };
    saveMilestones([...milestones, ms]);
    logActivity({ userName: currentUser?.name, eventType: "milestone_added", entityType: "project", entityId: id, entityTitle: ms.title });
    setNewMsTitle(""); setNewMsDate("");
  };
  const toggleMs   = (msId) => saveMilestones(milestones.map(m => m.id===msId ? {...m, done:!m.done} : m));
  const deleteMs   = (msId) => saveMilestones(milestones.filter(m => m.id!==msId));

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const taskCommentCount = (tid) => (comments || []).filter(c => c.entity_type === "task" && c.entity_id === tid).length;
  const toggleExpand = (tid) => setExpanded(prev => { const n = new Set(prev); n.has(tid) ? n.delete(tid) : n.add(tid); return n; });
  const isBlocked    = (task) => (task.blocked_by||[]).some(depId => { const dep = tasks.find(t2 => t2.id === depId); return dep && dep.status !== "Done"; });
  const departmentMemberEmails = (departmentName) => {
    const dept = departments.find(d => d.name === departmentName);
    if (!dept) return [];
    return uniqueEmails(dept.members || []);
  };
  const departmentMemberUsers = (departmentName) => {
    const emails = departmentMemberEmails(departmentName);
    return emails.map(email => users.find(u => u.email === email) || { email, name: "" });
  };
  const emailTaskAssignment = (task, previousAssignee = {}) => {
    if (!task) return;
    if (whiteLabelSettings?.assignment_email_alerts === false) return;
    const client = clients.find(c => c.id === project.client_id);
    const directEmail = task.assigned_to?.email || "";
    const departmentUsers = directEmail ? [] : departmentMemberUsers(task.assigned_to?.name);
    const departmentEmails = departmentUsers.map(member => member.email);
    const recipients = directEmail ? [directEmail] : departmentEmails;

    if (recipients.length === 0) {
      if (task.assigned_to?.name) {
        toast({ message: "Assignment email not sent", sub: "No department members with email addresses were found.", type: "warning" });
      }
      return;
    }

    if (!directEmail && previousAssignee?.name === task.assigned_to?.name) return;
    if (directEmail && previousAssignee?.email === directEmail) return;

    sendAssignmentEmail({
      kind: "task_assigned",
      task,
      project: { ...project, client_name: client?.name },
      assignedEmail: directEmail || recipients[0],
      emailRecipients: recipients,
      recipientUsers: directEmail ? [task.assigned_to] : departmentUsers,
      actorName: currentUser?.name,
    }).then((result) => {
      toast({ message: "Assignment email sent", sub: `${result.recipientCount || recipients.length} recipient(s)`, type: "success" });
    }).catch((error) => {
      toast({ message: "Assignment email failed", sub: error.message, type: "warning" });
    });
  };
  const addSubtask   = (taskId, title) => setTasks(tasks.map(t2 => t2.id === taskId ? { ...t2, subtasks:[...(t2.subtasks||[]),{id:`st${Date.now()}`,title,done:false}] } : t2));
  const toggleSubtask = (taskId, stId) => setTasks(tasks.map(t2 => t2.id === taskId ? { ...t2, subtasks:(t2.subtasks||[]).map(s=>s.id===stId?{...s,done:!s.done}:s) } : t2));
  const deleteSubtask = (taskId, stId) => setTasks(tasks.map(t2 => t2.id === taskId ? { ...t2, subtasks:(t2.subtasks||[]).filter(s=>s.id!==stId) } : t2));

  const applyTemplate = (tmpl) => {
    const now = Date.now();
    const newTasks = tmpl.tasks.map((tpl, i) => ({ id:`t${now+i}`, ...tpl, status:"To Do", project_id:id, assigned_to:{}, due_date:"", estimated_hours:0, actual_hours:0, subtasks:[], recurrence:"none", blocked_by:[], created_at:new Date().toISOString() }));
    const all = [...tasks, ...newTasks];
    setTasks(all);
    setProjects(projects.map(p => p.id === id ? { ...p, progress: calcProgress(id, all) } : p));
    toast({ message:`${newTasks.length} tasks added from "${tmpl.name}"`, type:"success" });
  };

  if (!project) return <div style={{color:t.textMuted,padding:40}}>Project not found.</div>;
  const client      = clients.find(c => c.id === project.client_id);
  const projectTasks = tasks.filter(t2 => t2.project_id === id);
  const projectKPIs  = kpis.filter(k => k.project_id === id);

  // ── Project edit ─────────────────────────────────────────────────────────────
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
      budget: project.budget || 0,
      budget_spent: project.budget_spent || 0,
    });
    setShowEditForm(true);
  };

  const handleEditSave = () => {
    if (!editForm?.title?.trim()) { toast({ message:"Title is required.", type:"error" }); return; }
    const { assigneeId, ...rest } = editForm;
    const assignee = assigneeId ? users.find(u => u.id === assigneeId) : null;
    const assignedTo = assignee ? { name:assignee.name, email:assignee.email } : {};
    const updatedProject = { ...project, ...rest, milestones, assigned_to: assignedTo };
    setProjects(projects.map(p => p.id === id ? updatedProject : p));
    toast({ message:"Project updated." });
    if (
      whiteLabelSettings?.assignment_email_alerts !== false &&
      assignedTo.email &&
      assignedTo.email !== project.assigned_to?.email
    ) {
      const client = clients.find(c => c.id === updatedProject.client_id);
      sendAssignmentEmail({
        kind: "project_assigned",
        project: { ...updatedProject, client_name: client?.name },
        assignedEmail: assignedTo.email,
        actorName: currentUser?.name,
      }).then((result) => {
        toast({ message: "Assignment email sent", sub: `${result.recipientCount || 1} recipient(s)`, type: "success" });
      }).catch((error) => {
        toast({ message: "Assignment email failed", sub: error.message, type: "warning" });
      });
    }
    setShowEditForm(false);
  };

  // ── Task CRUD ─────────────────────────────────────────────────────────────────
  const handleAddTask = () => {
    let assignedTo = {};
    if (taskAssigneeKey.startsWith("user:")) {
      const u = users.find(x => x.id === taskAssigneeKey.slice(5));
      if (u) assignedTo = { name:u.name, email:u.email, department:u.department||"" };
    } else if (taskAssigneeKey.startsWith("dept:")) {
      const d = departments.find(x => x.id === taskAssigneeKey.slice(5));
      if (d) assignedTo = { name:d.name, email:"" };
    }
    const newTask = { ...taskForm, id:"t"+Date.now(), project_id:id, assigned_to:assignedTo, created_at:new Date().toISOString() };
    const newTasks = [...tasks, newTask];
    setTasks(newTasks);
    setProjects(projects.map(p => p.id === id ? { ...p, progress:calcProgress(id, newTasks) } : p));
    logActivity({ userName: currentUser?.name, eventType: "task_added", entityType: "task", entityId: newTask.id, entityTitle: taskForm.title });
    toast({ message:`Task "${taskForm.title}" added`, sub:`${taskForm.priority} priority · Due ${fmtDate(taskForm.due_date)}`, type:"success" });
    emailTaskAssignment(newTask);
    setShowTaskForm(false); setTaskForm(BLANK_TASK); setTaskAssigneeKey("");
  };

  const openEditTask = (task) => {
    const assignee = task.assigned_to;
    let key = "";
    if (assignee?.email) { const u = users.find(x => x.email === assignee.email); if (u) key = `user:${u.id}`; }
    else if (assignee?.name) { const d = departments.find(x => x.name === assignee.name); if (d) key = `dept:${d.id}`; }
    setEditTaskAssigneeKey(key);
    setEditTaskForm({ title:task.title||"", description:task.description||"", status:task.status||"To Do", priority:task.priority||"Medium", due_date:task.due_date||"", estimated_hours:task.estimated_hours||0, actual_hours:task.actual_hours||0, recurrence:task.recurrence||"none", blocked_by:task.blocked_by||[] });
    setEditTask(task);
  };

  const handleEditTaskSave = () => {
    if (!editTaskForm?.title?.trim()) { toast({ message:"Title is required.", type:"error" }); return; }
    let assignedTo = editTask.assigned_to || {};
    if (editTaskAssigneeKey.startsWith("user:")) { const u = users.find(x => x.id === editTaskAssigneeKey.slice(5)); if (u) assignedTo = { name:u.name, email:u.email, department:u.department||"" }; }
    else if (editTaskAssigneeKey.startsWith("dept:")) { const d = departments.find(x => x.id === editTaskAssigneeKey.slice(5)); if (d) assignedTo = { name:d.name, email:"" }; }
    else assignedTo = {};
    const newTasks = tasks.map(t2 => t2.id === editTask.id ? { ...t2, ...editTaskForm, assigned_to:assignedTo } : t2);
    const updatedTask = newTasks.find(t2 => t2.id === editTask.id);
    setTasks(newTasks);
    setProjects(projects.map(p => p.id === id ? { ...p, progress:calcProgress(id, newTasks) } : p));
    toast({ message:`Task "${editTaskForm.title}" updated.` });
    emailTaskAssignment(updatedTask, editTask.assigned_to);
    setEditTask(null); setEditTaskForm(null);
  };

  const handleDeleteTask = (task) => {
    if (!task) return;
    if (!canDeleteTasks) {
      toast({ message:"Task delete blocked", sub:"Only managers and above can delete tasks.", type:"warning" });
      return;
    }
    const nextTasks = removeTaskAndReferences(tasks, task.id);
    setTasks(nextTasks);
    setProjects(projects.map(p => p.id === task.project_id ? { ...p, progress:calcProgress(p.id, nextTasks) } : p));
    setComments((comments || []).filter(c => !(c.entity_type === "task" && c.entity_id === task.id)));
    logActivity({ userName: currentUser?.name, eventType: "deleted", entityType: "task", entityId: task.id, entityTitle: task.title });
    toast({ message:`"${task.title}" deleted`, sub:"Task removed permanently", type:"warning" });
    if (editTask?.id === task.id) { setEditTask(null); setEditTaskForm(null); }
    if (commentTask?.id === task.id) setCommentTask(null);
    if (logTimeTask?.id === task.id) { setLogTimeTask(null); setLogHours(""); }
  };

  const changeTaskStatus = (tid, newStatus) => {
    const task = tasks.find(t2 => t2.id === tid);
    if (!task) return;
    if (newStatus === "Done" && isBlocked(task)) {
      toast({ message:`"${task.title}" is blocked`, sub:"Complete all blocking tasks first", type:"error" });
      return;
    }
    let newTasks = tasks.map(t2 => t2.id === tid ? { ...t2, status:newStatus } : t2);
    if (newStatus === "Done" && task.recurrence && task.recurrence !== "none") {
      const nextDue = new Date(task.due_date || Date.now());
      if (task.recurrence === "daily")   nextDue.setDate(nextDue.getDate() + 1);
      if (task.recurrence === "weekly")  nextDue.setDate(nextDue.getDate() + 7);
      if (task.recurrence === "monthly") nextDue.setMonth(nextDue.getMonth() + 1);
      const hrs = Math.max(0, Math.round((nextDue - Date.now()) / 3600000));
      newTasks = [...newTasks, { ...task, id:`t${Date.now()}`, status:"To Do", actual_hours:0, subtasks:(task.subtasks||[]).map(s=>({...s,done:false})), due_date:nextDue.toISOString().split("T")[0], estimated_hours:hrs, created_at:new Date().toISOString() }];
      toast({ message:`🔄 "${task.title}" recurred`, sub:`Next due ${fmtDate(nextDue.toISOString().split("T")[0])}`, type:"info" });
    } else {
      toast({ message:`"${task.title}" → ${newStatus}`, type:newStatus==="Done"?"success":"info" });
    }
    setTasks(newTasks);
    setProjects(projects.map(p => p.id === id ? { ...p, progress:calcProgress(id, newTasks) } : p));
    if (newStatus === "Done") logActivity({ userName: currentUser?.name, eventType: "task_completed", entityType: "task", entityId: tid, entityTitle: task.title });
  };

  const simulateAI = async () => {
    setAiLoading(true); setAiResult(""); setAiError(null);
    try {
      const result = await callClaude(
        `Analyze this project and provide a critical path delay simulation:\n\nProject: ${project.title}\nStage: ${project.stage}\nProgress: ${calcProgress(id, tasks)}%\nDue: ${project.due_date}\nTasks: ${projectTasks.map(t2=>`${t2.title} (${t2.status}, due ${t2.due_date})`).join("; ")}\n\nGive a brief risk assessment and 2-3 recommendations.`,
        "You are a project management AI. Be concise and specific."
      );
      setAiResult(result);
    } catch (err) { setAiError(err.message); }
    finally { setAiLoading(false); }
  };

  // ── Kanban view ───────────────────────────────────────────────────────────────
  const KanbanView = () => (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, alignItems:"start" }}>
      {KANBAN_COLS.map(col => {
        const colTasks = projectTasks.filter(t2 => t2.status === col);
        const colColor = statusColor(col);
        return (
          <div key={col}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10, padding:"0 2px" }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:colColor, flexShrink:0 }} />
              <span style={{ fontSize:12, fontWeight:700, color:t.textSub }}>{col}</span>
              <span style={{ fontSize:11, color:t.textGhost, marginLeft:"auto", background:t.statBg, borderRadius:99, padding:"1px 7px", fontWeight:600 }}>{colTasks.length}</span>
            </div>
            {colTasks.map(t2 => {
              const cnt = taskCommentCount(t2.id);
              const blocked = isBlocked(t2);
              const subs = t2.subtasks || [];
              const subsDone = subs.filter(s=>s.done).length;
              return (
                <div key={t2.id}
                  style={{ background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:10, padding:"11px 13px", marginBottom:8, cursor:"pointer", transition:"border-color 0.15s, box-shadow 0.15s" }}
                  onClick={() => openEditTask(t2)}
                >
                  <div style={{ display:"flex", alignItems:"flex-start", gap:7, marginBottom:7 }}>
                    <div onClick={e=>e.stopPropagation()} style={{ flexShrink:0, marginTop:1 }}>
                      <TaskStatusButton task={t2} onStatusChange={changeTaskStatus} />
                    </div>
                    <span style={{ fontSize:13, fontWeight:600, color:t2.status==="Done"?t.textFaint:t.textSub, textDecoration:t2.status==="Done"?"line-through":"none", lineHeight:1.4, flex:1 }}>{t2.title}</span>
                    {canDeleteTasks && (
                      <button
                        onClick={e=>{ e.stopPropagation(); setTaskToDelete(t2); }}
                        title="Delete task"
                        aria-label={`Delete ${t2.title}`}
                        style={{ background:"transparent", border:"none", color:"#EF4444", cursor:"pointer", fontSize:15, lineHeight:1, padding:"0 2px", flexShrink:0 }}
                      >
                        x
                      </button>
                    )}
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, alignItems:"center" }}>
                    <Badge label={t2.priority} color={priorityColor(t2.priority)} />
                    {t2.recurrence && t2.recurrence!=="none" && <span title={`Repeats ${t2.recurrence}`} style={{fontSize:10}}>🔄</span>}
                    {blocked && <Badge label="🔒" color="#EF4444" />}
                    {subs.length>0 && <span style={{fontSize:10,color:t.textFaint,background:t.card,borderRadius:99,padding:"1px 6px"}}>{subsDone}/{subs.length}✓</span>}
                    {t2.assigned_to?.name && (
                      <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4 }}>
                        <Avatar name={t2.assigned_to.name} size={16} />
                      </div>
                    )}
                  </div>
                  {t2.due_date && (
                    <div style={{ fontSize:10, color:t.textFaint, marginTop:6 }}>📅 {fmtDate(t2.due_date)}</div>
                  )}
                  {cnt>0 && <div style={{ fontSize:10, color:t.accent, marginTop:4 }}>💬 {cnt}</div>}
                </div>
              );
            })}
            {colTasks.length===0 && (
              <div style={{ border:`1px dashed ${t.border2}`, borderRadius:10, padding:"18px 12px", textAlign:"center", color:t.textGhost, fontSize:12 }}>No tasks</div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── List view task rows ────────────────────────────────────────────────────────
  const ListView = () => (
    <>
      {projectTasks.map(t2 => {
        const cnt = taskCommentCount(t2.id);
        const blocked = isBlocked(t2);
        const subs = t2.subtasks || [];
        const subsDone = subs.filter(s=>s.done).length;
        const isExpanded = expanded.has(t2.id);
        return (
          <div key={t2.id} style={{ borderBottom:`1px solid ${t.divider}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0" }}>
              <TaskStatusButton task={t2} onStatusChange={changeTaskStatus} />
              {subs.length > 0 && (
                <button onClick={()=>toggleExpand(t2.id)} style={{ background:"none", border:"none", cursor:"pointer", color:t.textFaint, fontSize:11, padding:0, lineHeight:1 }}>{isExpanded?"▼":"▶"}</button>
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  <span style={{ fontSize:13, fontWeight:600, color:t2.status==="Done"?t.textFaint:t.textSub, textDecoration:t2.status==="Done"?"line-through":"none" }}>{t2.title}</span>
                  {t2.recurrence && t2.recurrence!=="none" && <span title={`Repeats ${t2.recurrence}`} style={{fontSize:11}}>🔄</span>}
                  {blocked && <Badge label="🔒 Blocked" color="#EF4444" />}
                  {subs.length>0 && <span style={{fontSize:10,color:t.textFaint,background:t.statBg,borderRadius:99,padding:"1px 7px"}}>{subsDone}/{subs.length} ✓</span>}
                </div>
                <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>
                  Due {fmtDate(t2.due_date)} · {t2.estimated_hours}h est{t2.actual_hours>0?` · ${t2.actual_hours}h logged`:""}
                </div>
              </div>
              <Badge label={t2.priority} color={priorityColor(t2.priority)} />
              <button onClick={()=>{ setLogTimeTask(t2); setLogHours(""); }} title="Log time" style={{ background:"transparent", border:`1px solid ${t.border2}`, borderRadius:7, padding:"3px 9px", fontSize:11, color:t2.actual_hours>0?t.accent:t.textMuted, cursor:"pointer" }}>⏱{t2.actual_hours>0?` ${t2.actual_hours}h`:""}</button>
              <button onClick={()=>setCommentTask(t2)} style={{ display:"flex", alignItems:"center", gap:4, background:"transparent", border:`1px solid ${t.border2}`, borderRadius:7, padding:"3px 9px", fontSize:11, color:cnt>0?t.accent:t.textMuted, cursor:"pointer", fontWeight:cnt>0?700:400 }}>💬{cnt>0?` ${cnt}`:""}</button>
              <button onClick={()=>openEditTask(t2)} style={{ background:"transparent", border:`1px solid ${t.border2}`, borderRadius:7, padding:"3px 9px", fontSize:11, color:t.textMuted, cursor:"pointer" }}>✏</button>
              {canDeleteTasks && (
                <button onClick={()=>setTaskToDelete(t2)} title="Delete task" style={{ background:"transparent", border:"1px solid #EF444466", borderRadius:7, padding:"3px 9px", fontSize:11, color:"#EF4444", cursor:"pointer" }}>Delete</button>
              )}
            </div>
            {isExpanded && (
              <div style={{ paddingLeft:32, paddingBottom:10 }}>
                {subs.map(st=>(
                  <div key={st.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"3px 0" }}>
                    <input type="checkbox" checked={st.done} onChange={()=>toggleSubtask(t2.id,st.id)} style={{ width:14, height:14, cursor:"pointer", accentColor:t.accent }} />
                    <span style={{ fontSize:12, flex:1, color:st.done?t.textFaint:t.textSub, textDecoration:st.done?"line-through":"none" }}>{st.title}</span>
                    <button onClick={()=>deleteSubtask(t2.id,st.id)} style={{ background:"none", border:"none", cursor:"pointer", color:t.textGhost, fontSize:14, lineHeight:1 }}>×</button>
                  </div>
                ))}
                <div style={{ display:"flex", gap:6, marginTop:6 }}>
                  <input
                    type="text" placeholder="Add subtask…"
                    value={subtaskInput[t2.id]||""}
                    onChange={e=>setSubtaskInput(p=>({...p,[t2.id]:e.target.value}))}
                    onKeyDown={e=>{ if(e.key==="Enter"&&subtaskInput[t2.id]?.trim()){ addSubtask(t2.id,subtaskInput[t2.id]); setSubtaskInput(p=>({...p,[t2.id]:""})); }}}
                    style={{ flex:1, background:t.input, border:`1px solid ${t.inputBorder||t.border2}`, borderRadius:6, color:t.text, fontSize:12, padding:"4px 8px", fontFamily:"inherit", outline:"none" }}
                  />
                  <button onClick={()=>{ if(subtaskInput[t2.id]?.trim()){ addSubtask(t2.id,subtaskInput[t2.id]); setSubtaskInput(p=>({...p,[t2.id]:""})); }}} style={{...btnPrimary,padding:"4px 10px",fontSize:11}}>+ Add</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );

  return (
    <div>
      {/* Back / Edit row */}
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <button onClick={onBack} style={{...bs, fontSize:12}}>← Back to Projects</button>
        <button onClick={openEdit} style={{...bs, fontSize:12}}>✏ Edit Project</button>
      </div>

      {/* Project overview card */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:24, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <h1 style={{ margin:"0 0 6px", fontSize:22, fontWeight:800, color:t.text }}>{project.title}</h1>
            <div style={{ color:t.textMuted, fontSize:13 }}>{client?.name}{project.description?` · ${project.description}`:""}</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Badge label={project.stage} color={stageColor(project.stage)} />
            <Badge label={project.priority} color={priorityColor(project.priority)} />
            <Badge label={project.status} color={statusColor(project.status)} />
          </div>
        </div>
        {(() => {
          const hasBudget = project.budget > 0;
          const budgetUsedPct = hasBudget ? Math.min(150, Math.round(((project.budget_spent||0) / project.budget) * 100)) : 0;
          const budgetOver = hasBudget && (project.budget_spent||0) > project.budget;
          const statItems = [
            ["Assigned","👤", project.assigned_to?.name||"—", null],
            ["Start","📅", fmtDate(project.start_date), null],
            ["Due","🗓", fmtDate(project.due_date), null],
            ["Progress","📈", `${calcProgress(id,tasks)}%`, null],
            ...(hasBudget ? [
              ["Budget","💰", `${CS}${((project.budget||0)/1_000_000).toFixed(2)}M`, null],
              ["Spent","📤", `${CS}${((project.budget_spent||0)/1_000_000).toFixed(2)}M`, budgetOver ? "#EF4444" : (budgetUsedPct >= 80 ? "#F59E0B" : "#059669")],
            ] : []),
          ];
          return (
            <>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${statItems.length},1fr)`, gap:14, marginBottom:16 }}>
                {statItems.map(([l,ic,v,color])=>(
                  <div key={l} style={{ background:t.statBg, borderRadius:10, padding:"10px 14px" }}>
                    <div style={{ fontSize:11, color:t.textFaint, marginBottom:4 }}>{ic} {l}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:color||t.textSub }}>{v}</div>
                  </div>
                ))}
              </div>
              {hasBudget && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:11, color:t.textFaint }}>
                    <span>Budget utilisation</span>
                    <span style={{ fontWeight:700, color: budgetOver?"#EF4444": budgetUsedPct>=80?"#F59E0B":"#059669" }}>{budgetUsedPct}%</span>
                  </div>
                  <ProgressBar value={budgetUsedPct} max={100} color={budgetOver?"#EF4444":budgetUsedPct>=80?"#F59E0B":"#059669"} height={6} />
                </div>
              )}
            </>
          );
        })()}
        <ProgressBar value={calcProgress(id,tasks)} color="#7C3AED" height={8} />
      </div>

      {/* ── Milestones ─────────────────────────────────────────────────────────── */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:20 }}>
        <h3 style={{ margin:"0 0 14px", color:t.text, fontSize:15, fontWeight:700 }}>
          🏁 Milestones
          <span style={{ marginLeft:8, fontSize:12, fontWeight:500, color:t.textFaint }}>({milestones.length})</span>
        </h3>

        {milestones.length === 0 && (
          <div style={{ fontSize:13, color:t.textFaint, marginBottom:12, padding:"8px 0" }}>No milestones yet. Add key checkpoints below.</div>
        )}

        {milestones.map(m => (
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${t.divider}` }}>
            <input type="checkbox" checked={m.done} onChange={()=>toggleMs(m.id)} style={{ width:15, height:15, cursor:"pointer", accentColor:t.accent, flexShrink:0 }} />
            <span style={{ flex:1, fontSize:13, fontWeight:600, color:m.done?t.textFaint:t.textSub, textDecoration:m.done?"line-through":"none" }}>{m.title}</span>
            {m.date && <span style={{ fontSize:11, color:t.textFaint, flexShrink:0 }}>📅 {fmtDate(m.date)}</span>}
            {m.done && <Badge label="Done" color="#059669" />}
            <button onClick={()=>deleteMs(m.id)} style={{ background:"none", border:"none", cursor:"pointer", color:t.textGhost, fontSize:17, lineHeight:1, flexShrink:0 }}>×</button>
          </div>
        ))}

        <div style={{ display:"flex", gap:8, marginTop:14 }}>
          <input
            placeholder="New milestone title…"
            value={newMsTitle}
            onChange={e => setNewMsTitle(e.target.value)}
            onKeyDown={e => e.key==="Enter" && addMilestone()}
            style={{ flex:1, ...iS, fontSize:12 }}
          />
          <input type="date" value={newMsDate} onChange={e=>setNewMsDate(e.target.value)} style={{ ...iS, width:148, fontSize:12, flexShrink:0 }} />
          <button onClick={addMilestone} disabled={!newMsTitle.trim()} style={{ ...btnPrimary, padding:"7px 14px", fontSize:12, opacity:!newMsTitle.trim()?0.5:1 }}>+ Add</button>
        </div>
      </div>

      {/* ── Tasks ─────────────────────────────────────────────────────────────── */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <h3 style={{ margin:0, color:t.text, fontSize:15, fontWeight:700 }}>Tasks ({projectTasks.length})</h3>
            {/* List / Kanban toggle */}
            <div style={{ display:"flex", gap:4, background:t.statBg, borderRadius:8, padding:3 }}>
              {[["list","☰ List"],["kanban","⊞ Kanban"]].map(([mode, label]) => (
                <button key={mode} onClick={()=>setTaskView(mode)} style={{ ...bs, padding:"4px 12px", fontSize:11, fontWeight:700, background:taskView===mode?t.card:"transparent", color:taskView===mode?t.text:t.textMuted, border:`1px solid ${taskView===mode?t.border2:"transparent"}`, borderRadius:6, boxShadow:taskView===mode?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setShowTemplates(true)} style={{...bs, padding:"7px 14px", fontSize:12}}>📋 Templates</button>
            <button onClick={()=>setShowTaskForm(true)} style={{...btnPrimary, padding:"7px 14px", fontSize:12}}>+ Add Task</button>
          </div>
        </div>

        {projectTasks.length === 0 && (
          <div style={{ padding:"32px 0", textAlign:"center", color:t.textFaint, fontSize:13 }}>
            No tasks yet.{" "}
            <button onClick={()=>setShowTemplates(true)} style={{ background:"none", border:"none", color:t.accent, cursor:"pointer", fontSize:13, fontWeight:700, textDecoration:"underline" }}>Use a template</button>{" "}
            or add tasks manually.
          </div>
        )}

        {taskView === "kanban" ? <KanbanView /> : <ListView />}
      </div>

      {/* ── KPI Performance ──────────────────────────────────────────────────── */}
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

      {/* ── AI Analysis ──────────────────────────────────────────────────────── */}
      <div style={{ background:t.card, border:`1px solid ${t.accent}44`, borderRadius:14, padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <h3 style={{ margin:0, color:t.text, fontSize:15, fontWeight:700 }}>🤖 AI Critical Path Analysis</h3>
          <button onClick={simulateAI} style={btnPrimary} disabled={aiLoading}>{aiLoading?"Analysing…":"Run Analysis"}</button>
        </div>
        <AIBlock loading={aiLoading} error={aiError} result={aiResult} placeholder='Click "Run Analysis" to simulate delay impact and get AI recommendations.' onRetry={simulateAI} />
      </div>

      {/* ── Project Discussion ────────────────────────────────────────────────── */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginTop:20 }}>
        <h3 style={{ margin:"0 0 14px", color:t.text, fontSize:15, fontWeight:700 }}>💬 Project Discussion</h3>
        <CommentsPanel entityType="project" entityId={id} comments={comments||[]} setComments={setComments} currentUser={currentUser} users={users} />
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}

      <Modal open={!!commentTask} onClose={()=>setCommentTask(null)} title={`Comments · ${commentTask?.title||""}`}>
        {commentTask && <CommentsPanel entityType="task" entityId={commentTask.id} comments={comments||[]} setComments={setComments} currentUser={currentUser} users={users} />}
      </Modal>

      <ConfirmModal
        open={!!taskToDelete}
        onClose={()=>setTaskToDelete(null)}
        onConfirm={()=>handleDeleteTask(taskToDelete)}
        title={`Delete "${taskToDelete?.title || "this task"}"?`}
        message="This will permanently remove the task, its comments, and any blocker references from other tasks."
        confirmLabel="Delete Task"
      />

      {editTaskForm && (
        <Modal open={!!editTask} onClose={()=>{setEditTask(null);setEditTaskForm(null);}} title="Edit Task">
          <FormField label="Title"><input style={iS} value={editTaskForm.title} onChange={e=>setEditTaskForm({...editTaskForm,title:e.target.value})} /></FormField>
          <FormField label="Assign To">
            <select style={sS} value={editTaskAssigneeKey} onChange={e=>setEditTaskAssigneeKey(e.target.value)}>
              <option value="">Unassigned</option>
              {users.length>0 && <optgroup label="Team Members">{users.map(u=><option key={u.id} value={`user:${u.id}`}>{u.name}{u.department?` (${u.department})`:""}</option>)}</optgroup>}
              {departments.length>0 && <optgroup label="Departments">{departments.map(d=><option key={d.id} value={`dept:${d.id}`}>{d.name}</option>)}</optgroup>}
            </select>
          </FormField>
          <FormField label="Description"><input style={iS} value={editTaskForm.description} onChange={e=>setEditTaskForm({...editTaskForm,description:e.target.value})} /></FormField>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label="Status"><select style={sS} value={editTaskForm.status} onChange={e=>setEditTaskForm({...editTaskForm,status:e.target.value})}>{["To Do","In Progress","In Review","Done"].map(s=><option key={s}>{s}</option>)}</select></FormField>
            <FormField label="Priority"><select style={sS} value={editTaskForm.priority} onChange={e=>setEditTaskForm({...editTaskForm,priority:e.target.value})}>{["Critical","High","Medium","Low"].map(s=><option key={s}>{s}</option>)}</select></FormField>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label="Due Date"><input type="date" style={iS} value={editTaskForm.due_date} onChange={e=>{ const due=e.target.value; const hrs=due?Math.max(0,Math.round((new Date(due)-Date.now())/3600000)):0; setEditTaskForm({...editTaskForm,due_date:due,estimated_hours:hrs}); }} /></FormField>
            <FormField label="Est. Hours (auto)"><input type="number" style={{...iS,opacity:0.7,cursor:"default"}} value={editTaskForm.estimated_hours} readOnly /></FormField>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label="Recurrence">
              <select style={sS} value={editTaskForm.recurrence||"none"} onChange={e=>setEditTaskForm({...editTaskForm,recurrence:e.target.value})}>
                {["none","daily","weekly","monthly"].map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
              </select>
            </FormField>
            <FormField label="Actual Hours">
              <input type="number" min="0" step="0.5" style={iS} value={editTaskForm.actual_hours||0} onChange={e=>setEditTaskForm({...editTaskForm,actual_hours:Number(e.target.value)})} />
            </FormField>
          </div>
          {projectTasks.filter(t2=>t2.id!==editTask?.id).length>0 && (
            <FormField label="Blocked by">
              <div style={{ maxHeight:100, overflowY:"auto", border:`1px solid ${t.border2}`, borderRadius:8, padding:"6px 10px", background:t.input }}>
                {projectTasks.filter(t2=>t2.id!==editTask?.id).map(t2=>(
                  <label key={t2.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"2px 0", cursor:"pointer" }}>
                    <input type="checkbox" style={{ accentColor:t.accent }} checked={(editTaskForm.blocked_by||[]).includes(t2.id)} onChange={e=>{ const prev=editTaskForm.blocked_by||[]; setEditTaskForm({...editTaskForm,blocked_by:e.target.checked?[...prev,t2.id]:prev.filter(x=>x!==t2.id)}); }} />
                    <span style={{ fontSize:12, color:t.textSub }}>{t2.title}</span>
                  </label>
                ))}
              </div>
            </FormField>
          )}
          <div style={{ display:"flex", gap:10, justifyContent:canDeleteTasks?"space-between":"flex-end", alignItems:"center" }}>
            {canDeleteTasks && (
              <button style={{ ...bs, color:"#EF4444", borderColor:"#EF444466" }} onClick={()=>setTaskToDelete(editTask)}>Delete Task</button>
            )}
            <div style={{ display:"flex", gap:10 }}>
              <button style={bs} onClick={()=>{setEditTask(null);setEditTaskForm(null);}}>Cancel</button>
              <button style={btnPrimary} onClick={handleEditTaskSave} disabled={!editTaskForm.title}>Save Changes</button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={showTaskForm} onClose={()=>setShowTaskForm(false)} title="Add Task">
        <FormField label="Title"><input style={iS} value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} /></FormField>
        <FormField label="Assign To">
          <select style={sS} value={taskAssigneeKey} onChange={e=>setTaskAssigneeKey(e.target.value)}>
            <option value="">Unassigned</option>
            {users.length>0 && <optgroup label="Team Members">{users.map(u=><option key={u.id} value={`user:${u.id}`}>{u.name}{u.department?` (${u.department})`:""}</option>)}</optgroup>}
            {departments.length>0 && <optgroup label="Departments">{departments.map(d=><option key={d.id} value={`dept:${d.id}`}>{d.name}</option>)}</optgroup>}
          </select>
        </FormField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FormField label="Status"><select style={sS} value={taskForm.status} onChange={e=>setTaskForm({...taskForm,status:e.target.value})}>{["To Do","In Progress","In Review","Done"].map(s=><option key={s}>{s}</option>)}</select></FormField>
          <FormField label="Priority"><select style={sS} value={taskForm.priority} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})}>{["Critical","High","Medium","Low"].map(s=><option key={s}>{s}</option>)}</select></FormField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FormField label="Due Date"><input type="date" style={iS} value={taskForm.due_date} onChange={e=>{ const due=e.target.value; const hrs=due?Math.max(0,Math.round((new Date(due)-Date.now())/3600000)):0; setTaskForm({...taskForm,due_date:due,estimated_hours:hrs}); }} /></FormField>
          <FormField label="Est. Hours (auto)"><input type="number" style={{...iS,opacity:0.7,cursor:"default"}} value={taskForm.estimated_hours} readOnly /></FormField>
        </div>
        <FormField label="Recurrence">
          <select style={sS} value={taskForm.recurrence} onChange={e=>setTaskForm({...taskForm,recurrence:e.target.value})}>
            {["none","daily","weekly","monthly"].map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
          </select>
        </FormField>
        {projectTasks.length>0 && (
          <FormField label="Blocked by">
            <div style={{ maxHeight:100, overflowY:"auto", border:`1px solid ${t.border2}`, borderRadius:8, padding:"6px 10px", background:t.input }}>
              {projectTasks.map(t2=>(
                <label key={t2.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"2px 0", cursor:"pointer" }}>
                  <input type="checkbox" style={{ accentColor:t.accent }} checked={(taskForm.blocked_by||[]).includes(t2.id)} onChange={e=>{ const prev=taskForm.blocked_by||[]; setTaskForm({...taskForm,blocked_by:e.target.checked?[...prev,t2.id]:prev.filter(x=>x!==t2.id)}); }} />
                  <span style={{ fontSize:12, color:t.textSub }}>{t2.title}</span>
                </label>
              ))}
            </div>
          </FormField>
        )}
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
                <span style={{ fontWeight:700 }}>{calcProgress(id,tasks)}%</span>
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
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label={`Budget (${CS})`}>
              <input type="number" min="0" style={iS} value={editForm.budget||""} onChange={e=>setEditForm({...editForm,budget:parseFloat(e.target.value)||0})} placeholder="e.g. 5000000 for 5M" />
              {editForm.budget > 0 && <div style={{ fontSize:11, color:"#7C3AED", marginTop:3 }}>= {CS}{(editForm.budget/1_000_000).toFixed(2)}M</div>}
            </FormField>
            <FormField label={`Budget Spent (${CS})`}>
              <input type="number" min="0" style={iS} value={editForm.budget_spent||""} onChange={e=>setEditForm({...editForm,budget_spent:parseFloat(e.target.value)||0})} placeholder="e.g. 2500000 for 2.5M" />
              {editForm.budget_spent > 0 && <div style={{ fontSize:11, color: editForm.budget > 0 && editForm.budget_spent > editForm.budget ? "#EF4444" : "#059669", marginTop:3 }}>= {CS}{(editForm.budget_spent/1_000_000).toFixed(2)}M{editForm.budget > 0 && editForm.budget_spent > editForm.budget ? " · over budget" : ""}</div>}
            </FormField>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={bs} onClick={()=>setShowEditForm(false)}>Cancel</button>
            <button style={btnPrimary} onClick={handleEditSave} disabled={!editForm.title}>Save Changes</button>
          </div>
        </Modal>
      )}

      {/* Templates picker */}
      <Modal open={showTemplates} onClose={()=>setShowTemplates(false)} title="📋 Task Templates" width={600}>
        <div style={{ fontSize:13, color:t.textMuted, marginBottom:16 }}>Pick a template to bulk-add tasks to this project. You can edit them after.</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {TASK_TEMPLATES.map(tmpl=>(
            <button key={tmpl.name} onClick={()=>{ applyTemplate(tmpl); setShowTemplates(false); }} style={{ textAlign:"left", background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:12, padding:"16px", cursor:"pointer" }}>
              <div style={{ fontSize:22, marginBottom:8 }}>{tmpl.icon}</div>
              <div style={{ fontSize:13, fontWeight:700, color:t.text, marginBottom:4 }}>{tmpl.name}</div>
              <div style={{ fontSize:11, color:t.textFaint }}>{tmpl.tasks.length} tasks</div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Log Time modal */}
      <Modal open={!!logTimeTask} onClose={()=>{ setLogTimeTask(null); setLogHours(""); }} title={`⏱ Log Time · ${logTimeTask?.title||""}`} width={400}>
        <FormField label="Hours worked">
          <input type="number" min="0" step="0.5" style={iS} value={logHours} onChange={e=>setLogHours(e.target.value)} placeholder="e.g. 2.5" autoFocus />
        </FormField>
        {logTimeTask?.actual_hours>0 && (
          <div style={{ fontSize:12, color:t.textFaint, marginBottom:8 }}>Already logged: {logTimeTask.actual_hours}h · Est: {logTimeTask.estimated_hours}h</div>
        )}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={bs} onClick={()=>{ setLogTimeTask(null); setLogHours(""); }}>Cancel</button>
          <button style={btnPrimary} disabled={!logHours||Number(logHours)<=0} onClick={()=>{
            const hrs = Number(logHours);
            setTasks(tasks.map(t2 => t2.id===logTimeTask.id ? { ...t2, actual_hours:(t2.actual_hours||0)+hrs } : t2));
            toast({ message:`${hrs}h logged for "${logTimeTask.title}"`, type:"success" });
            setLogTimeTask(null); setLogHours("");
          }}>Log Time</button>
        </div>
      </Modal>
    </div>
  );
})
