import {
  React,
  useMemo,
  useState,
  useApp,
  useTheme,
  isTaskComplete,
  priorityColor,
  mkBtnSecondary,
} from "./_shared.js";

// MINI: Trello-style calendar — every task with a due date, plus project due
// dates, plotted on the day they land. Additive/UI-only, no schema changes.

const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MAX_VISIBLE = 3;

// Parse a "YYYY-MM-DD" (or any Date-parseable) date string as a local calendar
// day, sidestepping UTC-offset shifting a date to the wrong day.
function toLocalDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return isNaN(d) ? null : d;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function ymKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

export const Calendar = React.memo(function Calendar() {
  const { tasks, projects, nav, isMobile } = useApp();
  const { theme: t } = useTheme();
  const bs = mkBtnSecondary(t);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [expandedDay, setExpandedDay] = useState(null); // ymKey of the day whose overflow is expanded

  const projectById = useMemo(() => Object.fromEntries((projects||[]).map(p => [p.id, p])), [projects]);

  // Bucket every dated item (task due dates + project due dates) by day.
  const itemsByDay = useMemo(() => {
    const map = new Map();
    const push = (date, item) => {
      if (!date) return;
      const key = ymKey(date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    };
    (tasks||[]).forEach(task => {
      const d = toLocalDate(task.due_date);
      if (d) push(d, { kind:"task", id:task.id, title:task.title, priority:task.priority, done:isTaskComplete(task), assignee:task.assigned_to?.name, project: task.project_id ? projectById[task.project_id] : null });
    });
    (projects||[]).forEach(project => {
      const d = toLocalDate(project.due_date);
      if (d) push(d, { kind:"project", id:project.id, title:project.title, project });
    });
    return map;
  }, [tasks, projects, projectById]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month:"long", year:"numeric" });

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    const rows = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const goPrev  = () => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext  = () => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const openItem = (item) => {
    if (item.kind === "project" && item.project) nav("project-detail", item.project.id);
    else if (item.kind === "task" && item.project) nav("project-detail", item.project.id);
    else nav("tasks");
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:isMobile?"flex-start":"center", marginBottom:20, flexDirection:isMobile?"column":"row", gap:isMobile?10:0 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:t.text }}>Calendar</h1>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={goPrev} style={{...bs, padding:"6px 12px", fontSize:14}} aria-label="Previous month">‹</button>
          <div style={{ minWidth:150, textAlign:"center", fontSize:14, fontWeight:700, color:t.text }}>{monthLabel}</div>
          <button onClick={goNext} style={{...bs, padding:"6px 12px", fontSize:14}} aria-label="Next month">›</button>
          <button onClick={goToday} style={{...bs, padding:"6px 12px", fontSize:12}}>Today</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:1, background:t.border, border:`1px solid ${t.border}`, borderRadius:12, overflow:"hidden" }}>
        {WEEKDAYS.map(w => (
          <div key={w} style={{ background:t.statBg, padding:"8px 0", textAlign:"center", fontSize:11, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:"0.06em" }}>
            {isMobile ? w.slice(0,1) : w}
          </div>
        ))}
        {weeks.flat().map((day, i) => {
          const key = ymKey(day);
          const items = itemsByDay.get(key) || [];
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, today);
          const expanded = expandedDay === key;
          const visible = expanded ? items : items.slice(0, MAX_VISIBLE);
          const overflow = items.length - visible.length;
          return (
            <div key={i} style={{
              background:t.card, minHeight:isMobile?68:104, padding:"6px 5px",
              opacity:inMonth?1:0.45, display:"flex", flexDirection:"column", gap:3,
            }}>
              <span style={{
                fontSize:11, fontWeight:isToday?800:600, color:isToday?"#fff":t.textFaint,
                width:isToday?20:"auto", height:isToday?20:"auto", lineHeight:isToday?"20px":"normal",
                textAlign:"center", borderRadius:"50%", background:isToday?"#7C3AED":"transparent",
              }}>
                {day.getDate()}
              </span>
              {visible.map(item => (
                <button
                  key={`${item.kind}-${item.id}`}
                  onClick={() => openItem(item)}
                  title={item.title}
                  style={{
                    display:"flex", alignItems:"center", gap:4, width:"100%", textAlign:"left",
                    background: item.kind==="project" ? `${t.accent||"#7C3AED"}18` : t.statBg,
                    border:`1px solid ${item.kind==="project" ? (t.accent||"#7C3AED") : t.border2}`,
                    borderRadius:6, padding:"2px 5px", cursor:"pointer",
                    color:item.done?t.textFaint:t.text, textDecoration:item.done?"line-through":"none",
                  }}
                >
                  {item.kind === "task" && <span style={{ width:6, height:6, borderRadius:"50%", background:priorityColor(item.priority), flexShrink:0 }} />}
                  {item.kind === "project" && <span style={{ fontSize:9, flexShrink:0 }}>🗂</span>}
                  <span style={{ fontSize:10, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</span>
                </button>
              ))}
              {overflow > 0 && (
                <button
                  onClick={() => setExpandedDay(key)}
                  style={{ background:"transparent", border:"none", color:t.textMuted, fontSize:10, fontWeight:700, cursor:"pointer", textAlign:"left", padding:"0 2px" }}
                >
                  +{overflow} more
                </button>
              )}
              {expanded && items.length > MAX_VISIBLE && (
                <button
                  onClick={() => setExpandedDay(null)}
                  style={{ background:"transparent", border:"none", color:t.textMuted, fontSize:10, cursor:"pointer", textAlign:"left", padding:"0 2px" }}
                >
                  Show less
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex", gap:16, marginTop:14, flexWrap:"wrap", fontSize:11, color:t.textMuted }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:priorityColor("High") }} /> Task (colored by priority)
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:11 }}>🗂</span> Project due date
        </div>
      </div>
    </div>
  );
});
