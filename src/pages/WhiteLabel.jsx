import {
  React,
  useEffect,
  useMemo,
  useRef,
  useState,
  MOCK_ACTIVITIES,
  DEFAULT_WHITE_LABEL_SETTINGS,
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

export const WhiteLabel = React.memo(function WhiteLabel() {
  const {
    resetAllData,
    whiteLabelSettings,
    setWhiteLabelSettings,
    resetWhiteLabelSettings
  } = useApp();
  const { theme: t } = useTheme();
  const iS = mkInputStyle(t); const bs = mkBtnSecondary(t);
  const [settings, setSettings] = useState(whiteLabelSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(whiteLabelSettings);
  }, [whiteLabelSettings]);

  const save = () => {
    setWhiteLabelSettings(settings);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };
  const reset = () => {
    resetWhiteLabelSettings();
    setSettings(DEFAULT_WHITE_LABEL_SETTINGS);
  };
  return (
    <div>
      <h1 style={{ margin:"0 0 24px",fontSize:26,fontWeight:800,color:t.text }}>White-Label Settings</h1>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24 }}>
        <div>
          <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,padding:20,marginBottom:16 }}>
            <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:t.text }}>Identity</h3>
            <FormField label="Agency Name"><input style={iS} value={settings.agency_name} onChange={e=>setSettings({...settings,agency_name:e.target.value})} /></FormField>
            <FormField label="Tagline"><input style={iS} value={settings.tagline} onChange={e=>setSettings({...settings,tagline:e.target.value})} /></FormField>
          </div>
          <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,padding:20,marginBottom:16 }}>
            <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:t.text }}>Brand Colours</h3>
            <FormField label="Primary Colour">
              <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                <input type="color" style={{...iS,padding:4,height:40,width:80}} value={settings.primary_colour} onChange={e=>setSettings({...settings,primary_colour:e.target.value})} />
                <input style={iS} value={settings.primary_colour} onChange={e=>setSettings({...settings,primary_colour:e.target.value})} />
              </div>
            </FormField>
            <FormField label="Accent Colour">
              <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                <input type="color" style={{...iS,padding:4,height:40,width:80}} value={settings.accent_colour} onChange={e=>setSettings({...settings,accent_colour:e.target.value})} />
                <input style={iS} value={settings.accent_colour} onChange={e=>setSettings({...settings,accent_colour:e.target.value})} />
              </div>
            </FormField>
          </div>
          <div style={{ background:t.card,border:`1px solid ${t.border2}`,borderRadius:14,padding:20,marginBottom:20 }}>
            <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:t.text }}>Display</h3>
            {[["dark_sidebar","Dark Sidebar"],["hide_attribution",'Hide "Powered by AgencyFlow"']].map(([key,label])=>(
              <div key={key} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                <span style={{ fontSize:13,color:t.textSub }}>{label}</span>
                <button onClick={()=>setSettings({...settings,[key]:!settings[key]})} style={{ width:44,height:24,borderRadius:99,border:"none",cursor:"pointer",background:settings[key]?"#7C3AED":t.toggleBg,position:"relative",transition:"background 0.2s" }}>
                  <div style={{ width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:settings[key]?23:3,transition:"left 0.2s" }} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <button style={btnPrimary} onClick={save}>{saved?"✓ Saved!":"Save Settings"}</button>
            <button style={bs} onClick={reset}>Reset to Defaults</button>
          </div>
          <div style={{ marginTop:16, padding:"14px 16px", background:"#EF444411", border:"1px solid #EF444433", borderRadius:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#EF4444", marginBottom:6 }}>⚠ Danger Zone</div>
            <div style={{ fontSize:12, color:t.textMuted, marginBottom:10 }}>Wipe all projects, tasks, clients, KPIs, departments and pitches and restore factory demo data. This cannot be undone.</div>
            <button onClick={() => { if (window.confirm("Reset ALL app data to factory defaults? This cannot be undone.")) { resetAllData(); } }} style={{ background:"#EF4444", color:"#fff", border:"none", borderRadius:7, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>Reset All App Data</button>
          </div>
        </div>
        <div style={{ background:t.statBg,border:`1px solid ${t.border2}`,borderRadius:14,overflow:"hidden" }}>
          <div style={{ padding:"12px 16px",background:t.card,borderBottom:`1px solid ${t.border2}` }}>
            <span style={{ fontSize:12,fontWeight:700,color:t.textFaint,letterSpacing:"0.05em" }}>LIVE PREVIEW</span>
          </div>
          <div style={{ display:"flex",height:400 }}>
            <div style={{ width:180,background:settings.dark_sidebar?"#0f0f1a":"#F9F9FF",borderRight:`1px solid ${t.border}`,padding:16 }}>
              <div style={{ fontSize:16,fontWeight:800,color:settings.primary_colour,marginBottom:4 }}>{settings.agency_name}</div>
              <div style={{ fontSize:11,color:t.textFaint,marginBottom:20 }}>{settings.tagline}</div>
              {["Dashboard","Projects","Tasks","Team","Clients"].map(item=>(
                <div key={item} style={{ padding:"8px 10px",borderRadius:8,marginBottom:4,fontSize:12,color:item==="Dashboard"?settings.primary_colour:t.textFaint,background:item==="Dashboard"?settings.primary_colour+"22":"transparent",fontWeight:item==="Dashboard"?700:400 }}>{item}</div>
              ))}
            </div>
            <div style={{ flex:1,padding:16 }}>
              <div style={{ height:32,background:settings.primary_colour+"22",borderRadius:8,marginBottom:12,display:"flex",alignItems:"center",paddingLeft:10 }}>
                <span style={{ fontSize:11,color:settings.primary_colour,fontWeight:700 }}>Active Projects</span>
                <span style={{ marginLeft:"auto",marginRight:10,fontSize:16,fontWeight:800,color:settings.primary_colour }}>12</span>
              </div>
              <div style={{ height:32,background:t.toggleBg,borderRadius:8,marginBottom:12 }} />
              <div style={{ height:32,background:t.toggleBg,borderRadius:8,marginBottom:12,width:"70%" }} />
              <button style={{ background:settings.primary_colour,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer" }}>+ New Project</button>
              {!settings.hide_attribution && <div style={{ fontSize:10,color:t.textGhost,marginTop:40 }}>Powered by AgencyFlow</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
})
