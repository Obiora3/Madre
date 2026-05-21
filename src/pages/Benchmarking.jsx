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
  getTaskPipelines,
  isTaskComplete,
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

const DEFAULT_BENCHMARKS = [
  { id:"b1", metric:"Email Open Rate",   unit:"%",  low:15,  avg:25,  top:35,  agencyVal:28, editable:true  },
  { id:"b2", metric:"Social Engagement", unit:"%",  low:0.5, avg:1.5, top:3,   agencyVal:2.2, editable:true },
  { id:"b3", metric:"Conversion Rate",   unit:"%",  low:1,   avg:3,   top:6,   agencyVal:4.1, editable:true  },
  { id:"b4", metric:"Brand Recall",      unit:"%",  low:20,  avg:40,  top:65,  agencyVal:47, editable:true  },
  { id:"b5", metric:"NPS",               unit:"",   low:20,  avg:40,  top:70,  agencyVal:55, editable:true  },
  { id:"b6", metric:"Lead Generation",   unit:"",   low:50,  avg:150, top:400, agencyVal:210, editable:true },
];

const INDUSTRIES = ["Technology","Fashion","FMCG","Finance","Healthcare","Retail","Automotive","Entertainment","Food & Beverage"];

export const Benchmarking = React.memo(function Benchmarking() {
  const { kpis, projects, tasks, whiteLabelSettings, isMobile } = useApp();
  const { theme: t } = useTheme();
  const toast = useToast();
  const sS = mkSelectStyle(t); const iS = mkInputStyle(t); const bs = mkBtnSecondary(t);
  const taskPipelines = useMemo(() => getTaskPipelines(whiteLabelSettings), [whiteLabelSettings]);
  const projectById = useMemo(() => Object.fromEntries((projects || []).map(p => [p.id, p])), [projects]);

  const [industry,      setIndustry]      = useState("Technology");
  const [aiInsight,     setAiInsight]     = useState(null);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiError,       setAiError]       = useState(null);
  const [benchmarks,    setBenchmarks]    = useState(DEFAULT_BENCHMARKS);
  const [editingId,     setEditingId]     = useState(null);
  const [editVal,       setEditVal]       = useState("");
  const [showAddForm,   setShowAddForm]   = useState(false);
  const [newMetric,     setNewMetric]     = useState({ metric:"", unit:"", low:"", avg:"", top:"", agencyVal:"" });

  const agencyStats = useMemo(() => {
    const completedProjects = projects.filter(p => p.stage === "Delivered").length;
    const totalProjects     = projects.length;
    const completedTasks    = tasks.filter(t2 => isTaskComplete(t2, projectById[t2.project_id], taskPipelines)).length;
    const totalTasks        = tasks.length;
    const kpiAchieved       = kpis.filter(k => k.status === "Achieved").length;
    const kpiTotal          = kpis.length;
    return {
      projectCompletionRate: totalProjects ? Math.round((completedProjects / totalProjects) * 100) : 0,
      taskCompletionRate:    totalTasks    ? Math.round((completedTasks    / totalTasks)    * 100) : 0,
      kpiAchievementRate:    kpiTotal      ? Math.round((kpiAchieved      / kpiTotal)       * 100) : 0,
      completedProjects, totalProjects, completedTasks, totalTasks, kpiAchieved, kpiTotal,
    };
  }, [projects, tasks, kpis, projectById, taskPipelines]);

  const scoredBenchmarks = useMemo(() => benchmarks.map(b => {
    const isTop = b.agencyVal >= b.top;
    const isAvg = b.agencyVal >= b.avg;
    const color = isTop ? "#059669" : isAvg ? "#F59E0B" : "#EF4444";
    const tier  = isTop ? "Top Performer" : isAvg ? "Average" : "Below Avg";
    const range = b.top - b.low;
    const pct   = range > 0 ? Math.min(100, Math.max(0, ((b.agencyVal - b.low) / range) * 100)) : 50;
    return { ...b, isTop, isAvg, color, tier, pct };
  }), [benchmarks]);

  const topCount   = scoredBenchmarks.filter(b => b.isTop).length;
  const avgCount   = scoredBenchmarks.filter(b => b.isAvg && !b.isTop).length;
  const belowCount = scoredBenchmarks.filter(b => !b.isAvg).length;

  const startEdit = (b) => { setEditingId(b.id); setEditVal(String(b.agencyVal)); };
  const saveEdit  = (id) => {
    const v = parseFloat(editVal);
    if (!isNaN(v)) {
      setBenchmarks(prev => prev.map(b => b.id === id ? { ...b, agencyVal: v } : b));
      toast({ message: "Metric updated", type: "success" });
    }
    setEditingId(null);
  };

  const addCustomMetric = () => {
    if (!newMetric.metric || !newMetric.avg) return;
    setBenchmarks(prev => [...prev, {
      id: `b${Date.now()}`,
      metric:    newMetric.metric,
      unit:      newMetric.unit,
      low:       parseFloat(newMetric.low)  || 0,
      avg:       parseFloat(newMetric.avg)  || 0,
      top:       parseFloat(newMetric.top)  || 0,
      agencyVal: parseFloat(newMetric.agencyVal) || 0,
      editable:  true,
      custom:    true,
    }]);
    setNewMetric({ metric:"", unit:"", low:"", avg:"", top:"", agencyVal:"" });
    setShowAddForm(false);
    toast({ message: `Metric "${newMetric.metric}" added`, type: "success" });
  };

  const removeCustom = (id) => setBenchmarks(prev => prev.filter(b => b.id !== id));

  const getInsight = async () => {
    setAiLoading(true); setAiInsight(null); setAiError(null);
    try {
      const metricsText = scoredBenchmarks.map(b =>
        `${b.metric}: ${b.agencyVal}${b.unit} (Low ${b.low}${b.unit}, Avg ${b.avg}${b.unit}, Top ${b.top}${b.unit}) → ${b.tier}`
      ).join("\n");
      const result = await callClaude(
        `Analyze this agency's performance vs ${industry} industry benchmarks.\n\nMetrics:\n${metricsText}\n\nAdditional context:\n- Project completion rate: ${agencyStats.projectCompletionRate}% (${agencyStats.completedProjects}/${agencyStats.totalProjects} projects delivered)\n- Task completion rate: ${agencyStats.taskCompletionRate}% (${agencyStats.completedTasks}/${agencyStats.totalTasks} tasks)\n- KPI achievement rate: ${agencyStats.kpiAchievementRate}% (${agencyStats.kpiAchieved}/${agencyStats.kpiTotal} KPIs achieved)\n- Industry: ${industry}\n\nProvide:\n1. Overall performance rating vs ${industry} sector\n2. Top 3 strengths vs peers (specific metrics)\n3. Top 3 areas for improvement (specific metrics)\n4. 3 actionable recommendations to close the performance gap`,
        "You are a marketing analytics expert. Be specific and actionable."
      );
      setAiInsight(result);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:isMobile?"flex-start":"center", marginBottom:24, flexDirection:isMobile?"column":"row", gap:isMobile?10:0 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>Performance Benchmarking</h1>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <select style={{...sS, width:isMobile?"100%":160}} value={industry} onChange={e => setIndustry(e.target.value)}>
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
          </select>
          <button style={bs} onClick={() => setShowAddForm(true)}>+ Custom Metric</button>
          <button style={btnPrimary} onClick={getInsight} disabled={aiLoading}>{aiLoading ? "Analysing…" : "Get AI Insights ✨"}</button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
        <StatCard icon="🏅" label="Top Performers"     value={topCount}   sub={`${Math.round((topCount/scoredBenchmarks.length)*100)}% of metrics`} />
        <StatCard icon="📊" label="At Average"          value={avgCount}   sub="meeting expectations" />
        <StatCard icon="⚠️" label="Below Average"       value={belowCount} sub="need improvement" />
      </div>

      {/* Benchmarks table */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden", marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"180px 80px 80px 80px 1fr 130px 40px", padding:"10px 20px", borderBottom:`1px solid ${t.border2}`, background:t.statBg }}>
          {["Metric","Low","Average","Top","Position on Spectrum","Your Performance",""].map((h,i) => (
            <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textFaint, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</div>
          ))}
        </div>
        {scoredBenchmarks.map(b => (
          <div key={b.id} style={{ display:"grid", gridTemplateColumns:"180px 80px 80px 80px 1fr 130px 40px", padding:"14px 20px", borderBottom:`1px solid ${t.divider}`, alignItems:"center" }}>
            <div style={{ fontSize:13, fontWeight:600, color:t.textSub }}>{b.metric}</div>
            <div style={{ fontSize:12, color:"#EF4444" }}>{b.low}{b.unit}</div>
            <div style={{ fontSize:12, color:"#F59E0B" }}>{b.avg}{b.unit}</div>
            <div style={{ fontSize:12, color:"#059669" }}>{b.top}{b.unit}</div>

            {/* Visual spectrum bar */}
            <div style={{ paddingRight:20 }}>
              <div style={{ position:"relative", height:8, background:t.toggleBg, borderRadius:99 }}>
                {/* gradient fill */}
                <div style={{ position:"absolute", inset:0, borderRadius:99, background:"linear-gradient(to right, #EF4444, #F59E0B, #059669)", opacity:0.25 }} />
                {/* agency marker */}
                <div style={{ position:"absolute", top:-3, width:14, height:14, borderRadius:"50%", background:b.color, border:`2px solid ${t.card}`, boxShadow:`0 0 0 1px ${b.color}`, left:`calc(${b.pct}% - 7px)`, transition:"left 0.3s" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, fontSize:9, color:t.textGhost }}>
                <span>Low</span><span>Avg</span><span>Top</span>
              </div>
            </div>

            {/* Editable value */}
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {editingId === b.id ? (
                <>
                  <input
                    type="number" autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={() => saveEdit(b.id)}
                    onKeyDown={e => e.key === "Enter" && saveEdit(b.id)}
                    style={{ width:70, ...iS, fontSize:13, padding:"4px 8px" }}
                  />
                  <span style={{ fontSize:11, color:t.textGhost }}>{b.unit}</span>
                </>
              ) : (
                <button
                  onClick={() => startEdit(b)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:0, textAlign:"left" }}
                  title="Click to edit"
                >
                  <span style={{ fontSize:15, fontWeight:800, color:b.color }}>{b.agencyVal}{b.unit}</span>
                  <span style={{ fontSize:10, color:t.textGhost, marginLeft:4 }}>✎</span>
                </button>
              )}
              <Badge label={b.tier} color={b.color} />
            </div>

            {/* Remove custom */}
            <div>
              {b.custom && (
                <button onClick={() => removeCustom(b.id)} title="Remove metric" style={{ background:"none", border:"none", color:t.textGhost, cursor:"pointer", fontSize:16, padding:"2px 4px" }}>×</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Internal metrics from real data */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:20, marginBottom:20 }}>
        <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:t.text }}>Internal Delivery Metrics</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
          {[
            { label:"Project Delivery Rate", value:agencyStats.projectCompletionRate, sub:`${agencyStats.completedProjects} of ${agencyStats.totalProjects} projects delivered`, target:80 },
            { label:"Task Completion Rate",  value:agencyStats.taskCompletionRate,    sub:`${agencyStats.completedTasks} of ${agencyStats.totalTasks} tasks done`,           target:75 },
            { label:"KPI Achievement Rate",  value:agencyStats.kpiAchievementRate,    sub:`${agencyStats.kpiAchieved} of ${agencyStats.kpiTotal} KPIs achieved`,             target:70 },
          ].map(m => {
            const mc = m.value >= m.target ? "#059669" : m.value >= m.target * 0.7 ? "#F59E0B" : "#EF4444";
            return (
              <div key={m.label} style={{ background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:10, padding:16 }}>
                <div style={{ fontSize:11, color:t.textFaint, fontWeight:700, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>{m.label}</div>
                <div style={{ fontSize:26, fontWeight:800, color:mc, marginBottom:6 }}>{m.value}%</div>
                <ProgressBar value={m.value} max={100} color={mc} height={5} />
                <div style={{ fontSize:11, color:t.textGhost, marginTop:6 }}>{m.sub}</div>
                <div style={{ fontSize:10, color:t.textFaint, marginTop:2 }}>Target: {m.target}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI insights */}
      {(aiLoading || aiError || aiInsight) && (
        <div style={{ background:t.card, border:`1px solid ${t.accent}44`, borderRadius:14, padding:24 }}>
          {!aiLoading && !aiError && (
            <h3 style={{ margin:"0 0 14px", color:t.text, fontSize:15, fontWeight:700 }}>🤖 AI Insights — {industry}</h3>
          )}
          <AIBlock loading={aiLoading} error={aiError} result={aiInsight} onRetry={getInsight} />
        </div>
      )}

      {/* Add custom metric modal */}
      <Modal open={showAddForm} onClose={() => setShowAddForm(false)} title="Add Custom Benchmark">
        <FormField label="Metric Name">
          <input style={iS} value={newMetric.metric} onChange={e => setNewMetric({...newMetric, metric:e.target.value})} placeholder="e.g. Click-through Rate" />
        </FormField>
        <FormField label="Unit (optional)">
          <input style={iS} value={newMetric.unit} onChange={e => setNewMetric({...newMetric, unit:e.target.value})} placeholder="e.g. % or leave blank" />
        </FormField>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          <FormField label="Low"><input type="number" style={iS} value={newMetric.low} onChange={e => setNewMetric({...newMetric, low:e.target.value})} /></FormField>
          <FormField label="Average"><input type="number" style={iS} value={newMetric.avg} onChange={e => setNewMetric({...newMetric, avg:e.target.value})} /></FormField>
          <FormField label="Top Performer"><input type="number" style={iS} value={newMetric.top} onChange={e => setNewMetric({...newMetric, top:e.target.value})} /></FormField>
        </div>
        <FormField label="Your Current Value">
          <input type="number" style={iS} value={newMetric.agencyVal} onChange={e => setNewMetric({...newMetric, agencyVal:e.target.value})} />
        </FormField>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={bs} onClick={() => setShowAddForm(false)}>Cancel</button>
          <button style={btnPrimary} onClick={addCustomMetric} disabled={!newMetric.metric || !newMetric.avg}>Add Metric</button>
        </div>
      </Modal>
    </div>
  );
})
