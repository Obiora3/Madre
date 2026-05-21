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

export const Profitability = React.memo(function Profitability() {
  const { projects, tasks, whiteLabelSettings, isMobile } = useApp();
  const { theme: t } = useTheme();
  const toast = useToast();
  const CS = CURRENCY_SYMBOLS[whiteLabelSettings?.currency] || "$";
  const RATE = whiteLabelSettings?.billing_rate || 150;
  const costRate = Math.round(RATE * 0.55);
  const fileRef = useRef(null);

  const [plan, setPlan] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [planAnalysis, setPlanAnalysis] = useState("");
  const [analyzingPlan, setAnalyzingPlan] = useState(false);

  const { projectData, totalRev, totalCost, totalBudget, totalSpent, avgMargin, best } = useMemo(() => {
    const projectData = projects.map(p => {
      const projTasks  = tasks.filter(t2 => t2.project_id === p.id);
      const totalHours = projTasks.reduce((s, t2) => s + (t2.actual_hours || t2.estimated_hours || 0), 0);
      const revenue    = p.budget > 0 ? p.budget : totalHours * RATE;
      const cost       = p.budget > 0 ? (p.budget_spent || totalHours * costRate) : totalHours * costRate;
      const margin     = revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : 0;
      return { ...p, totalHours, revenue, cost, margin, hasBudget: p.budget > 0 };
    });
    const totalRev    = projectData.reduce((s, p) => s + p.revenue, 0);
    const totalCost   = projectData.reduce((s, p) => s + p.cost, 0);
    const totalBudget = projects.filter(p => p.budget > 0).reduce((s, p) => s + (p.budget || 0), 0);
    const totalSpent  = projects.filter(p => p.budget > 0).reduce((s, p) => s + (p.budget_spent || 0), 0);
    const avgMargin   = projectData.length ? Math.round(projectData.reduce((s, p) => s + p.margin, 0) / projectData.length) : 0;
    const best        = projectData.reduce((a, b) => a.margin > b.margin ? a : b, projectData[0] || { title:"—", margin:0 });
    return { projectData, totalRev, totalCost, totalBudget, totalSpent, avgMargin, best };
  }, [projects, tasks, RATE, costRate]);

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
          ? `- ${i.name}: Planned ${fmtM(i.budget, CS)} | Est. Cost ${fmtM(i.estCost, CS)} | Variance ${i.variance >= 0 ? '+' : ''}${fmtM(Math.abs(i.variance), CS)} [${i.risk}]`
          : `- ${i.name}: Planned ${fmtM(i.budget, CS)} | Unlinked`
      ).join('\n');
      const prompt = `Agency financial plan vs project cost analysis:\n\n${lines}\n\nTotal plan budget: ${fmtM(planComparison.totalPlanBudget, CS)}\nTotal estimated cost: ${fmtM(planComparison.totalEstCost, CS)}\nOverall variance: ${planComparison.totalVariance >= 0 ? '+' : ''}${fmtM(Math.abs(planComparison.totalVariance), CS)}\n\nProvide a concise profitability report: 1) Overall health of the plan 2) Line items at risk of cost overrun 3) Specific actions to protect margins.`;
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

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:isMobile?"flex-start":"center", marginBottom:24, flexDirection:isMobile?"column":"row", gap:isMobile?10:0 }}>
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
      <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:14,marginBottom:24 }}>
        <StatCard icon="💵" label="Est. Revenue"   value={fmtM(totalRev, CS)} />
        <StatCard icon="📉" label="Est. Cost"      value={fmtM(totalCost, CS)} />
        <StatCard icon="📈" label="Avg Margin"     value={`${avgMargin}%`} />
        <StatCard icon="🏅" label="Best Project"   value={best?.title?.split(" ")[0]||"—"} sub={`${best?.margin||0}% margin`} />
        <StatCard icon="💰" label="Total Budget"   value={totalBudget > 0 ? fmtM(totalBudget, CS) : "—"} sub="direct budgets set" />
        <StatCard icon="📤" label="Budget Spent"   value={totalBudget > 0 ? fmtM(totalSpent, CS) : "—"} sub={totalBudget > 0 ? `${Math.round((totalSpent/totalBudget)*100)}% used` : "Set budget on projects"} />
      </div>

      {/* Parsing indicator */}
      {parsing && (
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:"20px 24px", marginBottom:20, display:"flex", alignItems:"center", gap:12, color:t.textMuted, fontSize:13 }}>
          <div style={{ width:16, height:16, border:`2px solid ${t.border2}`, borderTopColor:t.accent, borderRadius:"50%", animation:"spin 0.7s linear infinite", flexShrink:0 }} />
          Parsing file…
        </div>
      )}

      {/* ── Plan loaded — comparison table ──────────────────────────────────── */}
      {plan && planComparison && (
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, marginBottom:20, overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", borderBottom:`1px solid ${t.border2}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:t.text }}>Media Plan · {plan.fileName}</h3>
              <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>{plan.items.length} line items · Total {fmtM(plan.totalBudget, CS)}</div>
            </div>
            <button
              onClick={() => { setPlan(null); setPlanAnalysis(""); }}
              style={{ background:"transparent", border:`1px solid ${t.border2}`, color:t.textMuted, borderRadius:7, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}
            >Remove</button>
          </div>
          <div style={{ padding:20 }}>

              {/* Summary mini-stats (visible once ≥1 item linked) */}
              {planComparison.linkedCount > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
                  {[
                    ["Plan Budget", fmtM(planComparison.totalPlanBudget, CS), t.accentLight],
                    ["Est. Cost",   fmtM(planComparison.totalEstCost, CS),    t.textSub],
                    ["Variance",    `${planComparison.totalVariance>=0?"+":""}${fmtM(Math.abs(planComparison.totalVariance), CS)}`, planComparison.totalVariance>=0?"#059669":"#EF4444"],
                    ["At Risk",     `${planComparison.atRisk} item${planComparison.atRisk!==1?"s":""}`, planComparison.atRisk>0?"#EF4444":t.textMuted],
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
                    <div style={{ fontSize:13, color:t.accentLight, fontWeight:700 }}>{fmtM(item.budget, CS)}</div>
                    <select
                      value={item.projectId || ""}
                      onChange={e => linkItem(item.id, e.target.value)}
                      style={{ fontSize:11, background:t.input, border:`1px solid ${t.inputBorder}`, borderRadius:6, color:t.textSub, padding:"4px 6px", width:"100%" }}
                    >
                      <option value="">— unlinked —</option>
                      {projectData.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                    <div style={{ fontSize:13, color:t.textMuted }}>{item.estCost !== null ? fmtM(item.estCost, CS) : "—"}</div>
                    <div style={{ fontSize:13, fontWeight:700, color: item.variance !== null ? (item.variance >= 0 ? "#059669" : "#EF4444") : t.textFaint }}>
                      {item.variance !== null ? `${item.variance >= 0 ? "+" : "−"}${fmtM(Math.abs(item.variance), CS)}` : "—"}
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
        </div>
      </div>
      )}

      {/* ── Project-Level Breakdown ──────────────────────────────────────────── */}
      <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,overflow:"hidden",marginBottom:20 }}>
        <div style={{ padding:"14px 20px",borderBottom:`1px solid ${t.border2}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h3 style={{ margin:0,fontSize:14,fontWeight:700,color:t.text }}>Project-Level Breakdown</h3>
            <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>Revenue uses direct budget when set · otherwise hours × {CS}{RATE}/h rate</div>
          </div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 70px 70px 110px 110px 100px",padding:"10px 20px",borderBottom:`1px solid ${t.border2}`, background:t.statBg }}>
          {["Project","Stage","Hours","Revenue / Budget","Cost / Spent","Margin"].map((h,i) => (
            <div key={i} style={{ fontSize:10,fontWeight:700,color:t.textFaint,textTransform:"uppercase",letterSpacing:"0.05em" }}>{h}</div>
          ))}
        </div>
        {projectData.map(p => {
          const mc = p.margin>=40?"#059669":p.margin>=25?"#F59E0B":"#EF4444";
          const budgetOver = p.hasBudget && p.cost > p.revenue;
          return (
            <div key={p.id} style={{ display:"grid",gridTemplateColumns:"1fr 70px 70px 110px 110px 100px",padding:"12px 20px",borderBottom:`1px solid ${t.divider}`,alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13,fontWeight:600,color:t.textSub }}>{p.title}</div>
                <div style={{ display:"flex", gap:5, marginTop:2, alignItems:"center" }}>
                  <div style={{ fontSize:10, color:t.textFaint }}>{p.assigned_to?.name}</div>
                  {p.hasBudget && <span style={{ fontSize:9, fontWeight:700, color:"#7C3AED", background:"#7C3AED18", borderRadius:3, padding:"1px 5px" }}>BUDGET</span>}
                </div>
              </div>
              <Badge label={p.stage} color={stageColor(p.stage)} />
              <div style={{ fontSize:13,color:t.textMuted }}>{p.totalHours}h</div>
              <div style={{ fontSize:13,color:t.accentLight,fontWeight:600 }}>{fmtM(p.revenue, CS)}</div>
              <div style={{ fontSize:13, fontWeight:600, color: budgetOver ? "#EF4444" : t.textSub }}>{fmtM(p.cost, CS)}</div>
              <div>
                <span style={{ fontSize:14,fontWeight:800,color:mc }}>{p.margin}%</span>
                <div style={{ marginTop:3 }}><ProgressBar value={Math.max(0,p.margin)} max={100} color={mc} height={4} /></div>
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
