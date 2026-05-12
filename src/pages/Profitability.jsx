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
  const billableRate = 150;
  const costRate = 80;

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
  return (
    <div>
      <h1 style={{ margin:"0 0 24px",fontSize:26,fontWeight:800,color:t.text }}>Profitability</h1>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24 }}>
        <StatCard icon="💵" label="Est. Revenue" value={`$${Math.round(totalRev/1000)}k`} />
        <StatCard icon="📉" label="Est. Cost" value={`$${Math.round(totalCost/1000)}k`} />
        <StatCard icon="📈" label="Avg Margin" value={`${avgMargin}%`} />
        <StatCard icon="🏅" label="Best Project" value={best?.title?.split(" ")[0]||"—"} sub={`${best?.margin||0}% margin`} />
      </div>
      <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,overflow:"hidden",marginBottom:20 }}>
        <div style={{ padding:"14px 20px",borderBottom:`1px solid ${t.border2}` }}>
          <h3 style={{ margin:0,fontSize:14,fontWeight:700,color:t.text }}>Project-Level Breakdown</h3>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 100px",padding:"10px 20px",borderBottom:`1px solid ${t.border2}` }}>
          {["Project","Stage","Hours","Revenue","Margin"].map((h,i)=><div key={i} style={{ fontSize:11,fontWeight:700,color:t.textFaint,textTransform:"uppercase",letterSpacing:"0.05em" }}>{h}</div>)}
        </div>
        {projectData.map(p=>{
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
      <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,padding:20 }}>
        <h3 style={{ margin:"0 0 14px",fontSize:14,fontWeight:700,color:t.text }}>Industry Margin Benchmarks</h3>
        {[["Digital","45–55%","#7C3AED"],["PR","35–45%","#0891B2"],["Creative","40–50%","#F97316"],["Media Buying","15–25%","#F59E0B"],["Consulting","50–65%","#059669"]].map(([cat,range,color])=>(
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
