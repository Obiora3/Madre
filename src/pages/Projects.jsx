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

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
export const Projects = React.memo(function Projects() {
  const { projects, setProjects, clients, nav } = useApp();
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ title:"", client_id:"", description:"", stage:"Brief", priority:"Medium", assigned_to_name:"", assigned_to_email:"", start_date:"", due_date:"", status:"Active", progress:0, kpi_summary:"" });
  const stages = ["Brief", "Strategy", "Creative", "Review", "Delivered"];
  const priorities = ["All", "Critical", "High", "Medium", "Low"];
  const filtered = projects.filter(p => filter === "All" || p.priority === filter);

  const handleCreate = () => {
    const { assigned_to_name, assigned_to_email, ...rest } = form;
    const np = { ...rest, id: "p"+Date.now(), assigned_to: { name: assigned_to_name, email: assigned_to_email } };
    setProjects([...projects, np]);
    toast({ message: `Project "${form.title}" created`, sub: `${form.stage} · ${form.priority} priority`, type: "success" });
    setShowForm(false);
    setForm({ title:"", client_id:"", description:"", stage:"Brief", priority:"Medium", assigned_to_name:"", assigned_to_email:"", start_date:"", due_date:"", status:"Active", progress:0, kpi_summary:"" });
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
        {stages.map(stage => (
          <div key={stage}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: stageColor(stage) }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{stage}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: t.textFaint }}>{filtered.filter(p=>p.stage===stage).length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.filter(p => p.stage === stage).map(p => {
                const client = clients.find(c => c.id === p.client_id);
                return (
                  <div key={p.id} onClick={() => nav("project-detail", p.id)} style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 12, padding: 14, cursor: "pointer", position:"relative" }}>
                    <button onClick={e => { e.stopPropagation(); setConfirmDelete(p); }} title="Delete project" style={{ position:"absolute", top:8, right:8, background:"none", border:"none", color:t.textGhost, cursor:"pointer", fontSize:15, lineHeight:1, padding:"1px 4px", borderRadius:4 }}>×</button>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6, lineHeight: 1.3, paddingRight: 16 }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 8 }}>{client?.name || "—"}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Badge label={p.priority} color={priorityColor(p.priority)} />
                      <Badge label={p.status} color={statusColor(p.status)} />
                    </div>
                    <ProgressBar value={p.progress} color={stageColor(stage)} />
                    <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>{p.progress}% · {fmtDate(p.due_date)}</div>
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
        <FormField label="Assign To (name)"><input style={iS} value={form.assigned_to_name} onChange={e=>setForm({...form,assigned_to_name:e.target.value})} placeholder="Full name" /></FormField>
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
