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

export const Benchmarking = React.memo(function Benchmarking() {
  const { kpis } = useApp();
  const { theme: t } = useTheme();
  const sS = mkSelectStyle(t);
  const [industry, setIndustry] = useState("Technology");
  const [aiInsight, setAiInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [insightError, setInsightError] = useState(null);
  const benchmarks = [
    { metric:"Email Open Rate", low:"15%", avg:"25%", top:"35%", agencyVal: 28 },
    { metric:"Social Engagement", low:"0.5%", avg:"1.5%", top:"3%", agencyVal: 2.2 },
    { metric:"Conversion Rate", low:"1%", avg:"3%", top:"6%", agencyVal: 4.1 },
    { metric:"Brand Recall", low:"20%", avg:"40%", top:"65%", agencyVal: 47 },
    { metric:"NPS", low:"20", avg:"40", top:"70", agencyVal: 55 },
    { metric:"Lead Generation", low:"50", avg:"150", top:"400", agencyVal: 210 },
  ];
  const industries = ["Technology","Fashion","FMCG","Finance","Healthcare","Retail","Automotive","Entertainment","Food & Beverage"];
  const getInsight = async () => {
    setLoading(true); setAiInsight(null); setInsightError(null);
    try {
      const result = await callClaude(
        `Analyze this agency's performance vs ${industry} industry benchmarks.\n\nMetrics:\n${benchmarks.map(b=>`${b.metric}: ${b.agencyVal} (Industry avg: ${b.avg}, Top: ${b.top})`).join("\n")}\n\nProvide:\n1. Overall performance rating\n2. Top 3 strengths vs peers\n3. Top 3 areas for improvement\n4. 3 specific actionable recommendations`,
        "You are a marketing analytics expert. Be specific and actionable."
      );
      setAiInsight(result);
    } catch (err) {
      setInsightError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <h1 style={{ margin:0,fontSize:26,fontWeight:800,color:t.text }}>Performance Benchmarking</h1>
        <div style={{ display:"flex",gap:10 }}>
          <select style={{...sS,width:160}} value={industry} onChange={e=>setIndustry(e.target.value)}>{industries.map(i=><option key={i}>{i}</option>)}</select>
          <button style={btnPrimary} onClick={getInsight} disabled={loading}>{loading?"Analysing…":"Get AI Insights ✨"}</button>
        </div>
      </div>
      <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,overflow:"hidden",marginBottom:20 }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 120px",padding:"10px 20px",borderBottom:`1px solid ${t.border2}` }}>
          {["Metric","Low","Average","Top Performer","Your Performance"].map((h,i)=><div key={i} style={{ fontSize:11,fontWeight:700,color:t.textFaint,textTransform:"uppercase",letterSpacing:"0.05em" }}>{h}</div>)}
        </div>
        {benchmarks.map(b=>{
          const avgNum = parseFloat(b.avg); const topNum = parseFloat(b.top);
          const isTop = b.agencyVal >= topNum; const isAvg = b.agencyVal >= avgNum;
          const color = isTop?"#059669":isAvg?"#F59E0B":"#EF4444";
          return (
            <div key={b.metric} style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 120px",padding:"12px 20px",borderBottom:`1px solid ${t.divider}`,alignItems:"center" }}>
              <div style={{ fontSize:13,fontWeight:600,color:t.textSub }}>{b.metric}</div>
              <div style={{ fontSize:12,color:"#EF4444" }}>{b.low}</div>
              <div style={{ fontSize:12,color:"#F59E0B" }}>{b.avg}</div>
              <div style={{ fontSize:12,color:"#059669" }}>{b.top}</div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:14,fontWeight:800,color }}>{b.agencyVal}</span>
                <Badge label={isTop?"Top Performer":isAvg?"Average":"Below Avg"} color={color} />
              </div>
            </div>
          );
        })}
      </div>
      {(loading || insightError || aiInsight) && (
        <div style={{ background:t.card,border:`1px solid ${t.accent}44`,borderRadius:14,padding:24 }}>
          {!loading && !insightError && <h3 style={{ margin:"0 0 14px",color:t.text,fontSize:15,fontWeight:700 }}>🤖 AI Insights — {industry}</h3>}
          <AIBlock loading={loading} error={insightError} result={aiInsight} onRetry={getInsight} />
        </div>
      )}
    </div>
  );
})
