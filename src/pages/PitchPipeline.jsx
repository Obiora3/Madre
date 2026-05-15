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

const CURRENCY_SYMBOLS = { USD:"$", GBP:"£", EUR:"€", AUD:"A$", NGN:"₦", CAD:"C$" };
const fmtM = (v, cs) => v >= 1_000_000 ? `${cs}${(v/1_000_000).toFixed(2)}M` : v >= 1000 ? `${cs}${(v/1000).toFixed(0)}k` : `${cs}${Math.round(v)}`;

const BLANK_FORM = { title:"", prospect_company:"", contact_name:"", contact_email:"", industry:"Technology", stage:"Lead", estimated_value:0, win_probability:50, pitch_type:"Brand Campaign", owner:"", decision_date:"", notes:"" };
const STAGES     = ["Lead","Qualified","Proposal Sent","Negotiation","Won","Lost"];
const PITCH_TYPES = ["Brand Campaign","Digital Strategy","PR & Communications","Media Buying","Creative Production","Social Media","SEO & Performance","Consulting","Other"];
const INDUSTRIES  = ["Technology","Fashion","FMCG","Finance","Healthcare","Retail","Automotive","Entertainment","Food & Beverage","Other"];
const ST_COLORS   = { Lead:"#6B7280", Qualified:"#3B82F6", "Proposal Sent":"#F59E0B", Negotiation:"#F97316", Won:"#059669", Lost:"#EF4444" };

