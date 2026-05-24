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
  DEFAULT_PROJECT_PIPELINE_ID,
  fmtDate,
  getProjectPipeline,
  getPipelineStatuses,
  getTaskPipelines,
  isTaskComplete,
  mapStatusToPipeline,
  priorityColor,
  removeTaskAndReferences,
  stageColor,
  statusColor,
  taskStatusColor,
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
import { fetchFiles, uploadFiles, deleteFile, getSignedUrl, formatFileSize, fileIcon } from "../lib/fileStorage.js";
import { isSupabaseConfigured } from "../lib/supabaseClient.js";
import { createNotification } from "../lib/notificationHelpers.js";

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
  const { projects, setProjects, tasks, setTasks, kpis, clients, users, departments, comments, setComments, currentUser, nav, pageParam: id, whiteLabelSettings, logActivity, isMobile } = useApp();
  const CS = ({ USD:"$", GBP:"£", EUR:"€", AUD:"A$", NGN:"₦", CAD:"C$" })[whiteLabelSettings?.currency] || "$";
  const onBack = () => nav("projects");
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const project = projects.find(p => p.id === id);
  const taskPipelines = useMemo(() => getTaskPipelines(whiteLabelSettings), [whiteLabelSettings]);
  const projectPipeline = getProjectPipeline(project, taskPipelines);
  const projectStages = getPipelineStatuses(project, taskPipelines);
  const defaultTaskStatus = "To Do";
  const canDeleteTasks = canDeleteTasksForRole(currentUser?.role);

  // ── Task form state ─────────────────────────────────────────────────────────
  const [showTaskForm, setShowTaskForm] = useState(false);
  const BLANK_TASK = { title:"", description:"", status:defaultTaskStatus, priority:"Medium", due_date:"", estimated_hours:0, actual_hours:0, subtasks:[], recurrence:"none", blocked_by:[], project_stage: project?.stage || "" };
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
  const [stageForTemplate, setStageForTemplate] = useState("");

  // ── View mode (list vs kanban vs stage) ────────────────────────────────────
  const [taskView, setTaskView] = useState("stage");
  const [stageCollapsed, setStageCollapsed] = useState({});
  const toggleStageCollapse = (key) => setStageCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Project files state ─────────────────────────────────────────────────────
  const [projFiles, setProjFiles]       = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesLoaded, setFilesLoaded]   = useState(false);
  const [filesDragOver, setFilesDragOver] = useState(false);
  const [filesUploading, setFilesUploading] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const filesInputRef = useRef(null);

  const loadProjectFiles = async () => {
    if (!isSupabaseConfigured || !currentUser?.agency_id) return;
    setFilesLoading(true);
    try {
      const all = await fetchFiles(currentUser.agency_id);
      setProjFiles(all.filter(f => f.project_id === id));
      setFilesLoaded(true);
    } catch { /* silent */ } finally { setFilesLoading(false); }
  };

  const handleProjectFileUpload = async (fileList) => {
    if (!isSupabaseConfigured || !currentUser?.agency_id) return;
    setFilesUploading(true);
    try {
      const newFiles = await uploadFiles({ files: Array.from(fileList), agencyId: currentUser.agency_id, category:"general", projectId: id, currentUser });
      setProjFiles(prev => [...newFiles, ...prev]);
      toast({ message: `${newFiles.length} file${newFiles.length !== 1 ? "s" : ""} uploaded`, type:"success" });
    } catch (e) {
      toast({ message: `Upload failed: ${e.message}`, type:"error" });
    } finally { setFilesUploading(false); }
  };

  const handleProjectFileDelete = async (file) => {
    try {
      await deleteFile(file);
      setProjFiles(prev => prev.filter(f => f.id !== file.id));
      toast({ message: `"${file.name}" deleted`, type:"success" });
      setFileToDelete(null);
    } catch (e) {
      toast({ message: `Delete failed: ${e.message}`, type:"error" });
    }
  };

  const handleProjectFileDownload = async (file) => {
    try {
      const url = await getSignedUrl(file.storage_path);
      if (url) { const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); }
    } catch { /* silent */ }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const taskCommentCount = (tid) => (comments || []).filter(c => c.entity_type === "task" && c.entity_id === tid).length;
  const toggleExpand = (tid) => setExpanded(prev => { const n = new Set(prev); n.has(tid) ? n.delete(tid) : n.add(tid); return n; });
  const isBlocked    = (task) => (task.blocked_by||[]).some(depId => { const dep = tasks.find(t2 => t2.id === depId); return dep && !isTaskComplete(dep); });
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

  const applyTemplate = (tmpl, projectStage = "") => {
    const now = Date.now();
    const newTasks = tmpl.tasks.map((tpl, i) => ({ id:`t${now+i}`, ...tpl, status:defaultTaskStatus, project_id:id, assigned_to:{}, due_date:"", estimated_hours:0, actual_hours:0, subtasks:[], recurrence:"none", blocked_by:[], created_at:new Date().toISOString(), ...(projectStage ? { project_stage:projectStage } : {}) }));
    const all = [...tasks, ...newTasks];
    setTasks(all);
    setProjects(projects.map(p => p.id === id ? { ...p, progress: calcProgress(id, all, p, taskPipelines) } : p));
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
      pipeline_id: project.pipeline_id || DEFAULT_PROJECT_PIPELINE_ID,
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
    const updatedProject = { ...project, ...rest, assigned_to: assignedTo };
    const nextTasks = tasks;
    updatedProject.stage = mapStatusToPipeline(updatedProject.stage, updatedProject, taskPipelines);
    setProjects(projects.map(p => p.id === id ? { ...updatedProject, progress: calcProgress(id, nextTasks, updatedProject, taskPipelines) } : p));
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
      if (assignedTo.email !== currentUser?.email && currentUser?.agency_id) {
        createNotification({ agencyId: currentUser.agency_id, recipientEmail: assignedTo.email, type: "project_assigned", title: `Project assigned: ${updatedProject.title}`, body: `Assigned by ${currentUser.name}`, entityType: "project", entityId: updatedProject.id });
      }
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
    const newTask = { ...taskForm, status:taskForm.status || defaultTaskStatus, id:"t"+Date.now(), project_id:id, assigned_to:assignedTo, created_at:new Date().toISOString() };
    const newTasks = [...tasks, newTask];
    setTasks(newTasks);
    setProjects(projects.map(p => p.id === id ? { ...p, progress:calcProgress(id, newTasks, p, taskPipelines) } : p));
    logActivity({ userName: currentUser?.name, eventType: "task_added", entityType: "task", entityId: newTask.id, entityTitle: taskForm.title });
    toast({ message:`Task "${taskForm.title}" added`, sub:`${taskForm.priority} priority · Due ${fmtDate(taskForm.due_date)}`, type:"success" });
    emailTaskAssignment(newTask);
    if (assignedTo.email && assignedTo.email !== currentUser?.email && currentUser?.agency_id) {
      createNotification({ agencyId: currentUser.agency_id, recipientEmail: assignedTo.email, type: "task_assigned", title: `Task assigned: ${taskForm.title}`, body: `Assigned by ${currentUser.name} · ${project?.title || ""}`, entityType: "task", entityId: newTask.id });
    }
    setShowTaskForm(false); setTaskForm(BLANK_TASK); setTaskAssigneeKey("");
  };

  const openEditTask = (task) => {
    const assignee = task.assigned_to;
    let key = "";
    if (assignee?.email) { const u = users.find(x => x.email === assignee.email); if (u) key = `user:${u.id}`; }
    else if (assignee?.name) { const d = departments.find(x => x.name === assignee.name); if (d) key = `dept:${d.id}`; }
    setEditTaskAssigneeKey(key);
    setEditTaskForm({ title:task.title||"", description:task.description||"", status:task.status||defaultTaskStatus, priority:task.priority||"Medium", due_date:task.due_date||"", estimated_hours:task.estimated_hours||0, actual_hours:task.actual_hours||0, recurrence:task.recurrence||"none", blocked_by:task.blocked_by||[], project_stage:task.project_stage||"" });
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
    setProjects(projects.map(p => p.id === id ? { ...p, progress:calcProgress(id, newTasks, p, taskPipelines) } : p));
    toast({ message:`Task "${editTaskForm.title}" updated.` });
    emailTaskAssignment(updatedTask, editTask.assigned_to);
    if (assignedTo.email && assignedTo.email !== editTask.assigned_to?.email && assignedTo.email !== currentUser?.email && currentUser?.agency_id) {
      createNotification({ agencyId: currentUser.agency_id, recipientEmail: assignedTo.email, type: "task_assigned", title: `Task assigned: ${editTaskForm.title}`, body: `Assigned by ${currentUser.name} · ${project?.title || ""}`, entityType: "task", entityId: editTask.id });
    }
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
    setProjects(projects.map(p => p.id === task.project_id ? { ...p, progress:calcProgress(p.id, nextTasks, p, taskPipelines) } : p));
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
    const completesTask = isTaskComplete({ ...task, status:newStatus }, project, taskPipelines);
    if (completesTask && isBlocked(task)) {
      toast({ message:`"${task.title}" is blocked`, sub:"Complete all blocking tasks first", type:"error" });
      return;
    }
    let newTasks = tasks.map(t2 => t2.id === tid ? { ...t2, status:newStatus } : t2);
    if (completesTask && task.recurrence && task.recurrence !== "none") {
      const nextDue = new Date(task.due_date || Date.now());
      if (task.recurrence === "daily")   nextDue.setDate(nextDue.getDate() + 1);
      if (task.recurrence === "weekly")  nextDue.setDate(nextDue.getDate() + 7);
      if (task.recurrence === "monthly") nextDue.setMonth(nextDue.getMonth() + 1);
      const hrs = Math.max(0, Math.round((nextDue - Date.now()) / 3600000));
      newTasks = [...newTasks, { ...task, id:`t${Date.now()}`, status:defaultTaskStatus, actual_hours:0, subtasks:(task.subtasks||[]).map(s=>({...s,done:false})), due_date:nextDue.toISOString().split("T")[0], estimated_hours:hrs, created_at:new Date().toISOString() }];
      toast({ message:`🔄 "${task.title}" recurred`, sub:`Next due ${fmtDate(nextDue.toISOString().split("T")[0])}`, type:"info" });
    } else {
      toast({ message:`"${task.title}" → ${newStatus}`, type:completesTask?"success":"info" });
    }
    setTasks(newTasks);
    setProjects(projects.map(p => p.id === id ? { ...p, progress:calcProgress(id, newTasks, p, taskPipelines) } : p));
    if (completesTask) logActivity({ userName: currentUser?.name, eventType: "task_completed", entityType: "task", entityId: tid, entityTitle: task.title });
  };

  const simulateAI = async () => {
    setAiLoading(true); setAiResult(""); setAiError(null);
    try {
      const result = await callClaude(
        `Analyze this project and provide a critical path delay simulation:\n\nProject: ${project.title}\nStage: ${project.stage}\nProgress: ${calcProgress(id, tasks, project, taskPipelines)}%\nDue: ${project.due_date}\nProject pipeline: ${projectPipeline.name}\nTasks: ${projectTasks.map(t2=>`${t2.title} (${t2.status}, due ${t2.due_date})`).join("; ")}\n\nGive a brief risk assessment and 2-3 recommendations.`,
        "You are a project management AI. Be concise and specific."
      );
      setAiResult(result);
    } catch (err) { setAiError(err.message); }
    finally { setAiLoading(false); }
  };

  // ── Kanban view ───────────────────────────────────────────────────────────────
  const KanbanView = () => (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${KANBAN_COLS.length}, minmax(180px, 1fr))`, gap:12, alignItems:"start", overflowX:"auto" }}>
      {KANBAN_COLS.map(col => {
        const colTasks = projectTasks.filter(t2 => t2.status === col);
        const colColor = taskStatusColor(col);
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
                    <span style={{ fontSize:13, fontWeight:600, color:isTaskComplete(t2)?t.textFaint:t.textSub, textDecoration:isTaskComplete(t2)?"line-through":"none", lineHeight:1.4, flex:1 }}>{t2.title}</span>
                    <button
                      onClick={e=>{ e.stopPropagation(); openEditTask(t2); }}
                      title="Edit task"
                      style={{ background:"transparent", border:"none", color:t.textMuted, cursor:"pointer", fontSize:13, lineHeight:1, padding:"0 2px", flexShrink:0 }}
                    >✏</button>
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

  // ── Stage view ────────────────────────────────────────────────────────────────
  const STAGE_COLS = "32px 1fr 150px 120px 110px 120px 40px" + (canDeleteTasks ? " 72px" : "");
  const StageView = () => {
    const unassigned = projectTasks.filter(t2 => !projectStages.some(s => s.label === t2.project_stage));
    const renderGroup = (key, label, color, stageTasks) => {
      const collapsed = stageCollapsed[key];
      return (
        <div key={key} style={{ marginBottom:18 }}>
          {/* Group header */}
          <div
            onClick={() => toggleStageCollapse(key)}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", cursor:"pointer", borderLeft:`4px solid ${color}`, borderRadius:"4px 0 0 4px", userSelect:"none" }}
          >
            <span style={{ fontSize:10, color:t.textGhost, width:10, flexShrink:0 }}>{collapsed ? "▶" : "▼"}</span>
            <span style={{ fontSize:14, fontWeight:800, color }}>{label}</span>
            <span style={{ fontSize:12, color:t.textFaint, fontWeight:500 }}>{stageTasks.length} task{stageTasks.length !== 1 ? "s" : ""}</span>
          </div>

          {!collapsed && (
            <div style={{ borderLeft:`4px solid ${color}`, marginLeft:0, overflowX:"auto" }}>
              {/* Column headers */}
              <div style={{ display:"grid", gridTemplateColumns:STAGE_COLS, columnGap:12, padding:"7px 14px", background:t.statBg, borderBottom:`1px solid ${t.border2}`, minWidth:700 }}>
                {["", "Task", "Assigned To", "Status", "Priority", "Due Date", "", ...(canDeleteTasks ? [""] : [])].map((h, i) => (
                  <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textGhost, textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>
                ))}
              </div>

              {/* Task rows */}
              {stageTasks.map(t2 => {
                const blocked = isBlocked(t2);
                const cnt = taskCommentCount(t2.id);
                const subs = t2.subtasks || [];
                const subsDone = subs.filter(s => s.done).length;
                const done = isTaskComplete(t2);
                return (
                  <div key={t2.id} style={{ display:"grid", gridTemplateColumns:STAGE_COLS, columnGap:12, padding:"10px 14px", borderBottom:`1px solid ${t.divider}`, alignItems:"center", minWidth:700, background:t.card, transition:"background 0.1s" }}>
                    <TaskStatusButton task={t2} onStatusChange={changeTaskStatus} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <span
                          onClick={() => openEditTask(t2)}
                          style={{ fontSize:13, fontWeight:600, color:done?t.textFaint:t.textSub, textDecoration:done?"line-through":"none", cursor:"pointer" }}
                        >{t2.title}</span>
                        {blocked && <Badge label="🔒" color="#EF4444" />}
                        {t2.recurrence && t2.recurrence !== "none" && <span style={{ fontSize:10 }}>🔄</span>}
                        {subs.length > 0 && <span style={{ fontSize:10, color:t.textGhost, background:t.statBg, borderRadius:99, padding:"1px 6px" }}>{subsDone}/{subs.length} ✓</span>}
                        {cnt > 0 && <span style={{ fontSize:10, color:t.accent, fontWeight:700 }}>💬 {cnt}</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
                      {t2.assigned_to?.name ? (
                        <>
                          <Avatar name={t2.assigned_to.name} size={20} />
                          <span style={{ fontSize:12, color:t.textMuted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t2.assigned_to.name.split(" ")[0]}</span>
                        </>
                      ) : <span style={{ fontSize:12, color:t.textGhost }}>—</span>}
                    </div>
                    <Badge label={t2.status} color={statusColor(t2.status)} />
                    <Badge label={t2.priority} color={priorityColor(t2.priority)} />
                    <span style={{ fontSize:12, color:t.textFaint }}>{t2.due_date ? fmtDate(t2.due_date) : "—"}</span>
                    <button onClick={() => openEditTask(t2)} title="Edit task" style={{ background:"transparent", border:`1px solid ${t.border2}`, borderRadius:6, padding:"3px 7px", fontSize:11, color:t.textMuted, cursor:"pointer" }}>✏</button>
                    {canDeleteTasks && (
                      <button onClick={() => setTaskToDelete(t2)} style={{ background:"transparent", border:"1px solid #EF444466", borderRadius:6, padding:"3px 8px", fontSize:11, color:"#EF4444", cursor:"pointer" }}>Delete</button>
                    )}
                  </div>
                );
              })}

              {/* Add task row */}
              <div style={{ padding:"10px 14px", background:t.card, borderTop:`1px solid ${t.divider}`, display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button
                  onClick={() => { setTaskForm({ ...BLANK_TASK, project_stage: label === "No Stage" ? "" : label }); setShowTaskForm(true); }}
                  style={{ display:"flex", alignItems:"center", gap:6, background:`${color}14`, border:`1px solid ${color}55`, borderRadius:7, cursor:"pointer", color, fontSize:12, padding:"6px 14px", fontWeight:700 }}
                >
                  + New Task
                </button>
                <button
                  onClick={() => { setStageForTemplate(label === "No Stage" ? "" : label); setShowTemplates(true); }}
                  style={{ display:"flex", alignItems:"center", gap:6, background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:7, cursor:"pointer", color:t.textMuted, fontSize:12, padding:"6px 14px", fontWeight:600 }}
                >
                  📋 From Template
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div>
        {projectStages.map(stage =>
          renderGroup(stage.id, stage.label, stage.color, projectTasks.filter(t2 => t2.project_stage === stage.label))
        )}
        {unassigned.length > 0 && renderGroup("__none", "No Stage", t.border2, unassigned)}
      </div>
    );
  };

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
                  <span style={{ fontSize:13, fontWeight:600, color:isTaskComplete(t2)?t.textFaint:t.textSub, textDecoration:isTaskComplete(t2)?"line-through":"none" }}>{t2.title}</span>
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
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexDirection:isMobile?"column":"row", gap:isMobile?10:0 }}>
          <div>
            <h1 style={{ margin:"0 0 6px", fontSize:22, fontWeight:800, color:t.text }}>{project.title}</h1>
            <div style={{ color:t.textMuted, fontSize:13 }}>{client?.name}{project.description?` · ${project.description}`:""}</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Badge label={project.stage} color={stageColor(project.stage)} />
            <Badge label={project.priority} color={priorityColor(project.priority)} />
            <Badge label={project.status} color={statusColor(project.status)} />
            <Badge label={projectPipeline.name} color={projectStages[0]?.color || t.accent} />
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
            ["Progress","📈", `${calcProgress(id,tasks,project,taskPipelines)}%`, null],
            ...(hasBudget ? [
              ["Budget","💰", `${CS}${((project.budget||0)/1_000_000).toFixed(2)}M`, null],
              ["Spent","📤", `${CS}${((project.budget_spent||0)/1_000_000).toFixed(2)}M`, budgetOver ? "#EF4444" : (budgetUsedPct >= 80 ? "#F59E0B" : "#059669")],
            ] : []),
          ];
          return (
            <>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":`repeat(${statItems.length},1fr)`, gap:14, marginBottom:16 }}>
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
        <ProgressBar value={calcProgress(id,tasks,project,taskPipelines)} color="#7C3AED" height={8} />
      </div>

      {/* ── Tasks ─────────────────────────────────────────────────────────────── */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:isMobile?"flex-start":"center", marginBottom:16, flexDirection:isMobile?"column":"row", gap:isMobile?10:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <h3 style={{ margin:0, color:t.text, fontSize:15, fontWeight:700 }}>Tasks ({projectTasks.length})</h3>
            {/* List / Kanban toggle */}
            <div style={{ display:"flex", gap:4, background:t.statBg, borderRadius:8, padding:3 }}>
              {[["list","☰ List"],["kanban","⊞ Kanban"],["stage","⬡ Stage"]].map(([mode, label]) => (
                <button key={mode} onClick={()=>setTaskView(mode)} style={{ ...bs, padding:"4px 12px", fontSize:11, fontWeight:700, background:taskView===mode?t.card:"transparent", color:taskView===mode?t.text:t.textMuted, border:`1px solid ${taskView===mode?t.border2:"transparent"}`, borderRadius:6, boxShadow:taskView===mode?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button onClick={()=>setShowTemplates(true)} style={{...bs, padding:"7px 14px", fontSize:12}}>📋 Templates</button>
            <button onClick={()=>{ setTaskForm({ ...BLANK_TASK, status:defaultTaskStatus }); setShowTaskForm(true); }} style={{...btnPrimary, padding:"7px 14px", fontSize:12}}>+ Add Task</button>
          </div>
        </div>

        {projectTasks.length === 0 && (
          <div style={{ padding:"32px 0", textAlign:"center", color:t.textFaint, fontSize:13 }}>
            No tasks yet.{" "}
            <button onClick={()=>setShowTemplates(true)} style={{ background:"none", border:"none", color:t.accent, cursor:"pointer", fontSize:13, fontWeight:700, textDecoration:"underline" }}>Use a template</button>{" "}
            or add tasks manually.
          </div>
        )}

        {taskView === "kanban" ? <KanbanView /> : taskView === "stage" ? <StageView /> : <ListView />}
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

      {/* ── Project Files ─────────────────────────────────────────────────────── */}
      {isSupabaseConfigured && (
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginTop:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <h3 style={{ margin:0, color:t.text, fontSize:15, fontWeight:700 }}>📂 Project Files {projFiles.length > 0 && <span style={{ fontSize:12, color:t.textFaint, fontWeight:400 }}>({projFiles.length})</span>}</h3>
            <div style={{ display:"flex", gap:8 }}>
              {!filesLoaded && (
                <button style={{...bs, padding:"6px 14px", fontSize:12}} onClick={loadProjectFiles} disabled={filesLoading}>
                  {filesLoading ? "Loading…" : "Load Files"}
                </button>
              )}
              {filesLoaded && (
                <button style={{ ...btnPrimary, padding:"6px 14px", fontSize:12 }} onClick={() => filesInputRef.current?.click()} disabled={filesUploading}>
                  {filesUploading ? "Uploading…" : "+ Upload"}
                </button>
              )}
            </div>
          </div>
          <input ref={filesInputRef} type="file" multiple style={{ display:"none" }} onChange={e => handleProjectFileUpload(e.target.files)} />
          {!filesLoaded ? (
            <div style={{ fontSize:12, color:t.textFaint, padding:"8px 0" }}>Click "Load Files" to view files attached to this project.</div>
          ) : filesLoading ? (
            <div style={{ display:"flex", alignItems:"center", gap:8, color:t.textMuted, fontSize:13, padding:"12px 0" }}>
              <div style={{ width:16, height:16, border:`2px solid ${t.border2}`, borderTopColor:t.accent, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
              Loading…
            </div>
          ) : projFiles.length === 0 ? (
            <div
              onDragOver={e => { e.preventDefault(); setFilesDragOver(true); }}
              onDragLeave={() => setFilesDragOver(false)}
              onDrop={e => { e.preventDefault(); setFilesDragOver(false); handleProjectFileUpload(e.dataTransfer.files); }}
              onClick={() => filesInputRef.current?.click()}
              style={{ border:`2px dashed ${filesDragOver ? t.accent : t.border2}`, borderRadius:10, padding:"24px 16px", textAlign:"center", cursor:"pointer", background:filesDragOver ? `${t.accent}11` : t.statBg }}
            >
              <div style={{ fontSize:22, marginBottom:6 }}>📂</div>
              <div style={{ fontSize:12, color:t.textMuted }}>Drop files here or click to upload</div>
            </div>
          ) : (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setFilesDragOver(true); }}
                onDragLeave={() => setFilesDragOver(false)}
                onDrop={e => { e.preventDefault(); setFilesDragOver(false); handleProjectFileUpload(e.dataTransfer.files); }}
                style={{ border:`2px dashed ${filesDragOver ? t.accent : "transparent"}`, borderRadius:8, transition:"border-color 0.15s", marginBottom:8 }}
              >
                {projFiles.map(f => (
                  <div key={f.id} style={{ display:"grid", gridTemplateColumns:"28px 1fr 90px 80px auto", alignItems:"center", gap:8, padding:"9px 10px", borderRadius:8, background:t.statBg, marginBottom:5, fontSize:12 }}>
                    <span style={{ fontSize:18, textAlign:"center" }}>{fileIcon(f.mime_type)}</span>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:600, color:t.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{f.name}</div>
                      <div style={{ fontSize:10, color:t.textGhost }}>{f.uploaded_by_name} · {new Date(f.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}</div>
                    </div>
                    <span style={{ color:t.textMuted, textAlign:"right" }}>{formatFileSize(f.file_size)}</span>
                    <span style={{ color:t.textFaint, textAlign:"center", background:t.card, border:`1px solid ${t.border}`, borderRadius:5, padding:"1px 7px" }}>{f.category}</span>
                    <div style={{ display:"flex", gap:5 }}>
                      <button onClick={() => handleProjectFileDownload(f)} title="Download" style={{ background:"transparent", border:`1px solid ${t.border2}`, borderRadius:6, padding:"3px 8px", fontSize:11, cursor:"pointer", color:t.textMuted }}>↓</button>
                      <button onClick={() => setFileToDelete(f)} title="Delete" style={{ background:"transparent", border:`1px solid ${t.border2}`, borderRadius:6, padding:"3px 8px", fontSize:11, cursor:"pointer", color:"#EF4444" }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:t.textGhost, marginTop:4 }}>Drop more files anywhere above to upload</div>
            </>
          )}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}

      <ConfirmModal
        open={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={() => handleProjectFileDelete(fileToDelete)}
        title={`Delete "${fileToDelete?.name || "this file"}"?`}
        message="This will permanently remove the file from storage."
        confirmLabel="Delete File"
      />

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
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <FormField label="Stage">
              <select style={sS} value={editTaskForm.project_stage||""} onChange={e=>setEditTaskForm({...editTaskForm,project_stage:e.target.value})}>
                <option value="">No Stage</option>
                {projectStages.map(s=><option key={s.id} value={s.label}>{s.label}</option>)}
              </select>
            </FormField>
            <FormField label="Status"><select style={sS} value={editTaskForm.status} onChange={e=>setEditTaskForm({...editTaskForm,status:e.target.value})}>{KANBAN_COLS.map(s=><option key={s} value={s}>{s}</option>)}</select></FormField>
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <FormField label="Stage">
            <select style={sS} value={taskForm.project_stage||""} onChange={e=>setTaskForm({...taskForm,project_stage:e.target.value})}>
              <option value="">No Stage</option>
              {projectStages.map(s=><option key={s.id} value={s.label}>{s.label}</option>)}
            </select>
          </FormField>
          <FormField label="Status"><select style={sS} value={taskForm.status} onChange={e=>setTaskForm({...taskForm,status:e.target.value})}>{KANBAN_COLS.map(s=><option key={s} value={s}>{s}</option>)}</select></FormField>
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
                {getProjectPipeline({ pipeline_id: editForm.pipeline_id }, taskPipelines).statuses.map(s=><option key={s.id} value={s.label}>{s.label}</option>)}
              </select>
            </FormField>
            <FormField label="Priority">
              <select style={sS} value={editForm.priority} onChange={e=>setEditForm({...editForm,priority:e.target.value})}>
                {["Critical","High","Medium","Low"].map(s=><option key={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Project Pipeline">
            <select style={sS} value={editForm.pipeline_id || DEFAULT_PROJECT_PIPELINE_ID} onChange={e=>{
              const pipeline_id = e.target.value;
              setEditForm({...editForm,pipeline_id,stage:mapStatusToPipeline(editForm.stage,{ pipeline_id },taskPipelines)});
            }}>
              {taskPipelines.map(pipeline => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
            </select>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:7 }}>
              {getProjectPipeline({ pipeline_id: editForm.pipeline_id }, taskPipelines).statuses.map(status => (
                <span key={status.id} style={{ fontSize:10, fontWeight:700, color:status.color, border:`1px solid ${status.color}44`, background:`${status.color}12`, borderRadius:99, padding:"2px 7px" }}>{status.label}</span>
              ))}
            </div>
          </FormField>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FormField label="Status">
              <select style={sS} value={editForm.status} onChange={e=>setEditForm({...editForm,status:e.target.value})}>
                {["Active","On Hold","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Progress">
              <div style={{ ...iS, display:"flex", alignItems:"center", gap:8, cursor:"default" }}>
                <span style={{ fontWeight:700 }}>{calcProgress(id,tasks,project,taskPipelines)}%</span>
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
            <button key={tmpl.name} onClick={()=>{ applyTemplate(tmpl, stageForTemplate); setShowTemplates(false); setStageForTemplate(""); }} style={{ textAlign:"left", background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:12, padding:"16px", cursor:"pointer" }}>
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
