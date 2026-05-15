import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context/app-context.jsx";
import { useTheme } from "../theme.js";
import { fmtDate, initials, avatarBg } from "../lib/helpers.js";

export function Badge({ label, color }) {
  return <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{label}</span>;
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme.mode === "dark";
  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        background: dark ? "#1c1c2e" : "#EDE9FF",
        border: `1px solid ${dark ? "#333350" : "#C4B8F5"}`,
        borderRadius: 99, padding: "5px 12px 5px 8px",
        cursor: "pointer", transition: "all 0.2s", userSelect: "none",
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{dark ? "🌙" : "☀️"}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: dark ? "#A78BFA" : "#6D28D9", letterSpacing: "0.02em" }}>
        {dark ? "Dark" : "Light"}
      </span>
    </button>
  );
}

export function Avatar({ name, size = 32 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: avatarBg(name), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>{initials(name)}</div>;
}

export function StatCard({ icon, label, value, sub, color = "#7C3AED" }) {
  const { theme: t } = useTheme();
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ color: t.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: t.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: t.textFaint }}>{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, max = 100, color = "#7C3AED", height = 6 }) {
  const { theme: t } = useTheme();
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ background: t.toggleBg, borderRadius: 99, height, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
    </div>
  );
}

// ─── AI BLOCK ─────────────────────────────────────────────────────────────────
// Shared presenter for all AI result areas — loading shimmer, error banner, result text.
export function AIBlock({ loading, error, result, placeholder, onRetry, prose = true }) {
  const { theme: t } = useTheme();
  if (loading) return (
    <div style={{ background: t.statBg, borderRadius: 10, padding: 20 }}>
      {[100, 85, 92, 70].map((w, i) => (
        <div key={i} style={{ height: 13, borderRadius: 6, background: t.toggleBg, marginBottom: 10, width: `${w}%`, animation: "shimmer 1.4s ease-in-out infinite", opacity: 0.6 + i * 0.1 }} />
      ))}
      <style>{`@keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:.9} }`}</style>
    </div>
  );
  if (error) return (
    <div style={{ background: "#EF444411", border: "1px solid #EF444444", borderRadius: 10, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#EF4444", marginBottom: 4 }}>AI request failed</div>
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>{error}</div>
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{ background: "#EF444422", border: "1px solid #EF444466", borderRadius: 7, padding: "5px 12px", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          Retry
        </button>
      )}
    </div>
  );
  if (result) return (
    <div style={{ fontSize: 13, color: t.aiText, lineHeight: 1.8, background: t.statBg, borderRadius: 10, padding: 16, whiteSpace: prose ? "pre-wrap" : "normal" }}>
      {result}
    </div>
  );
  return <p style={{ color: t.textFaint, fontSize: 13, margin: 0 }}>{placeholder}</p>;
}


export const NotificationBell = React.memo(function NotificationBell() {
  const { tasks, comments, projects, currentUser, nav, whiteLabelSettings } = useApp();
  const { theme: t } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("af_dismissed") || "[]")); } catch { return new Set(); }
  });

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onMouse = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey   = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown",   onKey);
    };
  }, [open]);

  const projectById = useMemo(() =>
    Object.fromEntries((projects || []).map(p => [p.id, p])),
    [projects]
  );
  const taskById = useMemo(() =>
    Object.fromEntries((tasks || []).map(t2 => [t2.id, t2])),
    [tasks]
  );

  const deadlineWindow = Number(whiteLabelSettings?.deadline_warning_hours || 24);
  const escalationHours = Number(whiteLabelSettings?.overdue_escalation_hours || 24);
  const now = new Date();
  const urgent = whiteLabelSettings?.notify_deadlines === false ? [] : tasks.filter(t2 => t2.status !== "Done" && !dismissed.has(t2.id)).map(t2 => {
    const due = new Date(t2.due_date);
    if (Number.isNaN(due.getTime())) return null;
    const diff = (due - now) / 3600000;
    if (whiteLabelSettings?.automation_overdue_escalation && diff < -escalationHours) return { ...t2, urgency: "Escalated", urgencyColor: "#B91C1C" };
    if (diff < 0) return { ...t2, urgency: "Overdue", urgencyColor: "#EF4444" };
    if (diff < 24) return { ...t2, urgency: "Due today", urgencyColor: "#EF4444" };
    if (diff < 48) return { ...t2, urgency: "Due tomorrow", urgencyColor: "#F59E0B" };
    if (diff <= deadlineWindow) return { ...t2, urgency: "Due soon", urgencyColor: "#3B82F6" };
    return null;
  }).filter(Boolean);

  const blockedNotifs = whiteLabelSettings?.automation_blocked_alerts === false ? [] : tasks
    .filter(t2 => t2.status !== "Done" && !dismissed.has(`blocked-${t2.id}`))
    .filter(t2 => (t2.blocked_by || []).some(depId => taskById[depId]?.status !== "Done"))
    .slice(0, 8)
    .map(t2 => ({ ...t2, id: `blocked-${t2.id}`, task_id: t2.id, urgency: "Blocked", urgencyColor: "#F59E0B" }));

  const mentionTag = currentUser ? `@[${currentUser.name}]` : null;

  const mentionNotifs = useMemo(() => {
    if (!mentionTag) return [];
    if (whiteLabelSettings?.notify_mentions === false) return [];
    return (comments || [])
      .filter(c => c.body?.includes(mentionTag) && c.user_id !== currentUser.id && !dismissed.has(c.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);
  }, [comments, mentionTag, currentUser, dismissed, whiteLabelSettings?.notify_mentions]);

  const commentNotifs = useMemo(() =>
    whiteLabelSettings?.notify_comments === false ? [] : (comments || [])
      .filter(c =>
        c.entity_type === "project" &&
        !dismissed.has(c.id) &&
        (!currentUser || c.user_id !== currentUser.id) &&
        !c.body?.includes(mentionTag)
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8),
    [comments, dismissed, currentUser, mentionTag, whiteLabelSettings?.notify_comments]
  );

  const totalCount = urgent.length + blockedNotifs.length + mentionNotifs.length + commentNotifs.length;

  const dismiss = (id) => {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    localStorage.setItem("af_dismissed", JSON.stringify([...next]));
  };
  const dismissAll = () => {
    const next = new Set([...dismissed, ...urgent.map(x => x.id), ...blockedNotifs.map(x => x.id), ...commentNotifs.map(c => c.id), ...mentionNotifs.map(c => c.id)]);
    setDismissed(next);
    localStorage.setItem("af_dismissed", JSON.stringify([...next]));
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", position: "relative", padding: 4 }}>
        <span style={{ fontSize: 20 }}>🔔</span>
        {totalCount > 0 && (
          <span style={{ position: "absolute", top: -2, right: -2, background: "#EF4444", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 99, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 40, width: 360, background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, boxShadow: t.shadow, zIndex: 1000 }}>
          <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${t.border2}` }}>
            <span style={{ fontWeight: 700, color: t.text, fontSize: 14 }}>Notifications</span>
            {totalCount > 0 && <button onClick={dismissAll} style={{ background: "none", border: "none", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Clear all</button>}
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>

            {/* Mention notifications */}
            {mentionNotifs.length > 0 && (
              <>
                <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: t.textGhost, letterSpacing: "0.07em", textTransform: "uppercase" }}>@ Mentions</div>
                {mentionNotifs.map(c => {
                  const proj = c.entity_type === "project" ? projectById[c.entity_id] : null;
                  const task = c.entity_type === "task" ? taskById[c.entity_id] : null;
                  const previewBody = c.body.replace(/@\[([^\]]+)\]/g, "@$1");
                  return (
                    <div key={c.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${t.divider}`, display: "flex", gap: 10, alignItems: "flex-start", background: `${t.accent}08` }}>
                      <Avatar name={c.user_name || "?"} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
                          <span style={{ color: t.accent }}>@you</span> · {c.user_name}
                        </div>
                        {proj && (
                          <div
                            onClick={() => { nav("project-detail", proj.id); setOpen(false); dismiss(c.id); }}
                            style={{ fontSize: 11, color: t.accent, fontWeight: 600, cursor: "pointer", marginBottom: 2 }}
                          >↗ {proj.title}</div>
                        )}
                        {task && (
                          <div
                            onClick={() => { nav("tasks"); setOpen(false); dismiss(c.id); }}
                            style={{ fontSize: 11, color: t.accent, fontWeight: 600, cursor: "pointer", marginBottom: 2 }}
                          >✓ {task.title}</div>
                        )}
                        <div style={{ fontSize: 12, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{previewBody}</div>
                        <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>{timeAgo(c.created_at)}</div>
                      </div>
                      <button onClick={() => dismiss(c.id)} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>
                    </div>
                  );
                })}
              </>
            )}

            {/* Project comments from teammates */}
            {commentNotifs.length > 0 && (
              <>
                <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: t.textGhost, letterSpacing: "0.07em", textTransform: "uppercase" }}>💬 Project Comments</div>
                {commentNotifs.map(c => {
                  const proj = projectById[c.entity_id];
                  return (
                    <div key={c.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${t.divider}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Avatar name={c.user_name || "?"} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>{c.user_name}</div>
                        {proj && (
                          <div
                            onClick={() => { nav("project-detail", proj.id); setOpen(false); dismiss(c.id); }}
                            style={{ fontSize: 11, color: t.accent, fontWeight: 600, cursor: "pointer", marginBottom: 2 }}
                          >↗ {proj.title}</div>
                        )}
                        <div style={{ fontSize: 12, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.body}</div>
                        <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>{timeAgo(c.created_at)}</div>
                      </div>
                      <button onClick={() => dismiss(c.id)} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>
                    </div>
                  );
                })}
              </>
            )}

            {/* Blocked task alerts */}
            {blockedNotifs.length > 0 && (
              <>
                <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: t.textGhost, letterSpacing: "0.07em", textTransform: "uppercase" }}>Blocked Tasks</div>
                {blockedNotifs.map(x => (
                  <div key={x.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${t.divider}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 2 }}>{x.title}</div>
                      <div style={{ fontSize: 11, color: t.textFaint }}>Waiting on {x.blocked_by?.length || 0} task{x.blocked_by?.length === 1 ? "" : "s"}</div>
                      <Badge label={x.urgency} color={x.urgencyColor} />
                    </div>
                    <button onClick={() => dismiss(x.id)} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                ))}
              </>
            )}

            {/* Task deadline reminders */}
            {urgent.length > 0 && (
              <>
                <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: t.textGhost, letterSpacing: "0.07em", textTransform: "uppercase" }}>⏰ Deadlines</div>
                {urgent.map(x => (
                  <div key={x.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${t.divider}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 2 }}>{x.title}</div>
                      <div style={{ fontSize: 11, color: t.textFaint }}>{fmtDate(x.due_date)} · {x.assigned_to?.name}</div>
                      <Badge label={x.urgency} color={x.urgencyColor} />
                    </div>
                    <button onClick={() => dismiss(x.id)} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                ))}
              </>
            )}

            {totalCount === 0 && (
              <div style={{ padding: 28, textAlign: "center", color: t.textFaint, fontSize: 13 }}>All caught up 🎉</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
})

