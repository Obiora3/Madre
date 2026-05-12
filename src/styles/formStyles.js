// Each helper caches its result by theme mode so the returned object is the same
// reference on every render — no wasted React bailout checks in children.
const _styleCache = {};
const _cached = (key, mode, factory) => {
  const k = `${key}:${mode}`;
  if (!_styleCache[k]) _styleCache[k] = factory();
  return _styleCache[k];
};

export const mkInputStyle = (t) => _cached("input", t.mode, () => ({
  width: "100%", background: t.input, border: `1px solid ${t.inputBorder}`,
  borderRadius: 8, padding: "10px 12px", color: t.textSub,
  fontSize: 14, outline: "none", boxSizing: "border-box",
}));
export const mkSelectStyle = (t) => _cached("select", t.mode, () => ({
  ...mkInputStyle(t), cursor: "pointer",
}));
export const mkBtnSecondary = (t) => _cached("btnSec", t.mode, () => ({
  background: t.toggleBg, color: t.textSub, border: `1px solid ${t.border2}`,
  borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer",
}));
export const btnPrimary = { background: "#7C3AED", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", letterSpacing: "0.02em" };
