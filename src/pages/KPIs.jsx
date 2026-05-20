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

const BLANK_KPI = { name:"", project_id:"", category:"Brand Awareness", target_value:100, current_value:0, unit:"%", status:"Not Started", notes:"" };

export const KPIs = React.memo(function KPIs() {
  const { kpis, setKpis, projects, isMobile } = useApp();
  const projectById = useMemo(() => Object.fromEntries((projects||[]).map(p => [p.id, p])), [projects]);
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editKpi, setEditKpi] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState(BLANK_KPI);
  const statuses = ["All","On Track","At Risk","Behind","Achieved","Not Started"];
  const filtered = kpis.filter(k => filter==="All" || k.status===filter);

  const handleCreate = () => {
    setKpis([...kpis, { ...form, id:"k"+Date.now() }]);
    toast({ message: `KPI "${form.name}" created`, sub: `${form.category} · Target: ${form.target_value}${form.unit}`, type: "success" });
    setShowForm(false);
    setForm(BLANK_KPI);
  };

  const openEdit = (k) => { setEditKpi(k); setEditForm({ name:k.name, project_id:k.project_id||"", category:k.category||"Brand Awareness", target_value:k.target_value, current_value:k.current_value, unit:k.unit||"%", status:k.status||"Not Started", notes:k.notes||"" }); };
  const handleEditSave = () => {
    if (!editForm?.name?.trim()) { toast({ message:"Name is required.", type:"error" }); return; }
    setKpis(kpis.map(k => k.id === editKpi.id ? { ...editKpi, ...editForm } : k));
    toast({ message: `KPI "${editForm.name}" updated.` });
    setEditKpi(null); setEditForm(null);
  };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>KPIs</h1>
        <button style={btnPrimary} onClick={()=>setShowForm(true)}>+ New KPI</button>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {statuses.map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{...bs, background:filter===s?t.navActive:t.toggleBg, color:filter===s?t.navActiveText:t.textMuted, border:`1px solid ${filter===s?t.accent:t.border}`, padding:"6px 14px", fontSize:12}}>{s}</button>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${isMobile ? 1 : 3},1fr)`, gap:16 }}>
        {filtered.map(k=>{
          const pct = k.target_value > 0 ? Math.min(100, Math.round((k.current_value/k.target_value)*100)) : 0;
          const proj = projectById[k.project_id];
          return (
            <div key={k.id} style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ flex:1, minWidth:0, marginRight:10 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:t.text, marginBottom:2 }}>{k.name}</div>
                  <div style={{ fontSize:11, color:t.textFaint }}>{k.category}</div>
                  {proj && (
                    <div style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:5, background:t.navActive, borderRadius:6, padding:"2px 8px" }}>
                      <span style={{ fontSize:10 }}>↗</span>
                      <span style={{ fontSize:11, fontWeight:600, color:t.navActiveText }}>{proj.title}</span>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                  <Badge label={k.status} color={statusColor(k.status)} />
                  <button onClick={() => openEdit(k)} title="Edit KPI" style={{ background:"none", border:"none", color:t.textGhost, cursor:"pointer", fontSize:13, padding:"2px 6px", borderRadius:4, lineHeight:1 }}>✏</button>
                  <button onClick={() => setConfirmDelete(k)} title="Delete KPI" style={{ background:"none", border:"none", color:t.textGhost, cursor:"pointer", fontSize:17, lineHeight:1, padding:"0 4px", borderRadius:4 }}>×</button>
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <ProgressBar value={k.current_value} max={k.target_value||1} color={statusColor(k.status)} height={8} />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                  <span style={{ fontSize:11, color:t.textMuted }}>{k.current_value.toLocaleString()} {k.unit}</span>
                  <span style={{ fontSize:11, color:t.textFaint }}>Target: {k.target_value.toLocaleString()} {k.unit}</span>
                </div>
              </div>
              <div style={{ fontSize:13, fontWeight:800, color:statusColor(k.status), marginBottom:6 }}>{pct}%</div>
              {k.notes && <div style={{ fontSize:11, color:t.textMuted, background:t.statBg, borderRadius:6, padding:"6px 10px" }}>{k.notes}</div>}
            </div>
          );
        })}
      </div>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="New KPI">
        <FormField label="Name"><input style={iS} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></FormField>
        <FormField label="Project"><select style={sS} value={form.project_id} onChange={e=>setForm({...form,project_id:e.target.value})}><option value="">Select project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></FormField>
        <FormField label="Category"><select style={sS} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{["Brand Awareness","Engagement","Conversion","Revenue","Reach","Retention","Lead Generation","Other"].map(c=><option key={c}>{c}</option>)}</select></FormField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <FormField label="Target"><input type="number" style={iS} value={form.target_value} onChange={e=>setForm({...form,target_value:Number(e.target.value)})} /></FormField>
          <FormField label="Current"><input type="number" style={iS} value={form.current_value} onChange={e=>setForm({...form,current_value:Number(e.target.value)})} /></FormField>
          <FormField label="Unit"><select style={sS} value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>{["%","Count","Currency","Score"].map(u=><option key={u}>{u}</option>)}</select></FormField>
        </div>
        <FormField label="Status"><select style={sS} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{["On Track","At Risk","Behind","Achieved","Not Started"].map(s=><option key={s}>{s}</option>)}</select></FormField>
        <FormField label="Notes"><textarea style={{...iS,height:60,resize:"vertical"}} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></FormField>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={bs} onClick={()=>setShowForm(false)}>Cancel</button>
          <button style={btnPrimary} onClick={handleCreate} disabled={!form.name}>Create KPI</button>
        </div>
      </Modal>
      {editForm && (
        <Modal open={!!editKpi} onClose={() => { setEditKpi(null); setEditForm(null); }} title="Edit KPI">
          <FormField label="Name"><input style={iS} value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></FormField>
          <FormField label="Project"><select style={sS} value={editForm.project_id} onChange={e=>setEditForm({...editForm,project_id:e.target.value})}><option value="">No project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></FormField>
          <FormField label="Category"><select style={sS} value={editForm.category} onChange={e=>setEditForm({...editForm,category:e.target.value})}>{["Brand Awareness","Engagement","Conversion","Revenue","Reach","Retention","Lead Generation","Other"].map(c=><option key={c}>{c}</option>)}</select></FormField>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <FormField label="Target"><input type="number" style={iS} value={editForm.target_value} onChange={e=>setEditForm({...editForm,target_value:Number(e.target.value)})} /></FormField>
            <FormField label="Current"><input type="number" style={iS} value={editForm.current_value} onChange={e=>setEditForm({...editForm,current_value:Number(e.target.value)})} /></FormField>
            <FormField label="Unit"><select style={sS} value={editForm.unit} onChange={e=>setEditForm({...editForm,unit:e.target.value})}>{["%","Count","Currency","Score"].map(u=><option key={u}>{u}</option>)}</select></FormField>
          </div>
          <FormField label="Status"><select style={sS} value={editForm.status} onChange={e=>setEditForm({...editForm,status:e.target.value})}>{["On Track","At Risk","Behind","Achieved","Not Started"].map(s=><option key={s}>{s}</option>)}</select></FormField>
          <FormField label="Notes"><textarea style={{...iS,height:60,resize:"vertical"}} value={editForm.notes} onChange={e=>setEditForm({...editForm,notes:e.target.value})} /></FormField>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={bs} onClick={() => { setEditKpi(null); setEditForm(null); }}>Cancel</button>
            <button style={btnPrimary} onClick={handleEditSave} disabled={!editForm.name}>Save Changes</button>
          </div>
        </Modal>
      )}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          setKpis(kpis.filter(k => k.id !== confirmDelete.id));
          toast({ message: `"${confirmDelete.name}" deleted`, sub: "KPI removed permanently", type: "warning" });
        }}
        title={`Delete "${confirmDelete?.name}"?`}
        message={`This will permanently remove this KPI and its tracking data. This cannot be undone.`}
        confirmLabel="Delete KPI"
      />
    </div>
  );
})
