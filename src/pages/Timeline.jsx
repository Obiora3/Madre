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

export const Timeline = React.memo(function Timeline() {
  const { projects } = useApp();
  const { theme: t } = useTheme();
  const active = projects.filter(p => p.start_date && p.due_date);
  if (!active.length) return <div style={{color:t.textMuted,padding:40}}>No projects with dates.</div>;
  const dates = active.flatMap(p=>[new Date(p.start_date),new Date(p.due_date)]);
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const totalDays = Math.ceil((maxDate-minDate)/86400000)+14;
  const dayWidth = 28;
  const weeks = [];
  const cur = new Date(minDate);
  while (cur <= maxDate) { weeks.push(new Date(cur)); cur.setDate(cur.getDate()+7); }
  return (
    <div>
      <h1 style={{ margin:"0 0 24px", fontSize:26, fontWeight:800, color:t.text }}>Timeline</h1>
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"auto" }}>
        <div style={{ minWidth: totalDays*dayWidth+200, padding:"0 0 20px" }}>
          <div style={{ display:"flex", paddingLeft:200, borderBottom:`1px solid ${t.border2}`, position:"sticky", top:0, background:t.card, zIndex:2 }}>
            {weeks.map((w,i)=>(
              <div key={i} style={{ minWidth:dayWidth*7, borderRight:`1px solid ${t.divider}`, padding:"8px 10px", fontSize:11, color:t.textFaint, fontWeight:600 }}>
                {w.toLocaleDateString("en-GB",{day:"numeric",month:"short"})}
              </div>
            ))}
          </div>
          {active.map(p=>{
            const start = new Date(p.start_date); const end = new Date(p.due_date);
            const left = Math.round((start-minDate)/86400000)*dayWidth;
            const width = Math.max(dayWidth, Math.round((end-start)/86400000)*dayWidth);
            return (
              <div key={p.id} style={{ display:"flex", alignItems:"center", borderBottom:`1px solid ${t.divider}`, height:48 }}>
                <div style={{ width:200, flexShrink:0, padding:"0 16px", fontSize:12, fontWeight:600, color:t.textSub, borderRight:`1px solid ${t.border2}`, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                <div style={{ flex:1, position:"relative", height:"100%" }}>
                  <div style={{ position:"absolute", left:left+8, top:"50%", transform:"translateY(-50%)", width, height:24, background:priorityColor(p.priority)+"88", border:`1px solid ${priorityColor(p.priority)}`, borderRadius:6, display:"flex", alignItems:"center", paddingLeft:8 }}>
                    <span style={{ fontSize:10, color:"#fff", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.title}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display:"flex", gap:16, marginTop:16, flexWrap:"wrap" }}>
        {[["Critical","#EF4444"],["High","#F97316"],["Medium","#3B82F6"],["Low","#6B7280"]].map(([label,color])=>(
          <div key={label} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:t.textMuted }}>
            <div style={{ width:14, height:14, borderRadius:3, background:color+"88", border:`1px solid ${color}` }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
})
