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

export const Reports = React.memo(function Reports() {
  const { projects, tasks, kpis, clients } = useApp();
  const { theme: t } = useTheme();
  const iS = mkInputStyle(t); const sS = mkSelectStyle(t); const bs = mkBtnSecondary(t);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportClient, setReportClient] = useState("");
  const [reportType, setReportType] = useState("Monthly");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const genReport = async () => {
    setLoading(true); setReport(null); setReportError(null);
    try {
      const cl = clients.find(c=>c.id===reportClient);
      const cProjects = projects.filter(p=>p.client_id===reportClient);
      const cKPIs = kpis.filter(k=>cProjects.map(p=>p.id).includes(k.project_id));
      const result = await callClaude(
        `Generate a professional ${reportType} client report for ${cl?.name}.\n\nProjects: ${cProjects.map(p=>`${p.title} (${p.stage}, ${p.progress}% complete)`).join("; ")}\nKPIs: ${cKPIs.map(k=>`${k.name}: ${k.current_value}${k.unit} vs ${k.target_value}${k.unit} target (${k.status})`).join("; ")}\n\nInclude: Executive Summary, Project Highlights, KPI Performance, Key Wins, Areas of Focus, Strategic Recommendations.`,
        "You are a senior account director writing a client report. Be strategic, data-driven, and professional."
      );
      setReport(result);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const stages = ["Brief","Strategy","Creative","Review","Delivered"];
  const kpiStatuses = ["On Track","At Risk","Behind","Achieved","Not Started"];
  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <h1 style={{ margin:0,fontSize:26,fontWeight:800,color:t.text }}>Reports & Analytics</h1>
        <button style={btnPrimary} onClick={()=>setShowReportModal(true)}>Generate Report ✨</button>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24 }}>
        <StatCard icon="🚀" label="Active Projects" value={projects.filter(p=>p.status==="Active").length} />
        <StatCard icon="✅" label="Tasks Completed" value={tasks.filter(t2=>t2.status==="Done").length} />
        <StatCard icon="⚠️" label="Overdue Tasks" value={tasks.filter(t2=>t2.status!=="Done"&&new Date(t2.due_date)<new Date()).length} />
        <StatCard icon="🎯" label="KPI Achievement" value={`${Math.round((kpis.filter(k=>k.status==="Achieved").length/Math.max(kpis.length,1))*100)}%`} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20 }}>
        <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,padding:20 }}>
          <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:t.text }}>Projects by Stage</h3>
          {stages.map(s=>{
            const count = projects.filter(p=>p.stage===s).length;
            return <div key={s} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
              <div style={{ width:80,fontSize:12,color:t.textMuted }}>{s}</div>
              <ProgressBar value={count} max={Math.max(projects.length,1)} color={stageColor(s)} height={8} />
              <div style={{ fontSize:13,fontWeight:700,color:t.text,width:20 }}>{count}</div>
            </div>;
          })}
        </div>
        <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,padding:20 }}>
          <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:t.text }}>KPI Status Breakdown</h3>
          {kpiStatuses.map(s=>{
            const count = kpis.filter(k=>k.status===s).length;
            return <div key={s} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
              <div style={{ width:90,fontSize:12,color:t.textMuted }}>{s}</div>
              <ProgressBar value={count} max={Math.max(kpis.length,1)} color={statusColor(s)} height={8} />
              <div style={{ fontSize:13,fontWeight:700,color:t.text,width:20 }}>{count}</div>
            </div>;
          })}
        </div>
      </div>
      <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,padding:20 }}>
        <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:t.text }}>Client Project Breakdown</h3>
        {clients.map(c=>{
          const count = projects.filter(p=>p.client_id===c.id).length;
          return <div key={c.id} style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}>
            <div style={{ width:120,fontSize:12,color:t.textMuted }}>{c.name}</div>
            <ProgressBar value={count} max={Math.max(projects.length,1)} color="#7C3AED" height={8} />
            <div style={{ fontSize:13,fontWeight:700,color:t.accentLight }}>{count}</div>
          </div>;
        })}
      </div>
      <Modal open={showReportModal} onClose={()=>setShowReportModal(false)} title="Generate Client Report" width={700}>
        <FormField label="Client"><select style={sS} value={reportClient} onChange={e=>setReportClient(e.target.value)}><option value="">Select client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
        <FormField label="Report Type"><select style={sS} value={reportType} onChange={e=>setReportType(e.target.value)}>{["Monthly","Quarterly","Campaign","Annual"].map(t2=><option key={t2}>{t2}</option>)}</select></FormField>
        <div style={{ display:"flex",gap:10,marginBottom:20 }}>
          <button style={btnPrimary} onClick={genReport} disabled={!reportClient||loading}>{loading?"Generating…":"Generate ✨"}</button>
        </div>
        <AIBlock loading={loading} error={reportError} result={report} onRetry={genReport} />
      </Modal>
    </div>
  );
})
