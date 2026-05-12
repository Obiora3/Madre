import React, { useEffect, useRef, useState } from "react";
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
  const { tasks } = useApp();
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

  const now = new Date();
  const urgent = tasks.filter(t2 => t2.status !== "Done" && !dismissed.has(t2.id)).map(t2 => {
    const due = new Date(t2.due_date);
    const diff = (due - now) / 3600000;
    if (diff < 0) return { ...t2, urgency: "Overdue", urgencyColor: "#EF4444" };
    if (diff < 24) return { ...t2, urgency: "Due today", urgencyColor: "#EF4444" };
    if (diff < 48) return { ...t2, urgency: "Due tomorrow", urgencyColor: "#F59E0B" };
    if (diff < 72) return { ...t2, urgency: "Due soon", urgencyColor: "#3B82F6" };
    return null;
  }).filter(Boolean);

  const dismiss = (id) => {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    localStorage.setItem("af_dismissed", JSON.stringify([...next]));
  };
  const dismissAll = () => {
    const next = new Set([...dismissed, ...urgent.map(x => x.id)]);
    setDismissed(next);
    localStorage.setItem("af_dismissed", JSON.stringify([...next]));
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", position: "relative", padding: 4 }}>
        <span style={{ fontSize: 20 }}>🔔</span>
        {urgent.length > 0 && (
          <span style={{ position: "absolute", top: -2, right: -2, background: "#EF4444", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 99, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
            {urgent.length > 9 ? "9+" : urgent.length}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 40, width: 340, background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, boxShadow: t.shadow, zIndex: 1000 }}>
          <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${t.border2}` }}>
            <span style={{ fontWeight: 700, color: t.text, fontSize: 14 }}>Deadline Reminders</span>
            {urgent.length > 0 && <button onClick={dismissAll} style={{ background: "none", border: "none", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Clear all</button>}
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {urgent.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: t.textFaint, fontSize: 13 }}>No upcoming deadlines 🎉</div>
            ) : urgent.map(x => (
              <div key={x.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${t.divider}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.textSub, marginBottom: 2 }}>{x.title}</div>
                  <div style={{ fontSize: 11, color: t.textFaint }}>{fmtDate(x.due_date)} · {x.assigned_to?.name}</div>
                  <Badge label={x.urgency} color={x.urgencyColor} />
                </div>
                <button onClick={() => dismiss(x.id)} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${t.border2}` }}>
            <span style={{ fontSize: 12, color: t.accent, cursor: "pointer", fontWeight: 600 }}>View all tasks →</span>
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
