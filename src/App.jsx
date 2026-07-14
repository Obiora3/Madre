import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppContext } from "./context/app-context.jsx";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { useAppData } from "./hooks/useAppData.js";
import { useAuth } from "./hooks/useAuth.js";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { useNotifications } from "./hooks/useNotifications.js";
import { useOperationalAutomations } from "./hooks/useOperationalAutomations.js";
import { useWhiteLabelSettings } from "./hooks/useWhiteLabelSettings.js";
import { DARK, LIGHT, ThemeContext } from "./theme.js";
import { ToastContainer, ToastContext } from "./toast.jsx";
import { Avatar, NotificationBell, ThemeToggle } from "./components/common.jsx";
import { GlobalSearch, PageRouter } from "./pages/index.jsx";
import "./app.css";

// ─── BREADCRUMBS ──────────────────────────────────────────────────────────────
const PAGE_LABELS = {
  dashboard:"Dashboard", projects:"Projects", tasks:"Tasks", team:"Team",
  clients:"Clients", kpis:"KPIs", timeline:"Timeline", reports:"Reports",
  "ai-brief":"AI Brief", profitability:"Profitability", pitches:"Pitch Pipeline",
  benchmarking:"Benchmarking", departments:"Departments",
  "delivery-scores":"Delivery Scores", "settings":"Settings", drive:"Drive", profile:"Profile",
};

