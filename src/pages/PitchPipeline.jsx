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

export const PitchPipeline = React.memo(function PitchPipeline() {
  const { pitches, setPitches } = useApp();
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const [viewMode, setViewMode] = useState("Kanban");
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ title:"", prospect_company:"", contact_name:"", contact_email:"", industry:"Technology", stage:"Lead", estimated_value:0, currency:"USD", win_probability:50, pitch_type:"Brand Campaign", owner:"", decision_date:"", notes:"" });
  const stages = ["Lead","Qualified","Proposal Sent","Negotiation","Won","Lost"];
  const stColors = { Lead:"#6B7280", Qualified:"#3B82F6", "Proposal Sent":"#F59E0B", Negotiation:"#F97316", Won:"#059669", Lost:"#EF4444" };
  const { totalPipeline, wonRevenue, winRate } = useMemo(() => {
    const active = pitches.filter(p => !["Won","Lost"].includes(p.stage));
    const won    = pitches.filter(p => p.stage === "Won");
    return {
      totalPipeline: active.reduce((s,p) => s + p.estimated_value * (p.win_probability / 100), 0),
      wonRevenue:    won.reduce((s,p) => s + p.estimated_value, 0),
      winRate:       pitches.length ? Math.round((won.length / pitches.length) * 100) : 0,
    };
  }, [pitches]);
  const handleCreate = () => {
    setPitches([...pitches,{...form,id:"pi"+Date.now()}]);
    toast({ message: `Pitch "${form.title}" created`, sub: `${form.stage} · $${Number(form.estimated_value).toLocaleString()}`, type: "success" });
    setShowForm(false);
  };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>Pitch Pipeline</h1>
        <div style={{ display:"flex", gap:8 }}>
          {["Kanban","List"].map(m=><button key={m} onClick={()=>setViewMode(m)} style={{...bs,background:viewMode===m?"#7C3AED":t.toggleBg,color:viewMode===m?"#fff":t.textSub,padding:"7px 14px",fontSize:12}}>{m}</button>)}
          <button style={btnPrimary} onClick={()=>setShowForm(true)}>+ New Pitch</button>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        <StatCard icon="📊" label="Active Pitches" value={pitches.filter(p=>!["Won","Lost"].includes(p.stage)).length} />
        <StatCard icon="💰" label="Weighted Pipeline" value={`$${Math.round(totalPipeline/1000)}k`} />
        <StatCard icon="🏆" label="Won Revenue" value={`$${Math.round(wonRevenue/1000)}k`} />
        <StatCard icon="%" label="Win Rate" value={`${winRate}%`} />
      </div>
      {viewMode === "Kanban" ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12 }}>
          {stages.map(stage=>(
            <div key={stage}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                <div style={{ width:8,height:8,borderRadius:"50%",background:stColors[stage] }} />
                <span style={{ fontSize:11,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.06em" }}>{stage}</span>
              </div>
              {pitches.filter(p=>p.stage===stage).map(p=>(
                <div key={p.id} style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:10,padding:12,marginBottom:8 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:t.text,marginBottom:4,lineHeight:1.3 }}>{p.title}</div>
                  <div style={{ fontSize:11,color:t.textFaint,marginBottom:6 }}>{p.prospect_company}</div>
                  <div style={{ fontSize:12,fontWeight:600,color:t.accentLight,marginBottom:4 }}>${p.estimated_value.toLocaleString()}</div>
                  <div style={{ fontSize:11,color:t.textFaint }}>{p.win_probability}% prob.</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,overflow:"hidden" }}>
          {pitches.map(p=>(
            <div key={p.id} style={{ display:"grid",gridTemplateColumns:"1fr 120px 100px 100px 80px 80px 40px",padding:"12px 16px",borderBottom:`1px solid ${t.divider}`,alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13,fontWeight:600,color:t.textSub }}>{p.title}</div>
                <div style={{ fontSize:11,color:t.textFaint }}>{p.prospect_company} · {p.industry}</div>
              </div>
              <Badge label={p.stage} color={stColors[p.stage]||"#666"} />
              <div style={{ fontSize:13,color:t.accentLight,fontWeight:600 }}>${p.estimated_value.toLocaleString()}</div>
              <div style={{ fontSize:13,color:t.textMuted }}>{p.win_probability}% prob.</div>
              <div style={{ fontSize:12,color:t.textFaint }}>{fmtDate(p.decision_date)}</div>
              <div style={{ fontSize:12,color:t.textFaint }}>{p.owner}</div>
              <button onClick={() => setConfirmDelete(p)} title="Delete pitch" style={{ background:"none", border:"none", color:t.textGhost, cursor:"pointer", fontSize:16, padding:"2px 6px", borderRadius:4 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="New Pitch">
        <FormField label="Title"><input style={iS} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></FormField>
        <FormField label="Prospect Company"><input style={iS} value={form.prospect_company} onChange={e=>setForm({...form,prospect_company:e.target.value})} /></FormField>
        <FormField label="Stage"><select style={sS} value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{stages.map(s=><option key={s}>{s}</option>)}</select></FormField>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <FormField label="Est. Value ($)"><input type="number" style={iS} value={form.estimated_value} onChange={e=>setForm({...form,estimated_value:Number(e.target.value)})} /></FormField>
          <FormField label="Win Probability %"><input type="number" style={iS} value={form.win_probability} onChange={e=>setForm({...form,win_probability:Number(e.target.value)})} min={0} max={100} /></FormField>
        </div>
        <FormField label="Notes"><textarea style={{...iS,height:60}} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></FormField>
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
          <button style={bs} onClick={()=>setShowForm(false)}>Cancel</button>
          <button style={btnPrimary} onClick={handleCreate} disabled={!form.title}>Create Pitch</button>
        </div>
      </Modal>
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          setPitches(pitches.filter(p => p.id !== confirmDelete.id));
          toast({ message: `"${confirmDelete.title}" removed`, sub: "Pitch deleted permanently", type: "warning" });
        }}
        title={`Delete "${confirmDelete?.title}"?`}
        message={`This will permanently remove this pitch from the pipeline. This cannot be undone.`}
        confirmLabel="Delete Pitch"
      />
    </div>
  );
})