// ─── MODAL ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 560 }) {
  const { theme: t } = useTheme();
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 16, width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto", boxShadow: t.shadow }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${t.border2}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: t.text, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: t.textMuted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "20px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

export function FormField({ label, children }) {
  const { theme: t } = useTheme();
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = "Delete", danger = true }) {
  const { theme: t } = useTheme();

  // Escape key closes
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      style={{ position:"fixed", inset:0, background:"#00000088", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
      onClick={onClose}
    >
      <div
        style={{ background:t.card, border:`1px solid ${t.border2}`, borderRadius:16, width:"100%", maxWidth:420, boxShadow:t.shadow, overflow:"hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding:"20px 24px 0", display:"flex", alignItems:"flex-start", gap:14 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:"#EF444422", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18 }}>
            🗑️
          </div>
          <div>
            <h3 style={{ margin:"0 0 6px", fontSize:17, fontWeight:700, color:t.text }}>{title}</h3>
            <p style={{ margin:0, fontSize:13, color:t.textMuted, lineHeight:1.5 }}>{message}</p>
          </div>
        </div>
        {/* Footer */}
        <div style={{ padding:"20px 24px", display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button
            onClick={onClose}
            style={{ background:t.toggleBg, color:t.textSub, border:`1px solid ${t.border2}`, borderRadius:8, padding:"9px 20px", fontWeight:600, fontSize:14, cursor:"pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            style={{ background: danger ? "#EF4444" : "#7C3AED", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontWeight:700, fontSize:14, cursor:"pointer" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COMMENTS PANEL ──────────────────────────────────────────────────────────
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString();
};

export function CommentsPanel({ entityType, entityId, comments, setComments, currentUser, users }) {
  const { theme: t } = useTheme();
  const [body, setBody] = useState("");
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionAnchorPos, setMentionAnchorPos] = useState(0);
  const [mentionIdx, setMentionIdx] = useState(0);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const entityComments = useMemo(() =>
    [...comments]
      .filter(c => c.entity_type === entityType && c.entity_id === entityId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [comments, entityType, entityId]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entityComments.length]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null || !users?.length) return [];
    const q = mentionQuery.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, users]);

  const handleChange = (e) => {
    const val = e.target.value;
    setBody(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/(^|[\s\n])@(\w*)$/);
    if (match) {
      setMentionQuery(match[2]);
      setMentionAnchorPos(textBefore.lastIndexOf("@"));
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (user) => {
    const before = body.slice(0, mentionAnchorPos);
    const after = body.slice(mentionAnchorPos + 1 + (mentionQuery?.length || 0));
    const newBody = `${before}@[${user.name}] ${after}`;
    setBody(newBody);
    setMentionQuery(null);
    setTimeout(() => {
      const pos = (before + `@[${user.name}] `).length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => (i + 1) % mentionSuggestions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionSuggestions[mentionIdx]); return; }
      if (e.key === "Escape") { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
  };

  const renderBody = (text) => {
    const parts = text.split(/(@\[[^\]]+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("@[") && part.endsWith("]")) {
        return <span key={i} style={{ color: t.accent, fontWeight: 700 }}>@{part.slice(2, -1)}</span>;
      }
      return part;
    });
  };

  const submit = () => {
    const text = body.trim();
    if (!text || !currentUser) return;
    setComments([...comments, {
      id: (crypto.randomUUID?.() ?? `c${Date.now()}`),
      entity_type: entityType,
      entity_id: entityId,
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_email: currentUser.email,
      body: text,
      created_at: new Date().toISOString(),
    }]);
    setBody("");
  };

  return (
    <div>
      <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
        {entityComments.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: t.textFaint, fontSize: 13 }}>
            No comments yet. Be the first to add one.
          </div>
        ) : entityComments.map(c => (
          <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
            <Avatar name={c.user_name || "?"} size={28} />
            <div style={{ flex: 1, background: t.statBg, borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>{c.user_name}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: t.textFaint }}>{timeAgo(c.created_at)}</span>
                  {currentUser && c.user_id === currentUser.id && (
                    <button
                      onClick={() => setComments(comments.filter(x => x.id !== c.id))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: t.textGhost, fontSize: 15, lineHeight: 1, padding: 0 }}
                      title="Delete"
                    >×</button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{renderBody(c.body)}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ position: "relative" }}>
        {mentionSuggestions.length > 0 && (
          <div style={{ position: "absolute", bottom: "100%", left: 0, right: 44, marginBottom: 4, background: t.card, border: `1px solid ${t.border2}`, borderRadius: 10, overflow: "hidden", zIndex: 50, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
            {mentionSuggestions.map((u, i) => (
              <button
                key={u.id}
                onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: i === mentionIdx ? t.navActive : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <Avatar name={u.name} size={22} />
                <span style={{ fontSize: 13, fontWeight: 600, color: i === mentionIdx ? t.navActiveText : t.textSub }}>{u.name}</span>
                {u.job_title && <span style={{ fontSize: 11, color: t.textFaint, marginLeft: "auto" }}>{u.job_title}</span>}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={currentUser ? "Write a comment… (@ to mention, Ctrl+Enter to send)" : "Sign in to comment"}
            disabled={!currentUser}
            rows={2}
            style={{ flex: 1, background: t.input, border: `1px solid ${t.border2}`, borderRadius: 8, color: t.text, fontSize: 13, padding: "8px 12px", resize: "none", fontFamily: "inherit", outline: "none" }}
          />
          <button
            onClick={submit}
            disabled={!body.trim() || !currentUser}
            style={{ background: "#7C3AED", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !body.trim() || !currentUser ? 0.5 : 1 }}
          >Post</button>
        </div>
      </div>
    </div>
  );
}

// ─── TASK STATUS ──────────────────────────────────────────────────────────────
const TASK_STATUSES = ["To Do", "In Progress", "In Review", "Done"];
// Advance to the next status in the workflow, wrapping Done → To Do
const nextTaskStatus = (current) => {
  const idx = TASK_STATUSES.indexOf(current);
  return TASK_STATUSES[(idx + 1) % TASK_STATUSES.length];
};

// Visual fills for each status inside the circle button
const statusCircleStyle = (status) => ({
  "To Do":       { bg: "transparent",  icon: "",  border: "#888" },
  "In Progress": { bg: "#3B82F644",    icon: "›", border: "#3B82F6" },
  "In Review":   { bg: "#F59E0B44",    icon: "…", border: "#F59E0B" },
  "Done":        { bg: "#059669",      icon: "✓", border: "#059669" },
}[status] || { bg: "transparent", icon: "", border: "#888" });

export function TaskStatusButton({ task, onStatusChange }) {
  const { theme: t } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  const circle = statusCircleStyle(task.status);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleClick = (e) => {
    e.stopPropagation();
    onStatusChange(task.id, nextTaskStatus(task.status));
  };
  const handleRightClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(v => !v);
  };
  const handleMenuPick = (e, s) => {
    e.stopPropagation();
    onStatusChange(task.id, s);
    setMenuOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={handleClick}
        onContextMenu={handleRightClick}
        title={`${task.status} — click to advance, right-click to set`}
        style={{
          width: 22, height: 22, borderRadius: "50%",
          border: `2px solid ${circle.border}`,
          background: circle.bg,
          cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: task.status === "Done" ? "#fff" : circle.border,
          fontSize: task.status === "In Review" ? 14 : 12,
          fontWeight: 700, transition: "all 0.15s", lineHeight: 1,
        }}
      >
        {circle.icon}
      </button>
      {menuOpen && (
        <div style={{
          position: "absolute", left: 28, top: -4, zIndex: 3000,
          background: t.card, border: `1px solid ${t.border2}`,
          borderRadius: 10, boxShadow: t.shadow, padding: 4, minWidth: 140,
        }}>
          {TASK_STATUSES.map(s => {
            const sc = statusCircleStyle(s);
            const active = task.status === s;
            return (
              <button key={s} onClick={(e) => handleMenuPick(e, s)} style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "7px 10px", border: "none",
                borderRadius: 7, cursor: "pointer", textAlign: "left",
                background: active ? t.navActive : "transparent",
                color: active ? t.navActiveText : t.textSub, fontSize: 13,
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${sc.border}`, background: sc.bg,
                  display: "inline-block",
                }} />
                {s}
                {active && <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.7 }}>current</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
