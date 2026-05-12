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

export const AIBrief = React.memo(function AIBrief() {
  const { clients } = useApp();
  const { theme: t } = useTheme();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const [client, setClient] = useState("");
  const [projectType, setProjectType] = useState("Brand Campaign");
  const [bullets, setBullets] = useState([""]);
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);
  const addBullet = () => setBullets([...bullets,""]);
  const updateBullet = (i,v) => setBullets(bullets.map((b,idx)=>idx===i?v:b));
  const removeBullet = (i) => setBullets(bullets.filter((_,idx)=>idx!==i));
  const generate = async () => {
    setLoading(true); setBrief(null); setBriefError(null);
    try {
      const cl = clients.find(c=>c.id===client);
      const result = await callClaude(
        `Generate a structured project brief for ${cl?.name||"a client"}.\n\nProject Type: ${projectType}\nKey Points:\n${bullets.filter(Boolean).map(b=>`• ${b}`).join("\n")}\n\nFormat your response as JSON with these keys: objective, target_audience, key_messages, deliverables, success_metrics, timeline_considerations, budget_notes. Each value should be a 2-3 sentence paragraph.`,
        "You are a senior agency strategist. Return only valid JSON, no markdown."
      );
      try { const clean = result.replace(/```json|```/g,"").trim(); setBrief(JSON.parse(clean)); }
      catch { setBrief({ objective: result, target_audience:"", key_messages:"", deliverables:"", success_metrics:"", timeline_considerations:"", budget_notes:"" }); }
    } catch (err) {
      setBriefError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const copy = () => {
    if (!brief) return;
    const text = Object.entries(brief).map(([k,v])=>`${k.replace(/_/g," ").toUpperCase()}\n${v}`).join("\n\n");
    navigator.clipboard.writeText(text);
  };
  const briefSections = [["objective","🎯 Objective"],["target_audience","👥 Target Audience"],["key_messages","💬 Key Messages"],["deliverables","📦 Deliverables"],["success_metrics","📊 Success Metrics"],["timeline_considerations","📅 Timeline"],["budget_notes","💰 Budget Notes"]];
  return (
    <div>
      <h1 style={{ margin:"0 0 6px",fontSize:26,fontWeight:800,color:t.text }}>AI Brief Assistant</h1>
      <p style={{ margin:"0 0 24px",color:t.textMuted,fontSize:13 }}>Generate a structured project brief from bullet-point inputs.</p>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:24 }}>
        <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,padding:20 }}>
          <FormField label="Client"><select style={sS} value={client} onChange={e=>setClient(e.target.value)}><option value="">Select client (optional)</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
          <FormField label="Project Type"><select style={sS} value={projectType} onChange={e=>setProjectType(e.target.value)}>{["Brand Campaign","Retainer","Project-based","Consulting","Other"].map(t2=><option key={t2}>{t2}</option>)}</select></FormField>
          <FormField label="Key Points">
            {bullets.map((b,i)=>(
              <div key={i} style={{ display:"flex",gap:6,marginBottom:8 }}>
                <input style={{...iS,flex:1}} value={b} onChange={e=>updateBullet(i,e.target.value)} placeholder={`Point ${i+1}…`} />
                {bullets.length>1 && <button onClick={()=>removeBullet(i)} style={{...bs,padding:"0 10px",color:"#EF4444"}}>×</button>}
              </div>
            ))}
            <button onClick={addBullet} style={{...bs,width:"100%",fontSize:12,marginTop:4}}>+ Add point</button>
          </FormField>
          <button onClick={generate} style={{...btnPrimary,width:"100%",marginTop:8}} disabled={loading||!bullets.filter(Boolean).length}>{loading?"Generating…":"Generate Brief ✨"}</button>
        </div>
        <div>
          {!brief && !loading && !briefError && <div style={{ background:t.card,border:`1px dashed ${t.border2}`,borderRadius:14,padding:40,textAlign:"center",color:t.textFaint,fontSize:14 }}>Your AI-generated brief will appear here.</div>}
          {(loading || briefError) && <AIBlock loading={loading} error={briefError} result={null} onRetry={generate} />}
          {brief && (
            <div style={{ background:t.card,border:`1px solid ${t.accent}44`,borderRadius:14,padding:24 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
                <h3 style={{ margin:0,color:t.text,fontSize:16,fontWeight:700 }}>Generated Brief</h3>
                <button onClick={copy} style={bs}>📋 Copy</button>
              </div>
              {briefSections.map(([key,label])=>brief[key]&&(
                <div key={key} style={{ marginBottom:16,padding:"14px 16px",background:t.statBg,borderRadius:10 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:t.accent,marginBottom:6,letterSpacing:"0.04em" }}>{label}</div>
                  <div style={{ fontSize:13,color:t.aiText,lineHeight:1.7 }}>{brief[key]}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
})
