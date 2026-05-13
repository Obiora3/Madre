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

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────
export const Departments = React.memo(function Departments() {
  const { departments, setDepartments, users, currentUser } = useApp();
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // holds dept to delete
  const [form, setForm] = useState({ name:"", colour:"#7C3AED", description:"", lead:null, members:[] });
  const handleSave = () => {
    if (editDept) {
      setDepartments(departments.map(d=>d.id===editDept.id?{...form,id:editDept.id}:d));
      toast({ message: `"${form.name}" department updated`, type: "success" });
    } else {
      setDepartments([...departments, {...form, id:"d"+Date.now()}]);
      toast({ message: `Department "${form.name}" created`, sub: `${form.members.length} member(s)`, type: "success" });
    }
    setShowForm(false); setEditDept(null);
  };
  const openEdit = (d) => { setForm({...d}); setEditDept(d); setShowForm(true); };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>Departments</h1>
        <button style={btnPrimary} onClick={()=>{setEditDept(null);setForm({name:"",colour:"#7C3AED",description:"",lead:null,members:[]});setShowForm(true);}}>+ New Department</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        <StatCard icon="🏢" label="Departments" value={departments.length} />
        <StatCard icon="👥" label="Total Members" value={[...new Set(departments.flatMap(d=>d.members))].length} />
        <StatCard icon="👑" label="With Lead" value={departments.filter(d=>d.lead).length} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
        {departments.map(d=>{
          const leadFromUsers = users.find(u=>u.email===d.lead);
          const lead = leadFromUsers
            ? (currentUser && leadFromUsers.email === currentUser.email ? { ...leadFromUsers, ...currentUser } : leadFromUsers)
            : (currentUser && currentUser.email === d.lead ? currentUser : null);
          const memberUsers = users.filter(u=>d.members.includes(u.email));
          return (
            <div key={d.id} style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden" }}>
              <div style={{ height:6, background:d.colour }} />
              <div style={{ padding:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:t.text }}>{d.name}</div>
                    <div style={{ fontSize:12, color:t.textMuted, marginTop:2 }}>{d.description}</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>openEdit(d)} style={{...bs,padding:"4px 10px",fontSize:11}}>Edit</button>
                    <button onClick={()=>setConfirmDelete(d)} style={{...bs,padding:"4px 10px",fontSize:11,color:"#EF4444",borderColor:"#EF444444"}}>Delete</button>
                  </div>
                </div>
                {lead && (
                  <div style={{ background:"#F59E0B11", border:"1px solid #F59E0B33", borderRadius:8, padding:"8px 12px", marginBottom:12 }}>
                    <div style={{ fontSize:11, color:"#F59E0B", fontWeight:700, marginBottom:4 }}>👑 Department Lead</div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <Avatar name={lead.name} size={28} />
                      <div>
                        <div style={{ fontSize:13, color:t.text, fontWeight:600 }}>{lead.name}</div>
                        <div style={{ fontSize:11, color:t.textMuted }}>{lead.job_title}</div>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {memberUsers.map(u=>(
                    <div key={u.id} style={{ display:"flex", alignItems:"center", gap:6, background:t.toggleBg, borderRadius:99, padding:"4px 10px 4px 4px" }}>
                      <Avatar name={u.name} size={20} />
                      <span style={{ fontSize:11, color:t.textSub }}>{u.name.split(" ")[0]}</span>
                      {u.email===d.lead && <span style={{ fontSize:9 }}>👑</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          setDepartments(departments.filter(x => x.id !== confirmDelete.id));
          toast({ message: `"${confirmDelete.name}" department deleted`, type: "warning" });
        }}
        title={`Delete "${confirmDelete?.name}"?`}
        message={`This will permanently remove the ${confirmDelete?.name} department and cannot be undone. Members will not be deleted.`}
        confirmLabel="Delete Department"
      />
      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editDept?"Edit Department":"New Department"}>
        <FormField label="Name"><input style={iS} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></FormField>
        <FormField label="Colour"><input type="color" style={{...iS,padding:4,height:40}} value={form.colour} onChange={e=>setForm({...form,colour:e.target.value})} /></FormField>
        <FormField label="Description"><textarea style={{...iS,height:60}} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></FormField>
        <FormField label="Lead"><select style={sS} value={form.lead||""} onChange={e=>setForm({...form,lead:e.target.value||null})}><option value="">No lead assigned</option>{users.map(u=><option key={u.id} value={u.email}>{u.name}</option>)}</select></FormField>
        <FormField label="Members">
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:4 }}>
            {users.map(u=>{
              const selected = form.members.includes(u.email);
              return (
                <button key={u.id} onClick={()=>setForm({...form,members:selected?form.members.filter(m=>m!==u.email):[...form.members,u.email]})} style={{ display:"flex", alignItems:"center", gap:6, background:selected?t.navActive:t.toggleBg, border:`1px solid ${selected?t.accent:t.border2}`, borderRadius:99, padding:"5px 10px 5px 5px", cursor:"pointer" }}>
                  <Avatar name={u.name} size={22} />
                  <span style={{ fontSize:12, color:selected?t.navActiveText:t.textMuted }}>{u.name}</span>
                </button>
              );
            })}
          </div>
        </FormField>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={bs} onClick={()=>setShowForm(false)}>Cancel</button>
          <button style={btnPrimary} onClick={handleSave} disabled={!form.name}>Save</button>
        </div>
      </Modal>
    </div>
  );
})
