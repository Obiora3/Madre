import { createContext, useContext } from "react";

// ─── APP CONTEXT ──────────────────────────────────────────────────────────────
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
