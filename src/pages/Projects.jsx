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

const STAGES = ["Brief", "Strategy", "Creative", "Review", "Delivered"];
const BLANK_FORM = { title:"", client_id:"", description:"", stage:"Brief", priority:"Medium", assigneeId:"", start_date:"", due_date:"", status:"Active", progress:0, kpi_summary:"" };

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
export const Projects = React.memo(function Projects() {
  const { projects, setProjects, tasks, clients, users, nav } = useApp();
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const priorities = ["All", "Critical", "High", "Medium", "Low"];
  const filtered = projects.filter(p => filter === "All" || p.priority === filter);

  const handleCreate = () => {
    const { assigneeId, ...rest } = form;
    const assignee = assigneeId ? users.find(u => u.id === assigneeId) : null;
    const np = { ...rest, id: "p"+Date.now(), assigned_to: assignee ? { name: assignee.name, email: assignee.email } : {} };
    setProjects([...projects, np]);
    toast({ message: `Project "${form.title}" created`, sub: `${form.stage} · ${form.priority} priority`, type: "success" });
    setShowForm(false);
    setForm(BLANK_FORM);
  };

  const advanceStage = (e, p) => {
    e.stopPropagation();
    const idx = STAGES.indexOf(p.stage);
    if (idx < 0 || idx >= STAGES.length - 1) return;
    const nextStage = STAGES[idx + 1];
    setProjects(projects.map(x => x.id === p.id ? { ...x, stage: nextStage } : x));
    toast({ message: `"${p.title}" moved to ${nextStage}` });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: t.text }}>Projects</h1>
        <button onClick={() => setShowForm(true)} style={btnPrimary}>+ New Project</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {priorities.map(p => (
          <button key={p} onClick={() => setFilter(p)} style={{ ...bs, background: filter===p?"#7C3AED":t.toggleBg, color: filter===p?"#fff":t.textSub, border: `1px solid ${filter===p?"#7C3AED":t.border2}`, padding: "6px 14px", fontSize: 12 }}>{p}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
        {STAGES.map((stage, stageIdx) => (
          <div key={stage}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: stageColor(stage) }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{stage}</span>
              {stageIdx < STAGES.length - 1 && <span style={{ fontSize: 10, color: t.textGhost }}>→</span>}
              <span style={{ marginLeft: "auto", fontSize: 11, color: t.textFaint }}>{filtered.filter(p=>p.stage===stage).length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.filter(p => p.stage === stage).map(p => {
                const client = clients.find(c => c.id === p.client_id);
                const nextStage = STAGES[stageIdx + 1];
                return (
                  <div key={p.id} onClick={() => nav("project-detail", p.id)} style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 12, padding: 14, cursor: "pointer", position:"relative" }}>
                    <button onClick={e => { e.stopPropagation(); setConfirmDelete(p); }} title="Delete project" style={{ position:"absolute", top:8, right:8, background:"none", border:"none", color:t.textGhost, cursor:"pointer", fontSize:15, lineHeight:1, padding:"1px 4px", borderRadius:4 }}>×</button>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6, lineHeight: 1.3, paddingRight: 16 }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 8 }}>{client?.name || "—"}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Badge label={p.priority} color={priorityColor(p.priority)} />
                      <Badge label={p.status} color={statusColor(p.status)} />
                    </div>
                    <ProgressBar value={calcProgress(p.id, tasks)} color={stageColor(stage)} />
                    <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>{calcProgress(p.id, tasks)}% · {fmtDate(p.due_date)}</div>
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
            {["Brief","Strategy","Creative","Review","Delivered"].map(s=><option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select style={sS} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
            {["Critical","High","Medium","Low"].map(s=><option key={s}>{s}</option>)}
          </select>
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
          setProjects(projects.filter(p => p.id !== confirmDelete.id));
          toast({ message: `"${confirmDelete.title}" deleted`, sub: "Project removed permanently", type: "warning" });
        }}
        title={`Delete "${confirmDelete?.title}"?`}
        message={`This will permanently remove the project and cannot be undone. Associated tasks and KPIs will remain but lose their project link.`}
        confirmLabel="Delete Project"
      />
    </div>
  );
})
