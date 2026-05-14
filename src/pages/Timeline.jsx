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
  const { projects, tasks, nav } = useApp();
  const { theme: t } = useTheme();
  const bs = mkBtnSecondary(t);
  const [zoom, setZoom]           = useState("week");
  const [showTasks, setShowTasks] = useState(true);
  const scrollRef = useRef(null);

  const active = projects.filter(p => p.start_date && p.due_date);

  const DAY_PX  = { week: 32, month: 16, quarter: 8 }[zoom];
  const LABEL_W = 220;
  const TICK_PX = zoom === "quarter" ? DAY_PX * 28 : DAY_PX * 7;
  const ROW_H   = 50;
  const TASK_H  = 34;

  const { minDate, maxDate } = useMemo(() => {
    if (!active.length) return { minDate: new Date(), maxDate: new Date() };
    const ds = [];
    active.forEach(p => { ds.push(new Date(p.start_date), new Date(p.due_date)); });
    tasks
      .filter(t2 => t2.due_date && active.find(p => p.id === t2.project_id))
      .forEach(t2 => { if (t2.created_at) ds.push(new Date(t2.created_at)); ds.push(new Date(t2.due_date)); });
    const mn = new Date(Math.min(...ds.map(d => d.getTime())));
    const mx = new Date(Math.max(...ds.map(d => d.getTime())));
    mn.setDate(mn.getDate() - 7);
    mx.setDate(mx.getDate() + 14);
    return { minDate: mn, maxDate: mx };
  }, [active, tasks]);

  const totalDays = Math.ceil((maxDate - minDate) / 86400000);

  const ticks = useMemo(() => {
    const out = [];
    const step = zoom === "quarter" ? 28 : 7;
    const c = new Date(minDate);
    c.setDate(c.getDate() - c.getDay());
    while (c <= maxDate) { out.push(new Date(c)); c.setDate(c.getDate() + step); }
    return out;
  }, [minDate, maxDate, zoom]);

  const today    = new Date();
  const todayPx  = Math.max(0, Math.round((today - minDate) / 86400000)) * DAY_PX;
  const pxOf     = (d) => Math.round((new Date(d) - minDate) / 86400000) * DAY_PX;
  const pxSpan   = (s, e) => Math.max(DAY_PX, Math.round((new Date(e) - new Date(s)) / 86400000) * DAY_PX);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, LABEL_W + todayPx - 300);
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
        <div style={{ minWidth: totalDays * DAY_PX + LABEL_W + 40, position:"relative" }}>

          {/* Sticky date header */}
          <div style={{ display:"flex", paddingLeft:LABEL_W, borderBottom:`1px solid ${t.border2}`, position:"sticky", top:0, background:t.card, zIndex:10 }}>
            {ticks.map((w, i) => (
              <div key={i} style={{ minWidth:TICK_PX, maxWidth:TICK_PX, borderRight:`1px solid ${t.divider}`, padding:"7px 10px 6px", fontSize:10, color:t.textFaint, fontWeight:600, letterSpacing:"0.04em", overflow:"hidden" }}>
                {w.toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
                {zoom === "week" && <div style={{ fontSize:9, opacity:0.55, marginTop:1 }}>{w.toLocaleDateString("en-GB", { year:"numeric" })}</div>}
              </div>
            ))}
          </div>

          {/* Row body */}
          <div style={{ position:"relative" }}>

            {/* Today marker */}
            {today >= minDate && today <= maxDate && (
              <div style={{ position:"absolute", left: LABEL_W + todayPx + 8, top:0, bottom:0, width:2, background:"#EF4444", opacity:0.55, zIndex:5, pointerEvents:"none" }}>
                <div style={{ position:"absolute", top:4, left:-14, background:"#EF4444", color:"#fff", fontSize:8, fontWeight:800, borderRadius:3, padding:"2px 5px", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>TODAY</div>
              </div>
            )}

            {active.map(p => {
              const prog   = calcProgress(p.id, tasks);
              const color  = priorityColor(p.priority);
              const barL   = pxOf(p.start_date);
              const barW   = pxSpan(p.start_date, p.due_date);
              const pTasks = showTasks ? tasks.filter(t2 => t2.project_id === p.id && t2.due_date) : [];

              return (
                <React.Fragment key={p.id}>
                  {/* Project row */}
                  <div style={{ display:"flex", alignItems:"center", borderBottom:`1px solid ${t.divider}`, height:ROW_H, background:`${color}07` }}>
                    <div
                      onClick={() => nav("project-detail", p.id)}
                      title="Open project"
                      style={{ width:LABEL_W, flexShrink:0, padding:"0 16px", borderRight:`1px solid ${t.border2}`, overflow:"hidden", cursor:"pointer", height:"100%", display:"flex", alignItems:"center", gap:8 }}
                    >
                      <span style={{ width:9, height:9, borderRadius:"50%", background:color, flexShrink:0 }} />
                      <span style={{ flex:1, fontSize:13, fontWeight:700, color:t.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</span>
                      <span style={{ fontSize:9, color:t.textGhost, flexShrink:0, background:t.statBg, borderRadius:99, padding:"1px 5px" }}>{prog}%</span>
                    </div>
                    <div style={{ flex:1, position:"relative", height:"100%", overflow:"visible" }}>
                      <div
                        onClick={() => nav("project-detail", p.id)}
                        title={`${p.title} · ${prog}% complete · ${p.stage}`}
                        style={{ position:"absolute", left: barL + 8, top:"50%", transform:"translateY(-50%)", width:barW, height:28, borderRadius:7, border:`1.5px solid ${color}`, overflow:"hidden", cursor:"pointer" }}
                      >
                        <div style={{ position:"absolute", inset:0, background:color+"1a" }} />
                        <div style={{ position:"absolute", top:0, left:0, width:`${prog}%`, height:"100%", background:color+"44", transition:"width 0.5s" }} />
                        <span style={{ position:"absolute", top:"50%", left:8, transform:"translateY(-50%)", fontSize:10, color:"#fff", fontWeight:700, whiteSpace:"nowrap", textShadow:"0 1px 4px rgba(0,0,0,0.6)", pointerEvents:"none" }}>
                          {p.title} · {prog}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Task sub-rows */}
                  {pTasks.map(t2 => {
                    const s  = t2.created_at || p.start_date;
                    const tL = pxOf(s);
                    const tW = pxSpan(s, t2.due_date);
                    const tc = statusColor(t2.status);
                    return (
                      <div key={t2.id} style={{ display:"flex", alignItems:"center", borderBottom:`1px solid ${t.divider}44`, height:TASK_H }}>
                        <div style={{ width:LABEL_W, flexShrink:0, padding:"0 12px 0 36px", borderRight:`1px solid ${t.border2}44`, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6 }}>
                          {t2.status === "Done" ? (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink:0 }}>
                              <circle cx="5" cy="5" r="4.5" stroke={tc} strokeWidth="1" fill={tc+"22"} />
                              <path d="M3 5.2l1.4 1.4L7 3.5" stroke={tc} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <span style={{ width:5, height:5, borderRadius:"50%", background:tc, flexShrink:0 }} />
                          )}
                          <span style={{ fontSize:11, color:t.status==="Done"?t.textFaint:t.textMuted, flex:1, overflow:"hidden", textOverflow:"ellipsis", textDecoration:t2.status==="Done"?"line-through":"none", opacity:t2.status==="Done"?0.7:1 }}>{t2.title}</span>
                        </div>
                        <div style={{ flex:1, position:"relative", height:"100%" }}>
                          <div style={{ position:"absolute", left: tL + 8, top:"50%", transform:"translateY(-50%)", width:tW, height:18, background: tc+"25", border:`1px solid ${tc}77`, borderRadius:4, display:"flex", alignItems:"center", paddingLeft:5, overflow:"hidden" }}>
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
            <div style={{ width:12, height:12, borderRadius:3, background:c+"44", border:`1.5px solid ${c}` }} />{l}
          </div>
        ))}
        <div style={{ width:1, height:14, background:t.border2 }} />
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#EF4444" }}>
          <div style={{ width:2, height:14, background:"#EF4444", borderRadius:1 }} /> Today
        </div>
        <div style={{ marginLeft:"auto", fontSize:11, color:t.textGhost }}>Click a project bar to open · Scroll horizontally to pan</div>
      </div>
    </div>
  );
});
