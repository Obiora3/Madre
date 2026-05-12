// ─── HELPERS ──────────────────────────────────────────────────────────────────
export const initials = (name) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) : "?";
export const fmtDate = (d) => { if (!d) return "—"; const dt = new Date(d); return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
export const priorityColor = (p) => ({ Critical: "#EF4444", High: "#F97316", Medium: "#3B82F6", Low: "#6B7280" }[p] || "#6B7280");
export const statusColor = (s) => ({ Active: "#059669", "On Hold": "#F59E0B", Completed: "#3B82F6", Archived: "#6B7280", "To Do": "#6B7280", "In Progress": "#3B82F6", "In Review": "#F59E0B", Done: "#059669", "On Track": "#059669", "At Risk": "#F59E0B", Behind: "#EF4444", Achieved: "#8B5CF6", "Not Started": "#6B7280", Won: "#059669", Lost: "#EF4444" }[s] || "#6B7280");
export const stageColor = (s) => ({ Brief: "#8B5CF6", Strategy: "#3B82F6", Creative: "#F97316", Review: "#F59E0B", Delivered: "#059669" }[s] || "#6B7280");
export const avatarBg = (name) => { const colors = ["#7C3AED","#0891B2","#059669","#DC2626","#D97706","#DB2777"]; const idx = name ? name.charCodeAt(0) % colors.length : 0; return colors[idx]; };
