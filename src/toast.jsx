import { createContext, useContext } from "react";
import { useTheme } from "./theme.js";

// ─── TOAST ────────────────────────────────────────────────────────────────────
export const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const TOAST_ICONS = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };
const TOAST_COLORS = { success: "#059669", error: "#EF4444", warning: "#F59E0B", info: "#3B82F6" };

export function ToastContainer({ toasts, onDismiss }) {
  const { theme: t } = useTheme();
  if (!toasts.length) return null;
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column-reverse", gap:10, pointerEvents:"none" }}>
      {toasts.map(toast => {
        const color = TOAST_COLORS[toast.type] || TOAST_COLORS.info;
        const icon  = TOAST_ICONS[toast.type]  || TOAST_ICONS.info;
        return (
          <div key={toast.id} style={{
            display:"flex", alignItems:"flex-start", gap:10,
            background: t.card, border:`1px solid ${color}44`,
            borderLeft:`3px solid ${color}`,
            borderRadius:10, padding:"11px 14px",
            boxShadow: t.shadow, minWidth:260, maxWidth:360,
            pointerEvents:"all",
            animation:"toastIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <span style={{ width:20, height:20, borderRadius:"50%", background:color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0, marginTop:1 }}>{icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:t.text, lineHeight:1.3 }}>{toast.message}</div>
              {toast.sub && <div style={{ fontSize:11, color:t.textMuted, marginTop:2 }}>{toast.sub}</div>}
            </div>
            <button onClick={() => onDismiss(toast.id)} style={{ background:"none", border:"none", color:t.textFaint, cursor:"pointer", fontSize:16, lineHeight:1, padding:0, flexShrink:0 }}>×</button>
          </div>
        );
      })}
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(12px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
    </div>
  );
}
