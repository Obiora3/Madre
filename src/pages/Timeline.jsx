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
  calcProgress,
  fmtDate,
  getTaskPipelines,
  isTaskComplete,
  priorityColor,
  stageColor,
  statusColor,
  taskStatusColor,
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
  const { projects, tasks, nav, whiteLabelSettings } = useApp();
  const { theme: t } = useTheme();
  const bs = mkBtnSecondary(t);
  const taskPipelines = useMemo(() => getTaskPipelines(whiteLabelSettings), [whiteLabelSettings]);
  const [zoom, setZoom]           = useState("week");
  const [showTasks, setShowTasks] = useState(true);
  const scrollRef = useRef(null);

  const active = projects.filter(p => p.start_date && p.due_date);

  const DAY_PX  = { week: 32, month: 16, quarter: 8 }[zoom];
  const LABEL_W = 200;
  const TICK_PX = zoom === "quarter" ? DAY_PX * 28 : DAY_PX * 7;
  const ROW_H   = 44;
  const TASK_H  = 30;
  const HDR_H   = 44; // two rows × 22px

  const { minDate, maxDate } = useMemo(() => {
    if (!active.length) return { minDate: new Date(), maxDate: new Date() };
    const ds = [];
    active.forEach(p => { ds.push(new Date(p.start_date), new Date(p.due_date)); });
    tasks
      .filter(t2 => t2.due_date && active.find(p => p.id === t2.project_id))
      .forEach(t2 => { if (t2.created_at) ds.push(new Date(t2.created_at)); ds.push(new Date(t2.due_date)); });
    const mn = new Date(Math.min(...ds.map(d => d.getTime())));
    const mx = new Date(Math.max(...ds.map(d => d.getTime())));
    mn.setDate(mn.getDate() - 3);
    mx.setDate(mx.getDate() + 10);
    return { minDate: mn, maxDate: mx };
  }, [active, tasks]);

  const totalDays = Math.ceil((maxDate - minDate) / 86400000);

  // Month markers for top header row
  const monthMarkers = useMemo(() => {
    const out = [];
    const c = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (c <= maxDate) {
      const left = Math.max(0, Math.round((c - minDate) / 86400000) * DAY_PX);
      const nextM = new Date(c.getFullYear(), c.getMonth() + 1, 1);
      const right = Math.min(totalDays * DAY_PX, Math.round((nextM - minDate) / 86400000) * DAY_PX);
      if (right > left) {
        out.push({
          label: c.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
          left,
          width: right - left,
        });
      }
      c.setMonth(c.getMonth() + 1);
    }
    return out;
  }, [minDate, maxDate, totalDays, DAY_PX]);

  const ticks = useMemo(() => {
    const out = [];
    const step = zoom === "quarter" ? 28 : 7;
    const c = new Date(minDate);
    c.setDate(c.getDate() - ((c.getDay() + 6) % 7)); // align to Monday
    while (c <= maxDate) { out.push(new Date(c)); c.setDate(c.getDate() + step); }
    return out;
  }, [minDate, maxDate, zoom]);

  const today   = new Date();
  const todayPx = Math.max(0, Math.round((today - minDate) / 86400000)) * DAY_PX;
  const pxOf    = (d) => Math.round((new Date(d) - minDate) / 86400000) * DAY_PX;
  const pxSpan  = (s, e) => Math.max(DAY_PX, Math.round((new Date(e) - new Date(s)) / 86400000) * DAY_PX);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, todayPx - 300);
    }
  }, [todayPx]);

  if (!active.length) {
    return (
      <div>
        <h1 style={{ margin:"0 0 24px", fontSize:26, fontWeight:800, color:t.text }}>Timeline</h1>
        <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, padding:60, textAlign:"center" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>📅</div>
          <div style={{ fontSize:16, fontWeight:700, color:t.text, marginBottom:8 }}>No projects with dates yet</div>
          <div style={{ fontSize:13, color:t.textMuted, maxWidth:320, margin:"0 auto" }}>
            Add start and due dates to your projects to see them on the timeline.
          </div>
          <button onClick={() => nav("projects")} style={{ ...btnPrimary, marginTop:20 }}>Go to Projects</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Topbar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>
          Timeline
          <span style={{ marginLeft:10, fontSize:14, fontWeight:500, color:t.textFaint }}>({active.length} projects)</span>
        </h1>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:t.textMuted, cursor:"pointer", userSelect:"none" }}>
            <input type="checkbox" checked={showTasks} onChange={e => setShowTasks(e.target.checked)} style={{ accentColor:t.accent }} />
            Show tasks
          </label>
          <div style={{ width:1, height:18, background:t.border2, margin:"0 4px" }} />
          {["week","month","quarter"].map(z => (
            <button key={z} onClick={() => setZoom(z)} style={{ ...bs, padding:"5px 14px", fontSize:11, background: zoom===z ? t.accent+"22" : "transparent", color: zoom===z ? t.accent : t.textMuted, border:`1px solid ${zoom===z ? t.accent+"88" : t.border}`, fontWeight: zoom===z ? 700 : 400 }}>
              {z.charAt(0).toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt */}
      <div style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"auto" }} ref={scrollRef}>
        <div style={{ minWidth: totalDays * DAY_PX + LABEL_W, position:"relative" }}>

          {/* ── Sticky two-row header ── */}
          <div style={{ display:"flex", position:"sticky", top:0, zIndex:10, background:t.card, borderBottom:`1px solid ${t.border2}` }}>

            {/* Corner label cell — sticky both top and left */}
            <div style={{ width:LABEL_W, flexShrink:0, position:"sticky", left:0, zIndex:12, background:t.card, borderRight:`1px solid ${t.border2}`, display:"flex", flexDirection:"column" }}>
              <div style={{ height:22, borderBottom:`1px solid ${t.divider}`, display:"flex", alignItems:"center", padding:"0 14px" }}>
                <span style={{ fontSize:9, fontWeight:700, color:t.textGhost, textTransform:"uppercase", letterSpacing:"0.08em" }}>Project / Task</span>
              </div>
              <div style={{ height:22 }} />
            </div>

            {/* Tick area */}
            <div style={{ flex:1, position:"relative", minWidth: totalDays * DAY_PX, height: HDR_H }}>
              {/* Month row */}
              {monthMarkers.map((m, i) => (
                <div key={i} style={{ position:"absolute", left:m.left, top:0, width:m.width, height:22, display:"flex", alignItems:"center", borderRight:`1px solid ${t.divider}`, padding:"0 8px", overflow:"hidden", boxSizing:"border-box" }}>
                  <span style={{ fontSize:10, fontWeight:700, color:t.textSub, letterSpacing:"0.03em", whiteSpace:"nowrap" }}>{m.label}</span>
                </div>
              ))}
              {/* Week / quarter tick row */}
              {ticks.map((w, i) => {
                const left = Math.max(0, Math.round((w - minDate) / 86400000) * DAY_PX);
                return (
                  <div key={i} style={{ position:"absolute", left, top:22, width:TICK_PX, height:22, display:"flex", alignItems:"center", borderRight:`1px solid ${t.divider}`, padding:"0 6px", overflow:"hidden", boxSizing:"border-box" }}>
                    <span style={{ fontSize:9, color:t.textFaint, fontWeight:500, whiteSpace:"nowrap" }}>
                      {w.toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Row body ── */}
          <div style={{ position:"relative" }}>

            {/* Today marker */}
            {today >= minDate && today <= maxDate && (
              <div style={{ position:"absolute", left: LABEL_W + todayPx, top:0, bottom:0, width:1.5, background:"#EF4444", opacity:0.75, zIndex:5, pointerEvents:"none" }}>
                <div style={{ position:"absolute", top:4, left:-18, background:"#EF4444", color:"#fff", fontSize:8, fontWeight:800, borderRadius:4, padding:"2px 6px", letterSpacing:"0.05em", whiteSpace:"nowrap", boxShadow:"0 1px 4px rgba(239,68,68,0.35)" }}>TODAY</div>
              </div>
            )}

            {active.map((p, pi) => {
              const prog   = calcProgress(p.id, tasks, p, taskPipelines);
              const color  = priorityColor(p.priority);
              const barL   = pxOf(p.start_date);
              const barW   = pxSpan(p.start_date, p.due_date);
              const pTasks = showTasks ? tasks.filter(t2 => t2.project_id === p.id && t2.due_date) : [];

              return (
                <React.Fragment key={p.id}>
                  {/* Project row */}
                  <div style={{ display:"flex", alignItems:"center", borderBottom:`1px solid ${t.border2}`, height:ROW_H }}>

                    {/* Sticky label */}
                    <div
                      onClick={() => nav("project-detail", p.id)}
                      title="Open project"
                      style={{ width:LABEL_W, flexShrink:0, padding:"0 14px", borderRight:`1px solid ${t.border2}`, overflow:"hidden", cursor:"pointer", height:"100%", display:"flex", alignItems:"center", gap:8, position:"sticky", left:0, zIndex:4, background:t.card }}
                    >
                      <span style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }} />
                      <span style={{ flex:1, fontSize:12, fontWeight:700, color:t.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</span>
                      <span style={{ fontSize:9, color:t.textGhost, flexShrink:0, background:t.statBg, borderRadius:99, padding:"1px 6px", fontWeight:600, border:`1px solid ${t.border}` }}>{prog}%</span>
                    </div>

                    {/* Bar area */}
                    <div style={{ flex:1, position:"relative", height:"100%", minWidth: totalDays * DAY_PX }}>
                      <div
                        onClick={() => nav("project-detail", p.id)}
                        title={`${p.title} · ${prog}% · ${p.stage || ""}`}
                        style={{ position:"absolute", left: barL + 4, top:"50%", transform:"translateY(-50%)", width:barW, height:26, borderRadius:13, overflow:"hidden", cursor:"pointer", boxShadow:`0 2px 6px ${color}30` }}
                      >
                        {/* Track */}
                        <div style={{ position:"absolute", inset:0, background:`${color}18`, border:`1.5px solid ${color}70`, borderRadius:13 }} />
                        {/* Progress fill */}
                        <div style={{ position:"absolute", top:0, left:0, width:`${prog}%`, height:"100%", background:`linear-gradient(90deg, ${color}55, ${color}88)`, transition:"width 0.5s", borderRadius:"13px 0 0 13px" }} />
                        <span style={{ position:"absolute", top:"50%", left:10, transform:"translateY(-50%)", fontSize:10, color:"#fff", fontWeight:700, whiteSpace:"nowrap", textShadow:"0 1px 3px rgba(0,0,0,0.5)", pointerEvents:"none" }}>
                          {p.title} · {prog}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Task sub-rows */}
                  {pTasks.map((t2, ti) => {
                    const s    = t2.created_at || p.start_date;
                    const tL   = pxOf(s);
                    const tW   = pxSpan(s, t2.due_date);
                    const tc   = taskStatusColor(t2, p, taskPipelines);
                    const done = isTaskComplete(t2, p, taskPipelines);
                    const lastTask = ti === pTasks.length - 1;
                    return (
                      <div key={t2.id} style={{ display:"flex", alignItems:"center", borderBottom:`1px solid ${lastTask ? t.border2 : t.divider}`, height:TASK_H }}>

                        {/* Sticky label */}
                        <div style={{ width:LABEL_W, flexShrink:0, padding:"0 10px 0 28px", borderRight:`1px solid ${t.border2}40`, overflow:"hidden", display:"flex", alignItems:"center", gap:6, position:"sticky", left:0, zIndex:4, background:t.card }}>
                          {done ? (
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink:0 }}>
                              <circle cx="5" cy="5" r="4.5" stroke={tc} strokeWidth="1" fill={tc+"22"} />
                              <path d="M3 5.2l1.4 1.4L7 3.5" stroke={tc} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <span style={{ width:5, height:5, borderRadius:"50%", background:tc, flexShrink:0 }} />
                          )}
                          <span style={{ fontSize:11, color:done?t.textGhost:t.textMuted, flex:1, overflow:"hidden", textOverflow:"ellipsis", textDecoration:done?"line-through":"none" }}>{t2.title}</span>
                        </div>

                        {/* Task bar */}
                        <div style={{ flex:1, position:"relative", height:"100%", minWidth: totalDays * DAY_PX }}>
                          <div style={{ position:"absolute", left: tL + 4, top:"50%", transform:"translateY(-50%)", width:tW, height:16, background:`${tc}18`, border:`1px solid ${tc}60`, borderRadius:8, display:"flex", alignItems:"center", paddingLeft:6, overflow:"hidden" }}>
                            <span style={{ fontSize:9, color:tc, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t2.title}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>

        </div>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:16, marginTop:14, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:11, color:t.textFaint, fontWeight:600 }}>Priority:</span>
        {[["Critical","#EF4444"],["High","#F97316"],["Medium","#3B82F6"],["Low","#6B7280"]].map(([l,c])=>(
          <div key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:t.textMuted }}>
            <div style={{ width:10, height:10, borderRadius:3, background:c+"28", border:`1.5px solid ${c}` }} />{l}
          </div>
        ))}
        <div style={{ width:1, height:14, background:t.border2 }} />
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#EF4444" }}>
          <div style={{ width:2, height:14, background:"#EF4444", borderRadius:1, opacity:0.75 }} /> Today
        </div>
        <div style={{ marginLeft:"auto", fontSize:11, color:t.textGhost }}>Click a project to open · Scroll to pan</div>
      </div>
    </div>
  );
});
