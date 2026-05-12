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

export const Clients = React.memo(function Clients() {
  const { clients, setClients, projects } = useApp();
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ name:"", brand:"", industry:"Technology", primary_contact:{name:"",email:"",phone:""}, status:"Active", health_score:70, notes:"" });
  const handleSave = () => {
    if (editClient) {
      setClients(clients.map(c=>c.id===editClient.id?{...form,id:editClient.id}:c));
      toast({ message: `"${form.name}" updated`, sub: form.industry, type: "success" });
    } else {
      setClients([...clients, { ...form, id:"c"+Date.now() }]);
      toast({ message: `Client "${form.name}" added`, sub: form.industry, type: "success" });
    }
    setShowForm(false); setEditClient(null);
  };
  const openEdit = (c) => { setForm({...c}); setEditClient(c); setShowForm(true); };
  const industries = ["Technology","Fashion","FMCG","Finance","Healthcare","Retail","Automotive","Entertainment","Food & Beverage","Other"];
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>Clients</h1>
        <button style={btnPrimary} onClick={()=>{setEditClient(null);setForm({name:"",brand:"",industry:"Technology",primary_contact:{name:"",email:"",phone:""},status:"Active",health_score:70,notes:""});setShowForm(true);}}>+ New Client</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
        {clients.map(c=>{
          const proj = projects.filter(p=>p.client_id===c.id && p.status==="Active").length;
          const hc = c.health_score >= 80 ? "#059669" : c.health_score >= 60 ? "#F59E0B" : "#EF4444";
          return (
            <div key={c.id} onClick={()=>openEdit(c)} style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:t.text }}>{c.name}</div>
                  <div style={{ fontSize:12, color:t.textMuted }}>{c.industry}</div>
                </div>
                <Badge label={c.status} color={statusColor(c.status)} />
              </div>
              <div style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:12, color:t.textMuted }}>Relationship Health</span>
                  <span style={{ fontSize:12, color:hc, fontWeight:700 }}>{c.health_score}/100</span>
                </div>
                <ProgressBar value={c.health_score} color={hc} height={6} />
              </div>
              <div style={{ fontSize:12, color:t.textMuted, marginBottom:4 }}>👤 {c.primary_contact?.name}</div>
              <div style={{ fontSize:12, color:t.textMuted, marginBottom:10 }}>✉️ {c.primary_contact?.email}</div>
              <div style={{ fontSize:12, color:t.accentLight, fontWeight:600 }}>{proj} active project{proj!==1?"s":""}</div>
            </div>
          );
        })}
      </div>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editClient?"Edit Client":"New Client"}>
        <FormField label="Name"><input style={iS} value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} /></FormField>
        <FormField label="Industry"><select style={sS} value={form.industry||"Technology"} onChange={e=>setForm({...form,industry:e.target.value})}>{industries.map(i=><option key={i}>{i}</option>)}</select></FormField>
        <FormField label="Status"><select style={sS} value={form.status||"Active"} onChange={e=>setForm({...form,status:e.target.value})}>{["Active","On Hold","Completed","Archived"].map(s=><option key={s}>{s}</option>)}</select></FormField>
        <FormField label="Contact Name"><input style={iS} value={form.primary_contact?.name||""} onChange={e=>setForm({...form,primary_contact:{...form.primary_contact,name:e.target.value}})} /></FormField>
        <FormField label="Contact Email"><input style={iS} value={form.primary_contact?.email||""} onChange={e=>setForm({...form,primary_contact:{...form.primary_contact,email:e.target.value}})} /></FormField>
        <FormField label="Health Score (0–100)"><input type="number" style={iS} value={form.health_score||70} onChange={e=>setForm({...form,health_score:Number(e.target.value)})} min={0} max={100} /></FormField>
        <FormField label="Notes"><textarea style={{...iS,height:70,resize:"vertical"}} value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} /></FormField>
        <div style={{ display:"flex", gap:10, justifyContent:"space-between", alignItems:"center" }}>
          {editClient && (
            <button
              onClick={() => { setShowForm(false); setConfirmDelete(editClient); }}
              style={{ background:"none", border:"none", color:"#EF4444", fontSize:13, cursor:"pointer", fontWeight:600, padding:0 }}
            >
              🗑 Delete client
            </button>
          )}
          <div style={{ display:"flex", gap:10, marginLeft:"auto" }}>
            <button style={bs} onClick={()=>setShowForm(false)}>Cancel</button>
            <button style={btnPrimary} onClick={handleSave} disabled={!form.name}>Save Client</button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          setClients(clients.filter(c => c.id !== confirmDelete.id));
          toast({ message: `"${confirmDelete.name}" deleted`, sub: "Client removed permanently", type: "warning" });
        }}
        title={`Delete "${confirmDelete?.name}"?`}
        message={`This will permanently remove ${confirmDelete?.name} and all their contact information. Any associated projects will remain but lose their client link.`}
        confirmLabel="Delete Client"
      />
    </div>
  );
})
