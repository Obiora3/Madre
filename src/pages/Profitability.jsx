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

export const Profitability = React.memo(function Profitability() {
  const { projects, tasks } = useApp();
  const { theme: t } = useTheme();
  const toast = useToast();
  const billableRate = 150;
  const costRate = 80;
  const fileRef = useRef(null);

  const [plan, setPlan] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [planAnalysis, setPlanAnalysis] = useState("");
  const [analyzingPlan, setAnalyzingPlan] = useState(false);

  const { projectData, totalRev, totalCost, avgMargin, best } = useMemo(() => {
    const projectData = projects.map(p => {
      const projTasks  = tasks.filter(t2 => t2.project_id === p.id);
      const totalHours = projTasks.reduce((s, t2) => s + (t2.actual_hours || t2.estimated_hours || 0), 0);
      const revenue    = totalHours * billableRate;
      const cost       = totalHours * costRate;
      const margin     = revenue ? Math.round(((revenue - cost) / revenue) * 100) : 0;
      return { ...p, totalHours, revenue, cost, margin };
    });
    const totalRev  = projectData.reduce((s, p) => s + p.revenue, 0);
    const totalCost = projectData.reduce((s, p) => s + p.cost, 0);
    const avgMargin = projectData.length ? Math.round(projectData.reduce((s, p) => s + p.margin, 0) / projectData.length) : 0;
    const best      = projectData.reduce((a, b) => a.margin > b.margin ? a : b, projectData[0] || { title:"—", margin:0 });
    return { projectData, totalRev, totalCost, avgMargin, best };
  }, [projects, tasks]);

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const nameIdx   = headers.findIndex(h => /name|project|item|description|line|service|deliverable/.test(h));
    const budgetIdx = headers.findIndex(h => /budget|amount|cost|fee|revenue|value|price|total/.test(h));
    if (nameIdx === -1 || budgetIdx === -1) return null;
    const items = lines.slice(1).map((line, i) => {
      const cols   = line.split(',').map(c => c.trim().replace(/"/g, ''));
      const raw    = (cols[budgetIdx] || '0').replace(/[$,\s]/g, '');
      const budget = parseFloat(raw);
      return { id: `pi-${i}`, name: cols[nameIdx] || `Item ${i + 1}`, budget: isNaN(budget) ? 0 : budget, projectId: null };
    }).filter(i => i.name && i.budget > 0);
    return items.length ? items : null;
  };

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setPlan(null);
    setPlanAnalysis("");
    try {
      const text = await file.text();
      const ext  = file.name.split('.').pop().toLowerCase();
      let items  = null;
      if (ext === 'csv' || file.type === 'text/csv') items = parseCSV(text);

      if (items) {
        setPlan({ fileName: file.name, items, totalBudget: items.reduce((s, i) => s + i.budget, 0) });
        toast({ message: `Parsed ${items.length} line items from ${file.name}` });
      } else {
        // Use Claude to extract structured budget data
        const prompt = `Extract all financial/budget line items from this document. Return ONLY a JSON array, no other text. Each object must have "name" (string) and "budget" (number in USD — convert shorthand like $50k → 50000).\n\nDocument:\n${text.slice(0, 10000)}`;
        const response = await callClaude(prompt, "You are a financial data extractor. Return only valid JSON arrays, nothing else.");
        const match = response.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const extracted = parsed
            .filter(i => i.name && typeof i.budget === 'number' && i.budget > 0)
            .map((i, idx) => ({ id: `pi-${idx}`, name: i.name, budget: i.budget, projectId: null }));
          if (extracted.length) {
            setPlan({ fileName: file.name, items: extracted, totalBudget: extracted.reduce((s, i) => s + i.budget, 0) });
            toast({ message: `Extracted ${extracted.length} items via AI from ${file.name}` });
          } else {
            toast({ message: "No budget items found. Try a CSV with Name and Budget columns.", type: "error" });
          }
        } else {
          toast({ message: "Could not parse the file. Try a CSV with Name and Budget columns.", type: "error" });
        }
      }
    } catch (err) {
      toast({ message: `Parse error: ${err.message}`, type: "error" });
    } finally {
      setParsing(false);
    }
  };

  const linkItem = (itemId, projectId) => {
    setPlan(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === itemId ? { ...i, projectId: projectId || null } : i),
    }));
    setPlanAnalysis("");
  };

  const planComparison = useMemo(() => {
    if (!plan) return null;
    const linked = plan.items.map(item => {
      const proj     = item.projectId ? projectData.find(p => p.id === item.projectId) : null;
      const estCost  = proj ? proj.cost : null;
      const variance = estCost !== null ? item.budget - estCost : null;
      const risk     = variance !== null
        ? (variance < 0 ? "over" : variance < item.budget * 0.1 ? "tight" : "healthy")
        : null;
      return { ...item, proj, estCost, variance, risk };
    });
    const linkedOnly       = linked.filter(i => i.proj);
    const totalPlanBudget  = linkedOnly.reduce((s, i) => s + i.budget, 0);
    const totalEstCost     = linkedOnly.reduce((s, i) => s + i.estCost, 0);
    const totalVariance    = totalPlanBudget - totalEstCost;
    const atRisk           = linked.filter(i => i.risk === "over").length;
    return { linked, totalPlanBudget, totalEstCost, totalVariance, atRisk, linkedCount: linkedOnly.length };
  }, [plan, projectData]);

  const analyzeVsBudget = async () => {
    if (!plan || !planComparison) return;
    setAnalyzingPlan(true);
    setPlanAnalysis("");
    try {
      const lines = planComparison.linked.map(i =>
        i.proj
          ? `- ${i.name}: Planned $${i.budget.toLocaleString()} | Est. Cost $${i.estCost.toLocaleString()} | Variance ${i.variance >= 0 ? '+' : ''}$${i.variance.toLocaleString()} [${i.risk}]`
          : `- ${i.name}: Planned $${i.budget.toLocaleString()} | Unlinked`
      ).join('\n');
      const prompt = `Agency financial plan vs project cost analysis:\n\n${lines}\n\nTotal plan budget: $${planComparison.totalPlanBudget.toLocaleString()}\nTotal estimated cost: $${planComparison.totalEstCost.toLocaleString()}\nOverall variance: ${planComparison.totalVariance >= 0 ? '+' : ''}$${planComparison.totalVariance.toLocaleString()}\n\nProvide a concise profitability report: 1) Overall health of the plan 2) Line items at risk of cost overrun 3) Specific actions to protect margins.`;
      const result = await callClaude(prompt, "You are a senior agency financial advisor. Be direct, specific, and actionable.");
      setPlanAnalysis(result);
    } catch (err) {
      toast({ message: err.message, type: "error" });
    } finally {
      setAnalyzingPlan(false);
    }
  };

  const riskColor = r => r === "over" ? "#EF4444" : r === "tight" ? "#F59E0B" : "#059669";
  const riskLabel = r => r === "over" ? "Over Budget" : r === "tight" ? "Tight" : "Healthy";

  return (
    <div>
      {/* Hidden file input — always mounted so the top-bar button can trigger it */}
      <input
        ref={fileRef} type="file" accept=".csv,.txt,.pdf,.xlsx"
        style={{ display:"none" }}
        onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>Profitability</h1>

        {/* Top-right button group */}
        <div style={{ display:"flex", border:`1px solid ${t.border2}`, borderRadius:99, overflow:"hidden", background:t.card, boxShadow:`0 1px 4px ${t.border2}` }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ display:"flex", alignItems:"center", gap:7, background:"transparent", border:"none", cursor:"pointer", padding:"9px 20px", fontSize:13, fontWeight:600, color:t.textSub }}
          >
            <span style={{ fontSize:15 }}>📊</span> Upload Plans
          </button>
          <div style={{ width:1, background:t.border2 }} />
          <button
            onClick={analyzeVsBudget}
            disabled={!plan || analyzingPlan}
            style={{ display:"flex", alignItems:"center", gap:7, background:"#3B82F6", border:"none", cursor:plan&&!analyzingPlan?"pointer":"not-allowed", padding:"9px 20px", fontSize:13, fontWeight:700, color:"#fff", opacity:!plan?0.55:1, transition:"opacity 0.15s" }}
          >
            <span style={{ fontSize:14 }}>⚡</span> {analyzingPlan ? "Analysing…" : "Live Analysis"}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24 }}>
        <StatCard icon="💵" label="Est. Revenue" value={`$${Math.round(totalRev/1000)}k`} />
        <StatCard icon="📉" label="Est. Cost"    value={`$${Math.round(totalCost/1000)}k`} />
        <StatCard icon="📈" label="Avg Margin"   value={`${avgMargin}%`} />
        <StatCard icon="🏅" label="Best Project" value={best?.title?.split(" ")[0]||"—"} sub={`${best?.margin||0}% margin`} />
      </div>

      {/* ── Financial / Media Plan Upload ───────────────────────────────────── */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, marginBottom:20, overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${t.border2}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:t.text }}>Financial / Media Plan Upload</h3>
            <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>Upload a plan to compare budgets against estimated project costs</div>
          </div>
          {plan && (
            <button
              onClick={() => { setPlan(null); setPlanAnalysis(""); }}
              style={{ background:"transparent", border:`1px solid ${t.border2}`, color:t.textMuted, borderRadius:7, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}
            >
              Remove
            </button>
          )}
        </div>

        <div style={{ padding:20 }}>
          {/* Drop zone — shown when no plan loaded */}
          {!plan && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              style={{
                border:`2px dashed ${dragOver ? t.accent : t.border2}`,
                borderRadius:10, padding:"36px 24px", textAlign:"center", cursor:"pointer",
                background:dragOver ? `${t.accent}11` : t.statBg, transition:"all 0.15s",
              }}
            >
              <div style={{ fontSize:30, marginBottom:10 }}>📂</div>
              {parsing ? (
                <div style={{ color:t.textMuted, fontSize:13, fontWeight:600 }}>Parsing file…</div>
              ) : (
                <>
                  <div style={{ fontSize:13, fontWeight:700, color:t.textSub, marginBottom:4 }}>Drop a file here, or click to browse</div>
                  <div style={{ fontSize:11, color:t.textFaint, lineHeight:1.5 }}>
                    Supports CSV (best), TXT, PDF · Non-CSV files are extracted via AI<br />
                    CSV tip: include a <em>Name</em> column and a <em>Budget</em> column
                  </div>
                </>
              )}
            </div>
          )}

          {/* Plan loaded — comparison table */}
          {plan && planComparison && (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <span style={{ fontSize:12, color:t.textFaint }}>📄</span>
                <span style={{ fontSize:13, fontWeight:700, color:t.textSub }}>{plan.fileName}</span>
                <span style={{ fontSize:11, color:t.textFaint }}>· {plan.items.length} line items · Total ${plan.totalBudget.toLocaleString()}</span>
              </div>

              {/* Summary mini-stats (visible once ≥1 item linked) */}
              {planComparison.linkedCount > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
                  {[
                    ["Plan Budget",  `$${Math.round(planComparison.totalPlanBudget/1000)}k`, t.accentLight],
                    ["Est. Cost",    `$${Math.round(planComparison.totalEstCost/1000)}k`,    t.textSub],
                    ["Variance",     `${planComparison.totalVariance>=0?"+":""}$${Math.round(planComparison.totalVariance/1000)}k`, planComparison.totalVariance>=0?"#059669":"#EF4444"],
                    ["At Risk",      `${planComparison.atRisk} item${planComparison.atRisk!==1?"s":""}`, planComparison.atRisk>0?"#EF4444":t.textMuted],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:10, padding:"10px 14px" }}>
                      <div style={{ fontSize:10, color:t.textFaint, fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
                      <div style={{ fontSize:18, fontWeight:800, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Line items */}
              <div style={{ border:`1px solid ${t.border2}`, borderRadius:10, overflow:"hidden", marginBottom:16 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 180px 90px 90px 96px", padding:"8px 14px", background:t.statBg, borderBottom:`1px solid ${t.border2}` }}>
                  {["Line Item","Budget","Link to Project","Est. Cost","Variance","Status"].map((h,i) => (
                    <div key={i} style={{ fontSize:10, fontWeight:700, color:t.textFaint, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</div>
                  ))}
                </div>
                {planComparison.linked.map(item => (
                  <div
                    key={item.id}
                    style={{ display:"grid", gridTemplateColumns:"1fr 90px 180px 90px 90px 96px", padding:"11px 14px", borderBottom:`1px solid ${t.divider}`, alignItems:"center" }}
                  >
                    <div style={{ fontSize:13, fontWeight:600, color:t.textSub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                    <div style={{ fontSize:13, color:t.accentLight, fontWeight:700 }}>${item.budget.toLocaleString()}</div>
                    <select
                      value={item.projectId || ""}
                      onChange={e => linkItem(item.id, e.target.value)}
                      style={{ fontSize:11, background:t.input, border:`1px solid ${t.inputBorder}`, borderRadius:6, color:t.textSub, padding:"4px 6px", width:"100%" }}
                    >
                      <option value="">— unlinked —</option>
                      {projectData.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                    <div style={{ fontSize:13, color:t.textMuted }}>{item.estCost !== null ? `$${item.estCost.toLocaleString()}` : "—"}</div>
                    <div style={{ fontSize:13, fontWeight:700, color: item.variance !== null ? (item.variance >= 0 ? "#059669" : "#EF4444") : t.textFaint }}>
                      {item.variance !== null ? `${item.variance >= 0 ? "+" : ""}$${item.variance.toLocaleString()}` : "—"}
                    </div>
                    <div>
                      {item.risk && (
                        <span style={{ fontSize:10, fontWeight:700, color:riskColor(item.risk), background:`${riskColor(item.risk)}1a`, borderRadius:99, padding:"2px 9px", whiteSpace:"nowrap" }}>
                          {riskLabel(item.risk)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* AI analysis */}
              {!planAnalysis ? (
                <button
                  onClick={analyzeVsBudget}
                  disabled={analyzingPlan || planComparison.linkedCount === 0}
                  style={{ ...btnPrimary, opacity:(analyzingPlan || planComparison.linkedCount === 0) ? 0.6 : 1 }}
                >
                  {analyzingPlan ? "Analysing…" : planComparison.linkedCount === 0 ? "Link items to projects to enable analysis" : "✦ AI Profitability Analysis"}
                </button>
              ) : (
                <div style={{ marginTop:4 }}>
                  <AIBlock text={planAnalysis} />
                  <button
                    onClick={() => setPlanAnalysis("")}
                    style={{ fontSize:11, color:t.textFaint, background:"none", border:"none", cursor:"pointer", marginTop:6, padding:0 }}
                  >
                    Clear analysis
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Project-Level Breakdown ──────────────────────────────────────────── */}
      <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,overflow:"hidden",marginBottom:20 }}>
        <div style={{ padding:"14px 20px",borderBottom:`1px solid ${t.border2}` }}>
          <h3 style={{ margin:0,fontSize:14,fontWeight:700,color:t.text }}>Project-Level Breakdown</h3>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 100px",padding:"10px 20px",borderBottom:`1px solid ${t.border2}` }}>
          {["Project","Stage","Hours","Revenue","Margin"].map((h,i) => (
            <div key={i} style={{ fontSize:11,fontWeight:700,color:t.textFaint,textTransform:"uppercase",letterSpacing:"0.05em" }}>{h}</div>
          ))}
        </div>
        {projectData.map(p => {
          const mc = p.margin>=40?"#059669":p.margin>=25?"#F59E0B":"#EF4444";
          return (
            <div key={p.id} style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 100px",padding:"12px 20px",borderBottom:`1px solid ${t.divider}`,alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13,fontWeight:600,color:t.textSub }}>{p.title}</div>
                <div style={{ fontSize:11,color:t.textFaint }}>{p.assigned_to?.name}</div>
              </div>
              <Badge label={p.stage} color={stageColor(p.stage)} />
              <div style={{ fontSize:13,color:t.textMuted }}>{p.totalHours}h</div>
              <div style={{ fontSize:13,color:t.accentLight,fontWeight:600 }}>${p.revenue.toLocaleString()}</div>
              <div>
                <span style={{ fontSize:14,fontWeight:800,color:mc }}>{p.margin}%</span>
                <div style={{ marginTop:3 }}><ProgressBar value={p.margin} max={100} color={mc} height={4} /></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Industry Benchmarks ──────────────────────────────────────────────── */}
      <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,padding:20 }}>
        <h3 style={{ margin:"0 0 14px",fontSize:14,fontWeight:700,color:t.text }}>Industry Margin Benchmarks</h3>
        {[
          ["Digital","45–55%","#7C3AED"],
          ["PR","35–45%","#0891B2"],
          ["Creative","40–50%","#F97316"],
          ["Media Buying","15–25%","#F59E0B"],
          ["Consulting","50–65%","#059669"],
        ].map(([cat,range,color]) => (
          <div key={cat} style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}>
            <div style={{ width:100,fontSize:12,color:t.textMuted,fontWeight:600 }}>{cat}</div>
            <div style={{ flex:1,background:t.toggleBg,borderRadius:99,height:8,overflow:"hidden" }}>
              <div style={{ width:"45%",height:"100%",background:color,borderRadius:99,opacity:0.6 }} />
            </div>
            <span style={{ fontSize:12,color:color,fontWeight:700 }}>{range}</span>
          </div>
        ))}
      </div>
    </div>
  );
})