function Breadcrumbs({ page, pageParam, projects, nav, theme: t }) {
  if (page === "project-detail" && pageParam) {
    const proj = projects.find(p => p.id === pageParam);
    return (
      <nav style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, marginLeft:12 }}>
        <button
          onClick={() => nav("projects")}
          style={{ background:"none", border:"none", cursor:"pointer", color:t.textMuted, fontSize:13, padding:0, fontWeight:500, lineHeight:1 }}
        >
          Projects
        </button>
        <span style={{ color:t.textGhost, fontSize:14, lineHeight:1 }}>›</span>
        <span style={{ color:t.textSub, fontWeight:700, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {proj?.title || "Project"}
        </span>
      </nav>
    );
  }
  const label = PAGE_LABELS[page];
  if (!label) return null;
  return (
    <span style={{ fontSize:13, fontWeight:600, color:t.textSub, marginLeft:12 }}>{label}</span>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function Madre() {
  const isMobile = useIsMobile();
  const [darkMode, setDarkMode] = useLocalStorage("af_dark_mode", false);
  const toggleTheme = () => setDarkMode(d => !d);
  const {
    settings: whiteLabelSettings,
    setSettings: setWhiteLabelSettings,
    resetSettings: resetWhiteLabelSettings
  } = useWhiteLabelSettings();
  const baseTheme = darkMode ? DARK : LIGHT;
  const theme = useMemo(() => ({
    ...baseTheme,
    accent: whiteLabelSettings.primary_colour,
    accentLight: whiteLabelSettings.accent_colour,
    navActive: `${whiteLabelSettings.primary_colour}22`,
    navActiveText: whiteLabelSettings.accent_colour,
    aiText: whiteLabelSettings.accent_colour
  }), [baseTheme, whiteLabelSettings]);

  // ── Toast ────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const toastCounter = useRef(0);
  const addToast = useCallback(({ message, sub, type = "success" }) => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev.slice(-4), { id, message, sub, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  const dismissToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── Navigation & UI state ────────────────────────────────────────────────
  const [page, setPage]               = useState("dashboard");
  const [pageParam, setPageParam]     = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const contentRef = useRef(null);

  // ── Auth must come before data so agency_id is available ────────────────
  const auth = useAuth();

  // ── App state — uses Supabase when agency is active, localStorage otherwise
  const {
    projects, setProjects, tasks, setTasks, clients, setClients,
    kpis, setKpis, departments, setDepartments, pitches, setPitches,
    comments, setComments,
    users, events, logActivity, updateMemberRole,
    resetAllData, loading: dataLoading,
  } = useAppData(auth.currentUser?.agency_id);

  const nav = useCallback((p, param = null) => {
    setPage(p);
    setPageParam(param);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Reset scroll to top synchronously before paint on every page navigation
  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [page, pageParam]);

  // Show a toast whenever a Supabase sync write fails
  useEffect(() => {
    const handler = (e) => addToast({ message: `Save failed: ${e.detail}`, type: "error" });
    window.addEventListener("af-sync-error", handler);
    return () => window.removeEventListener("af-sync-error", handler);
  }, [addToast]);
  const currentUser = useMemo(() => {
    if (!auth.currentUser) return null;
    const profile = users.find(u => u.email === auth.currentUser.email || u.id === auth.currentUser.id);
    if (!profile) return auth.currentUser;
    return {
      ...auth.currentUser,
      ...profile,
      agency_id: auth.currentUser.agency_id,
      agency_code: auth.currentUser.agency_code,
      agency_name: auth.currentUser.agency_name,
    };
  }, [auth.currentUser, users]);

  // appUsers must be declared before useOperationalAutomations so the
  // minifier doesn't hit a TDZ when it references this value.
  const appUsers = useMemo(() => {
    if (!currentUser) return users;
    const found = users.some(u => u.email === currentUser.email);
    const merged = users.map(u => u.email === currentUser.email ? { ...u, ...currentUser } : u);
    return found ? merged : [currentUser, ...users];
  }, [currentUser, users]);

  useOperationalAutomations({
    tasks,
    projects,
    currentUser,
    settings: whiteLabelSettings,
    logActivity,
    toast: addToast,
    users: appUsers,
  });

  const {
    notifications,
    unreadCount: unreadNotifCount,
    markRead:    markNotifRead,
    markAllRead: markAllNotifsRead,
    dismiss:     dismissNotif,
    dismissAll:  dismissAllNotifs,
  } = useNotifications(currentUser);
  const t = theme;
  const st = whiteLabelSettings.dark_sidebar ? {
    ...DARK,
    accent: whiteLabelSettings.primary_colour,
    accentLight: whiteLabelSettings.accent_colour,
    navActive: `${whiteLabelSettings.primary_colour}22`,
    navActiveText: whiteLabelSettings.accent_colour
  } : t;

  const appValue = useMemo(() => ({
    projects, setProjects, tasks, setTasks, clients, setClients,
    kpis, setKpis, departments, setDepartments, pitches, setPitches,
    comments, setComments,
    users: appUsers, currentUser, signOut: auth.signOut, updateProfile: auth.updateProfile,
    setupAgency: auth.setupAgency, nav, page, pageParam, resetAllData,
    events, logActivity, updateMemberRole,
    whiteLabelSettings, setWhiteLabelSettings, resetWhiteLabelSettings,
    notifications, unreadNotifCount, markNotifRead, markAllNotifsRead, dismissNotif, dismissAllNotifs,
    isMobile,
  }), [
    projects, tasks, clients, kpis, departments, pitches, comments, appUsers, currentUser,
    auth.signOut, auth.updateProfile, auth.setupAgency, nav, page, pageParam, resetAllData,
    events, logActivity, updateMemberRole,
    whiteLabelSettings, setWhiteLabelSettings, resetWhiteLabelSettings, setComments,
    notifications, unreadNotifCount, markNotifRead, markAllNotifsRead, dismissNotif, dismissAllNotifs,
    isMobile,
  ]);

  const navItems = [
    { id:"dashboard",    label:"Dashboard",  icon:"\u229e" },
    { id:"projects",     label:"Projects",   icon:"\ud83d\uddc2" },
    { id:"tasks",        label:"Tasks",      icon:"\u2713" },
    { id:"team",         label:"Team",       icon:"\ud83d\udc65" },
    { id:"clients",      label:"Clients",    icon:"\ud83e\udd1d" },
    { id:"kpis",         label:"KPIs",       icon:"\ud83d\udcca" },
    { id:"timeline",     label:"Timeline",   icon:"\ud83d\udcc5" },
    { id:"reports",      label:"Reports",    icon:"\ud83d\udcc8" },
    { id:"drive",        label:"Drive",      icon:"\ud83d\udcc2" },
  ];
  const canAccessSettings = ["owner", "admin"].includes((currentUser?.role || "").toLowerCase());
  const advancedItems = [
    { id:"profitability",    label:"Profitability",   icon:"\ud83d\udcb0" },
    { id:"pitches",          label:"Pitch Pipeline",  icon:"\ud83c\udfaf" },
    { id:"departments",      label:"Departments",     icon:"\ud83c\udfe2" },
    { id:"delivery-scores",  label:"Delivery Scores", icon:"\u2b50" },
    canAccessSettings ? { id:"settings", label:"Settings", icon:"\u2699\ufe0f" } : null,
  ].filter(Boolean);

  const activeId = page === "project-detail" ? "projects" : page;
  const headerHeight = 72;
  const contentCurve = 28;
  const shellBg = t.surface;

  return (
    <ThemeContext.Provider value={{ theme, toggle: toggleTheme }}>
      <ToastContext.Provider value={addToast}>
        {!currentUser ? (
          <>
            <AuthScreen
              brand={whiteLabelSettings}
              onSignIn={auth.signIn}
              onSignUp={auth.signUp}
            />
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
          </>
        ) : (
        <AppContext.Provider value={appValue}>
          <div style={{ display:"flex", height:"100vh", background:shellBg, fontFamily:"\'DM Sans\', \'Outfit\', system-ui, sans-serif", color:t.textSub, overflow:"hidden", transition:"background 0.3s ease, color 0.3s ease" }}>

            {/* Mobile sidebar backdrop */}
            {isMobile && sidebarOpen && (
              <div onClick={() => setSidebarOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:190, backdropFilter:"blur(2px)" }} />
            )}

            {/* Sidebar */}
            <div style={isMobile ? {
              position:"fixed", top:0, left:0, height:"100vh", width:260,
              transform: sidebarOpen ? "translateX(0)" : "translateX(-270px)",
              zIndex:200, transition:"transform 0.25s ease, background 0.3s ease",
              background:st.surface, display:"flex", flexDirection:"column", overflow:"hidden",
              boxShadow: sidebarOpen ? "4px 0 24px rgba(0,0,0,0.18)" : "none",
            } : {
              width: sidebarOpen ? 220 : 0, minWidth: sidebarOpen ? 220 : 0,
              background:st.surface, display:"flex", flexDirection:"column", overflow:"hidden",
              transition:"width 0.25s ease, min-width 0.25s ease, background 0.3s ease", flexShrink:0,
            }}>
              <div style={{ height:headerHeight, boxSizing:"border-box", padding:"0 16px", display:"flex", alignItems:"center" }}>
                <img src="/logo.png" alt="logo" style={{ width:70, height:70, objectFit:"contain" }} />
              </div>
              <div style={{ height:1, background:st.border, margin:"0 16px" }} />
              <div className="app-sidebar-scroll" style={{ flex:1, overflowY:"auto", padding:"14px 12px 10px" }}>
                <div style={{ marginBottom:8 }}>
                  {navItems.map(item => (
                    <button key={item.id} onClick={() => nav(item.id)} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 10px", borderRadius:8, border:"none", cursor:"pointer", background:activeId===item.id?st.navActive:"transparent", color:activeId===item.id?st.navActiveText:st.navText, fontWeight:activeId===item.id?700:400, fontSize:13, textAlign:"left", marginBottom:1, transition:"background 0.15s, color 0.15s" }}>
                      <span style={{ fontSize:16 }}>{item.icon}</span>{item.label}
                    </button>
                  ))}
                </div>
                <div style={{ height:1, background:st.border, margin:"10px 8px 10px" }} />
                <div style={{ fontSize:10, fontWeight:700, color:st.textGhost, padding:"0 10px 6px", letterSpacing:"0.08em" }}>ADVANCED</div>
                {advancedItems.map(item => (
                  <button key={item.id} onClick={() => nav(item.id)} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 10px", borderRadius:8, border:"none", cursor:"pointer", background:activeId===item.id?st.navActive:"transparent", color:activeId===item.id?st.navActiveText:st.navText, fontWeight:activeId===item.id?700:400, fontSize:13, textAlign:"left", marginBottom:1, transition:"background 0.15s, color 0.15s" }}>
                    <span style={{ fontSize:15 }}>{item.icon}</span>
                    <span style={{ flex:1 }}>{item.label}</span>
                    {item.badge && <span style={{ fontSize:9, background:st.accent, color:"#fff", borderRadius:4, padding:"1px 5px", fontWeight:800 }}>{item.badge}</span>}
                  </button>
                ))}
              </div>
              <div style={{ padding:"12px 16px", borderTop:`1px solid ${st.border}` }}>
                <button onClick={() => nav("profile")} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", background:"transparent", border:"none", cursor:"pointer", padding:"4px 0", borderRadius:8, textAlign:"left" }}>
                  <Avatar name={currentUser.name} size={32} />
                  <div style={{ overflow:"hidden", flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:st.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{currentUser.name}</div>
                    <div style={{ fontSize:10, color:st.textFaint }}>{currentUser.role}</div>
                  </div>
                  <span style={{ fontSize:11, color:st.textGhost }}>✏</span>
                </button>
                <button onClick={auth.signOut} style={{ width:"100%", marginTop:10, background:"transparent", border:`1px solid ${st.border2}`, color:st.textMuted, borderRadius:7, padding:"7px 10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Sign Out</button>
                {!whiteLabelSettings.hide_attribution && (
                  <div style={{ fontSize:10, color:st.textGhost, marginTop:10 }}>Powered by Madre</div>
                )}
              </div>
            </div>

            {/* Main */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:shellBg }}>
              {/* Topbar */}
              <div style={{ height:headerHeight, background:shellBg, display:"flex", alignItems:"center", padding:isMobile ? "0 12px" : "0 20px", flexShrink:0, gap:8, transition:"background 0.3s ease" }}>
                <div style={{ display:"flex", alignItems:"center", flex:isMobile ? 1 : "none" }}>
                  <button
                    aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
                    title={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
                    onClick={() => setSidebarOpen(o => !o)}
                    style={{ width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", background:"transparent", border:`1px solid ${t.border2}`, borderRadius:8, color:t.textMuted, cursor:"pointer", fontSize:18, padding:0, lineHeight:1, flexShrink:0 }}
                  >
                    {"\u2630"}
                  </button>
                  <Breadcrumbs page={page} pageParam={pageParam} projects={projects} nav={nav} theme={t} />
                </div>
                {!isMobile && <div style={{ flex:1, display:"flex", justifyContent:"center" }}><GlobalSearch /></div>}
                <div style={{ display:"flex", alignItems:"center", gap:isMobile ? 8 : 12, justifyContent:"flex-end", flexShrink:0 }}>
                  {!isMobile && <ThemeToggle />}
                  <NotificationBell />
                  <button onClick={() => nav("profile")} title="Edit profile" style={{ background:"none", border:"none", cursor:"pointer", padding:0, borderRadius:"50%" }}>
                    <Avatar name={currentUser.name} size={34} />
                  </button>
                </div>
              </div>
              {/* Content */}
              <div ref={contentRef} style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:isMobile ? "16px 14px 32px" : "28px 28px 40px", background:t.bg, borderTop:`1px solid ${t.border}`, borderLeft:(!isMobile && sidebarOpen) ? `1px solid ${t.border}` : "none", borderTopLeftRadius:(!isMobile && sidebarOpen) ? contentCurve : 0, transition:"background 0.3s ease, border-radius 0.25s ease, border-color 0.3s ease" }}>
                {dataLoading ? (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", gap:12, color:t.textMuted, fontSize:14 }}>
                    <div style={{ width:20, height:20, border:`2px solid ${t.border2}`, borderTopColor:t.accent, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
                    Loading agency data…
                  </div>
                ) : (
                  <PageRouter />
                )}
              </div>
            </div>

          </div>
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </AppContext.Provider>
        )}
      </ToastContext.Provider>
    </ThemeContext.Provider>
  );
}
