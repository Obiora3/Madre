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

// ─── GLOBAL SEARCH ────────────────────────────────────────────────────────────
export const GlobalSearch = React.memo(function GlobalSearch() {
  const { projects, tasks, clients, kpis, nav } = useApp();
  const { theme: t } = useTheme();
  const [query, setQuery]       = useState("");
  const [open, setOpen]         = useState(false);
  const [cursor, setCursor]     = useState(0);
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  // ⌘K / Ctrl+K opens the search bar from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Highlight matching substring
  const highlight = (text, q) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: t.accent + "44", color: t.accent, borderRadius: 2, padding: "0 1px" }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  // Build grouped results — memoised so it only reruns when query or data changes
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const match = (str) => (str || "").toLowerCase().includes(q);
    const results = [];

    const matchedProjects = projects.filter(p => match(p.title) || match(p.description) || match(p.stage)).slice(0, 4);
    if (matchedProjects.length) results.push({
      label: "Projects", icon: "🗂",
      items: matchedProjects.map(p => ({
        id: p.id, title: p.title,
        sub: `${p.stage} · ${p.status}`,
        badge: p.priority, badgeColor: priorityColor(p.priority),
        action: () => nav("project-detail", p.id),
      }))
    });

    const matchedTasks = tasks.filter(t2 => match(t2.title) || match(t2.status) || match(t2.assigned_to?.name)).slice(0, 4);
    if (matchedTasks.length) results.push({
      label: "Tasks", icon: "✓",
      items: matchedTasks.map(t2 => ({
        id: t2.id, title: t2.title,
        sub: `${t2.status} · Due ${fmtDate(t2.due_date)}`,
        badge: t2.priority, badgeColor: priorityColor(t2.priority),
        action: () => nav("tasks"),
      }))
    });

    const matchedClients = clients.filter(c => match(c.name) || match(c.industry) || match(c.primary_contact?.name)).slice(0, 4);
    if (matchedClients.length) results.push({
      label: "Clients", icon: "🤝",
      items: matchedClients.map(c => ({
        id: c.id, title: c.name,
        sub: `${c.industry} · ${c.status}`,
        badge: c.status, badgeColor: statusColor(c.status),
        action: () => nav("clients"),
      }))
    });

    const matchedKPIs = kpis.filter(k => match(k.name) || match(k.category) || match(k.status)).slice(0, 4);
    if (matchedKPIs.length) results.push({
      label: "KPIs", icon: "📊",
      items: matchedKPIs.map(k => ({
        id: k.id, title: k.name,
        sub: `${k.category} · ${k.current_value}${k.unit} / ${k.target_value}${k.unit}`,
        badge: k.status, badgeColor: statusColor(k.status),
        action: () => nav("kpis"),
      }))
    });

    return results;
  }, [query, projects, tasks, clients, kpis]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups]);
  const totalItems = flatItems.length;

  const handleKeyDown = (e) => {
    if (!open || !totalItems) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => (c + 1) % totalItems); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => (c - 1 + totalItems) % totalItems); }
    if (e.key === "Enter")     { e.preventDefault(); flatItems[cursor]?.action(); setOpen(false); setQuery(""); }
  };

  const handleSelect = (action) => { action(); setOpen(false); setQuery(""); };

  const iS = mkInputStyle(t);
  const showDropdown = open && query.trim().length > 0;
  // running index across groups for keyboard cursor tracking
  let itemIndex = 0;

  return (
    <div ref={wrapRef} style={{ flex: 1, maxWidth: 420, position: "relative" }}>
      {/* Input */}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search projects, tasks, clients, KPIs…"
          style={{ ...iS, paddingLeft: 36, paddingRight: 60, fontSize: 13 }}
        />
        <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:t.textGhost, fontSize:14, pointerEvents:"none" }}>🔍</span>
        <kbd style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:10, color:t.textGhost, background:t.toggleBg, border:`1px solid ${t.border2}`, borderRadius:4, padding:"1px 5px", fontFamily:"inherit", pointerEvents:"none" }}>
          {navigator.platform?.includes("Mac") ? "⌘K" : "Ctrl K"}
        </kbd>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, right:0,
          background:t.card, border:`1px solid ${t.border2}`,
          borderRadius:12, boxShadow:t.shadow, zIndex:2000,
          maxHeight:480, overflowY:"auto",
        }}>
          {groups.length === 0 ? (
            <div style={{ padding:"24px 16px", textAlign:"center", color:t.textFaint, fontSize:13 }}>
              No results for <strong style={{ color:t.text }}>"{query}"</strong>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.label}>
                {/* Group header */}
                <div style={{ padding:"8px 14px 4px", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12 }}>{group.icon}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:t.textFaint, letterSpacing:"0.06em", textTransform:"uppercase" }}>{group.label}</span>
                </div>
                {/* Items */}
                {group.items.map(item => {
                  const isActive = itemIndex === cursor;
                  const thisIndex = itemIndex++;
                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setCursor(thisIndex)}
                      onClick={() => handleSelect(item.action)}
                      style={{
                        display:"flex", alignItems:"center", gap:10,
                        padding:"9px 14px", cursor:"pointer",
                        background: isActive ? t.navActive : "transparent",
                        transition:"background 0.1s",
                      }}
                    >
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color: isActive ? t.navActiveText : t.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {highlight(item.title, query)}
                        </div>
                        <div style={{ fontSize:11, color:t.textFaint, marginTop:1 }}>{item.sub}</div>
                      </div>
                      <Badge label={item.badge} color={item.badgeColor} />
                    </div>
                  );
                })}
                <div style={{ height:1, background:t.divider, margin:"4px 0" }} />
              </div>
            ))
          )}
          <div style={{ padding:"8px 14px", display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:11, color:t.textGhost }}>↑↓ navigate · Enter select · Esc close</span>
            <span style={{ fontSize:11, color:t.textGhost }}>{totalItems} result{totalItems !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
})