export const PitchPipeline = React.memo(function PitchPipeline() {
  const { pitches, setPitches, currentUser, logActivity, whiteLabelSettings } = useApp();
  const CS = CURRENCY_SYMBOLS[whiteLabelSettings?.currency] || "$";
  const { theme: t } = useTheme();
  const toast = useToast();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);

  const [viewMode,      setViewMode]      = useState("Kanban");
  const [showForm,      setShowForm]      = useState(false);
  const [editPitch,     setEditPitch]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form,          setForm]          = useState(BLANK_FORM);
  const [aiPitch,       setAiPitch]       = useState(null);
  const [aiAnalysis,    setAiAnalysis]    = useState("");
  const [aiLoading,     setAiLoading]     = useState(false);

  const { totalPipeline, wonRevenue, winRate, avgDealSize, funnelData, byType } = useMemo(() => {
    const active     = pitches.filter(p => !["Won","Lost"].includes(p.stage));
    const won        = pitches.filter(p => p.stage === "Won");
    const funnelData = STAGES.slice(0, -1).map(s => ({
      stage: s, color: ST_COLORS[s],
      count: pitches.filter(p => p.stage === s).length,
      value: pitches.filter(p => p.stage === s).reduce((sum, p) => sum + (p.estimated_value || 0), 0),
    }));
    const byType = [...new Set(pitches.map(p => p.pitch_type).filter(Boolean))].map(type => ({
      type,
      count: pitches.filter(p => p.pitch_type === type).length,
      value: pitches.filter(p => p.pitch_type === type).reduce((s, p) => s + (p.estimated_value || 0), 0),
    })).sort((a, b) => b.value - a.value);
    return {
      totalPipeline: active.reduce((s, p) => s + (p.estimated_value || 0) * ((p.win_probability || 0) / 100), 0),
      wonRevenue:    won.reduce((s, p) => s + (p.estimated_value || 0), 0),
      winRate:       pitches.length ? Math.round((won.length / pitches.length) * 100) : 0,
      avgDealSize:   pitches.length ? pitches.reduce((s, p) => s + (p.estimated_value || 0), 0) / pitches.length : 0,
      funnelData, byType,
    };
  }, [pitches]);

  const openCreate = ()  => { setForm(BLANK_FORM); setEditPitch(null); setShowForm(true); };
  const openEdit   = (p) => { setForm({ ...p });   setEditPitch(p);    setShowForm(true); };

  const handleSave = () => {
    if (editPitch) {
      setPitches(pitches.map(p => p.id === editPitch.id ? { ...form, id: editPitch.id } : p));
      toast({ message: `"${form.title}" updated`, type: "success" });
    } else {
      const np = { ...form, id: "pi" + Date.now() };
      setPitches([...pitches, np]);
      logActivity({ userName: currentUser?.name, eventType: "created", entityType: "pitch", entityId: np.id, entityTitle: np.title });
      toast({ message: `Pitch "${form.title}" created`, sub: `${form.stage} · ${fmtM(Number(form.estimated_value), CS)}`, type: "success" });
    }
    setShowForm(false);
  };

  const advanceStage = (p, e) => {
    e.stopPropagation();
    const idx = STAGES.indexOf(p.stage);
    if (idx < 0 || idx >= STAGES.length - 1) return;
    const next = STAGES[idx + 1];
    setPitches(pitches.map(x => x.id === p.id ? { ...x, stage: next } : x));
    toast({ message: `"${p.title}" → ${next}`, type: next === "Won" ? "success" : "info" });
    if (next === "Won") logActivity({ userName: currentUser?.name, eventType: "pitch_won", entityType: "pitch", entityId: p.id, entityTitle: p.title });
  };

  const analyzeWithAI = async (pitch) => {
    setAiPitch(pitch); setAiAnalysis(""); setAiLoading(true);
    try {
      const result = await callClaude(
        `Analyze this pitch opportunity and provide strategic advice.\n\nPitch: ${pitch.title}\nProspect: ${pitch.prospect_company} (${pitch.industry})\nValue: ${fmtM(pitch.estimated_value || 0, CS)}\nType: ${pitch.pitch_type}\nStage: ${pitch.stage}\nWin Probability: ${pitch.win_probability}%\nDecision Date: ${fmtDate(pitch.decision_date)}\nContact: ${pitch.contact_name || "unknown"}\nNotes: ${pitch.notes || "none"}\n\nProvide: 1) Is ${pitch.win_probability}% win probability realistic? 2) Key risks that could derail this deal 3) Three specific actions to advance this pitch right now 4) Competitive positioning advice for the ${pitch.industry} sector`,
        "You are a senior business development strategist. Be direct and specific. Avoid generic advice."
      );
      setAiAnalysis(result);
    } catch (err) {
      toast({ message: err.message, type: "error" });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>Pitch Pipeline</h1>
        <div style={{ display:"flex", gap:8 }}>
          {["Kanban","List","Forecast"].map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{ ...bs, background: viewMode===m ? "#7C3AED" : t.toggleBg, color: viewMode===m ? "#fff" : t.textSub, padding:"7px 14px", fontSize:12 }}>{m}</button>
          ))}
          <button style={btnPrimary} onClick={openCreate}>+ New Pitch</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        <StatCard icon="📊" label="Active Pitches"     value={pitches.filter(p=>!["Won","Lost"].includes(p.stage)).length} sub={`${pitches.length} total in pipeline`} />
        <StatCard icon="💰" label="Weighted Pipeline"  value={fmtM(totalPipeline, CS)} sub="probability-adjusted value" />
        <StatCard icon="🏆" label="Won Revenue"        value={fmtM(wonRevenue, CS)} sub={`${pitches.filter(p=>p.stage==="Won").length} deals closed`} />
        <StatCard icon="📈" label="Win Rate"           value={`${winRate}%`} sub={`Avg deal ${fmtM(avgDealSize, CS)}`} />
      </div>

      {/* ── Kanban ────────────────────────────────────────────────────────────── */}
      {viewMode === "Kanban" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12 }}>
          {STAGES.map(stage => (
            <div key={stage}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:ST_COLORS[stage] }} />
                <span style={{ fontSize:11, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{stage}</span>
                <span style={{ fontSize:10, color:t.textGhost, marginLeft:"auto" }}>{pitches.filter(p=>p.stage===stage).length}</span>
              </div>
              {pitches.filter(p => p.stage === stage).map(p => (
                <div
                  key={p.id}
                  onClick={() => openEdit(p)}
                  style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:10, padding:12, marginBottom:8, cursor:"pointer", transition:"box-shadow 0.15s, border-color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 2px 12px ${t.border2}`; e.currentTarget.style.borderColor = t.accent + "66"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = t.border2; }}
                >
                  <div style={{ fontSize:12, fontWeight:700, color:t.text, marginBottom:4, lineHeight:1.3 }}>{p.title}</div>
                  <div style={{ fontSize:11, color:t.textFaint, marginBottom:6 }}>{p.prospect_company}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:t.accentLight, marginBottom:4 }}>{fmtM(p.estimated_value || 0, CS)}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                    <span style={{ fontSize:11, color:t.textFaint }}>{p.win_probability}% prob.</span>
                    {p.decision_date && <span style={{ fontSize:10, color:t.textGhost }}>{fmtDate(p.decision_date)}</span>}
                  </div>
                  <div style={{ height:3, borderRadius:99, background:t.toggleBg, marginBottom:8 }}>
                    <div style={{ height:"100%", borderRadius:99, width:`${p.win_probability}%`, background:ST_COLORS[stage], transition:"width 0.3s" }} />
                  </div>
                  <div style={{ display:"flex", gap:4 }}>
                    {!["Won","Lost"].includes(stage) && (
                      <button
                        onClick={e => advanceStage(p, e)}
                        style={{ fontSize:10, fontWeight:600, background:`${ST_COLORS[stage]}22`, color:ST_COLORS[stage], border:"none", borderRadius:4, padding:"3px 8px", cursor:"pointer", flex:1 }}
                      >
                        Advance →
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); analyzeWithAI(p); }}
                      style={{ fontSize:10, fontWeight:600, background:t.statBg, color:t.accent, border:"none", borderRadius:4, padding:"3px 8px", cursor:"pointer" }}
                    >
                      ✦ AI
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── List ──────────────────────────────────────────────────────────────── */}
      {viewMode === "List" && (
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 120px 90px 90px 100px 90px 72px", padding:"10px 16px", borderBottom:`1px solid ${t.border2}`, background:t.statBg }}>
            {["Pitch","Stage","Company","Value","Prob.","Decision","Owner",""].map((h,i) => (
              <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textFaint, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</div>
            ))}
          </div>
          {pitches.map(p => (
            <div
              key={p.id}
              onClick={() => openEdit(p)}
              style={{ display:"grid", gridTemplateColumns:"1fr 120px 120px 90px 90px 100px 90px 72px", padding:"12px 16px", borderBottom:`1px solid ${t.divider}`, alignItems:"center", cursor:"pointer", transition:"background 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.background = t.statBg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:t.textSub }}>{p.title}</div>
                <div style={{ fontSize:11, color:t.textFaint }}>{p.pitch_type}</div>
              </div>
              <Badge label={p.stage} color={ST_COLORS[p.stage] || "#666"} />
              <div style={{ fontSize:12, color:t.textMuted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.prospect_company}</div>
              <div style={{ fontSize:13, color:t.accentLight, fontWeight:600 }}>{fmtM(p.estimated_value || 0, CS)}</div>
              <div>
                <div style={{ fontSize:13, color:t.textMuted, fontWeight:600 }}>{p.win_probability}%</div>
                <div style={{ height:3, borderRadius:99, background:t.toggleBg, marginTop:3 }}>
                  <div style={{ height:"100%", borderRadius:99, width:`${p.win_probability}%`, background:ST_COLORS[p.stage] }} />
                </div>
              </div>
              <div style={{ fontSize:12, color:t.textFaint }}>{fmtDate(p.decision_date)}</div>
              <div style={{ fontSize:12, color:t.textFaint }}>{p.owner}</div>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={e=>{e.stopPropagation();analyzeWithAI(p);}} title="AI analysis" style={{ background:t.statBg, border:"none", color:t.accent, cursor:"pointer", fontSize:13, padding:"3px 6px", borderRadius:4 }}>✦</button>
                <button onClick={e=>{e.stopPropagation();setConfirmDelete(p);}} title="Delete" style={{ background:"none", border:"none", color:t.textGhost, cursor:"pointer", fontSize:16, padding:"3px 6px", borderRadius:4 }}>×</button>
              </div>
            </div>
          ))}
          {pitches.length === 0 && (
            <div style={{ padding:40, textAlign:"center", color:t.textGhost, fontSize:13 }}>No pitches yet — add your first to start tracking the pipeline.</div>
          )}
        </div>
      )}

      {/* ── Forecast ──────────────────────────────────────────────────────────── */}
      {viewMode === "Forecast" && (
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
          {/* Funnel */}
          <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
            <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:t.text }}>Pipeline Funnel</h3>
            {funnelData.map((s) => {
              const maxVal = Math.max(...funnelData.map(x => x.value), 1);
              const pct    = maxVal > 0 ? (s.value / maxVal) * 100 : 0;
              return (
                <div key={s.stage} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>{s.stage}</span>
                    <span style={{ fontSize:12, color:t.textFaint }}>{s.count} deal{s.count !== 1 ? "s" : ""} · {fmtM(s.value, CS)}</span>
                  </div>
                  <div style={{ height:30, background:t.toggleBg, borderRadius:7, overflow:"hidden" }}>
                    <div style={{ width:`${Math.max(pct, 2)}%`, height:"100%", background:s.color, borderRadius:7, display:"flex", alignItems:"center", paddingLeft:10, transition:"width 0.5s ease" }}>
                      {pct > 15 && <span style={{ fontSize:11, fontWeight:700, color:"#fff" }}>{fmtM(s.value, CS)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop:20, paddingTop:16, borderTop:`1px solid ${t.border2}`, display:"flex", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:11, color:t.textFaint, fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>Total Gross Pipeline</div>
                <div style={{ fontSize:22, fontWeight:800, color:t.text }}>{fmtM(pitches.filter(p=>!["Won","Lost"].includes(p.stage)).reduce((s,p)=>s+(p.estimated_value||0),0), CS)}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:11, color:t.textFaint, fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>Probability-Weighted</div>
                <div style={{ fontSize:22, fontWeight:800, color:t.accentLight }}>{fmtM(totalPipeline, CS)}</div>
              </div>
            </div>
          </div>

          {/* Side panels */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
              <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700, color:t.text }}>By Pitch Type</h3>
              {byType.length === 0 && <div style={{ fontSize:12, color:t.textGhost }}>No pitches yet</div>}
              {byType.map(b => (
                <div key={b.type} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${t.divider}` }}>
                  <span style={{ fontSize:12, color:t.textSub, maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.type}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:t.accentLight }}>{fmtM(b.value, CS)} <span style={{ fontWeight:400, color:t.textGhost }}>({b.count})</span></span>
                </div>
              ))}
            </div>
            <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20 }}>
              <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700, color:t.text }}>Top Opportunities</h3>
              {[...pitches]
                .filter(p => !["Won","Lost"].includes(p.stage))
                .sort((a, b) => (b.estimated_value||0) - (a.estimated_value||0))
                .slice(0, 5)
                .map(p => (
                  <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${t.divider}` }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:t.textSub, maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                      <div style={{ fontSize:10, color:t.textFaint }}>{p.win_probability}% win · {p.prospect_company}</div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color:t.accentLight }}>{fmtM(p.estimated_value||0, CS)}</span>
                  </div>
                ))
              }
              {pitches.filter(p => !["Won","Lost"].includes(p.stage)).length === 0 && (
                <div style={{ fontSize:12, color:t.textGhost }}>No active pitches</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── AI Analysis panel ─────────────────────────────────────────────────── */}
      {aiPitch && (
        <div style={{ background:t.card, border:`1px solid ${t.accent}44`, borderRadius:14, padding:24, marginTop:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div>
              <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:t.text }}>✦ AI Deal Analysis — {aiPitch.title}</h3>
              <div style={{ fontSize:12, color:t.textFaint, marginTop:2 }}>{aiPitch.prospect_company} · {fmtM(aiPitch.estimated_value||0, CS)} · {aiPitch.win_probability}% win prob.</div>
            </div>
            <button onClick={() => { setAiPitch(null); setAiAnalysis(""); }} style={{ background:"none", border:`1px solid ${t.border2}`, color:t.textMuted, borderRadius:7, padding:"5px 12px", fontSize:12, cursor:"pointer" }}>Close</button>
          </div>
          {aiLoading
            ? <AIBlock loading={true} />
            : aiAnalysis
              ? <AIBlock text={aiAnalysis} />
              : <button style={btnPrimary} onClick={() => analyzeWithAI(aiPitch)}>✦ Analyse this pitch</button>
          }
        </div>
      )}

      {/* ── Form modal ────────────────────────────────────────────────────────── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editPitch ? "Edit Pitch" : "New Pitch"}>
        <FormField label="Title">
          <input style={iS} value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="e.g. Q3 Brand Refresh Campaign" />
        </FormField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FormField label="Prospect Company">
            <input style={iS} value={form.prospect_company} onChange={e => setForm({...form, prospect_company:e.target.value})} />
          </FormField>
          <FormField label="Industry">
            <select style={sS} value={form.industry} onChange={e => setForm({...form, industry:e.target.value})}>
              {INDUSTRIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </FormField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FormField label="Contact Name">
            <input style={iS} value={form.contact_name} onChange={e => setForm({...form, contact_name:e.target.value})} />
          </FormField>
          <FormField label="Contact Email">
            <input type="email" style={iS} value={form.contact_email} onChange={e => setForm({...form, contact_email:e.target.value})} />
          </FormField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FormField label="Stage">
            <select style={sS} value={form.stage} onChange={e => setForm({...form, stage:e.target.value})}>
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Pitch Type">
            <select style={sS} value={form.pitch_type} onChange={e => setForm({...form, pitch_type:e.target.value})}>
              {PITCH_TYPES.map(s => <option key={s}>{s}</option>)}
            </select>
          </FormField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FormField label={`Est. Value (${CS})`}>
            <input type="number" style={iS} value={form.estimated_value} onChange={e => setForm({...form, estimated_value:Number(e.target.value)})} placeholder="e.g. 150000" />
            {form.estimated_value > 0 && <div style={{ fontSize:11, color:"#7C3AED", marginTop:3 }}>= {fmtM(Number(form.estimated_value), CS)}</div>}
          </FormField>
          <FormField label="Win Probability %">
            <input type="number" style={iS} value={form.win_probability} onChange={e => setForm({...form, win_probability:Math.min(100,Math.max(0,Number(e.target.value)))})} min={0} max={100} />
            <div style={{ height:4, borderRadius:99, background:t.toggleBg, marginTop:6 }}>
              <div style={{ height:"100%", borderRadius:99, width:`${form.win_probability}%`, background:"#7C3AED", transition:"width 0.2s" }} />
            </div>
          </FormField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FormField label="Decision Date">
            <input type="date" style={iS} value={form.decision_date} onChange={e => setForm({...form, decision_date:e.target.value})} />
          </FormField>
          <FormField label="BD Owner">
            <input style={iS} value={form.owner} onChange={e => setForm({...form, owner:e.target.value})} placeholder="Account lead name" />
          </FormField>
        </div>
        <FormField label="Notes">
          <textarea style={{...iS, height:70, resize:"vertical"}} value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} placeholder="Key stakeholders, requirements, competing agencies…" />
        </FormField>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={bs} onClick={() => setShowForm(false)}>Cancel</button>
          <button style={btnPrimary} onClick={handleSave} disabled={!form.title}>{editPitch ? "Save Changes" : "Create Pitch"}</button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          setPitches(pitches.filter(p => p.id !== confirmDelete.id));
          toast({ message: `"${confirmDelete.title}" removed`, type: "warning" });
        }}
        title={`Delete "${confirmDelete?.title}"?`}
        message="This will permanently remove this pitch from the pipeline."
        confirmLabel="Delete Pitch"
      />
    </div>
  );
})
