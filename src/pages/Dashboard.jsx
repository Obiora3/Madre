import {
  React,
  useMemo,
  useApp,
  useTheme,
  fmtDate,
  priorityColor,
  stageColor,
  statusColor,
  Badge,
  ProgressBar,
  StatCard,
  mkBtnSecondary,
} from "./_shared.js";

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export const Dashboard = React.memo(function Dashboard() {
  const { projects, tasks, clients, kpis, nav } = useApp();
  const { theme: t } = useTheme();

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, []);

  // Stat card values — recompute only when source arrays change
  const { activeProjects, doneTasks, activeClients, kpiOnTrack, overdueTasks, highPriority } = useMemo(() => {
    const now = new Date();
    const activeProjects = projects.filter(p => p.status === "Active");
    return {
      activeProjects,
      doneTasks:     tasks.filter(t2 => t2.status === "Done"),
      activeClients: clients.filter(c => c.status === "Active"),
      kpiOnTrack:    kpis.filter(k => ["On Track", "Achieved"].includes(k.status)),
      overdueTasks:  tasks.filter(t2 => t2.status !== "Done" && new Date(t2.due_date) < now),
      highPriority:  activeProjects.filter(p => ["Critical", "High"].includes(p.priority)),
    };
  }, [projects, tasks, clients, kpis]);

  // Pipeline stage counts — recompute only when projects change
  const stageCounts = useMemo(() => {
    const stages = ["Brief", "Strategy", "Creative", "Review", "Delivered"];
    return stages.map(s => ({ stage: s, count: projects.filter(p => p.stage === s && p.status === "Active").length }));
  }, [projects]);

  // Real activity feed — includes creations AND edits (via updated_at from Supabase trigger)
  const recentActivity = useMemo(() => {
    const GAP = 15_000; // ms gap between created_at and updated_at to count as a real edit
    const entries = [];

    for (const p of projects) {
      entries.push({ id:`pc-${p.id}`, description:`Project "${p.title}" created`, user: p.assigned_to?.name || "Team", timestamp: p.created_at });
      if (p.updated_at && p.created_at && new Date(p.updated_at) - new Date(p.created_at) > GAP) {
        entries.push({ id:`pu-${p.id}`, description:`Project "${p.title}" moved to ${p.stage}`, user: p.assigned_to?.name || "Team", timestamp: p.updated_at });
      }
    }
    for (const t2 of tasks) {
      entries.push({ id:`tc-${t2.id}`, description:`Task "${t2.title}" added`, user: t2.assigned_to?.name || "Team", timestamp: t2.created_at });
      if (t2.updated_at && t2.created_at && new Date(t2.updated_at) - new Date(t2.created_at) > GAP) {
        const label = t2.status === "Done" ? `Task "${t2.title}" marked Done` : `Task "${t2.title}" → ${t2.status}`;
        entries.push({ id:`tu-${t2.id}`, description: label, user: t2.assigned_to?.name || "Team", timestamp: t2.updated_at });
      }
    }
    for (const c of clients) {
      entries.push({ id:`cc-${c.id}`, description:`Client "${c.name}" added`, user: "Team", timestamp: c.created_at });
    }

    return entries
      .filter(e => e.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
  }, [projects, tasks, clients]);

  const bs = mkBtnSecondary(t);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: t.text }}>Agency Overview</h1>
        <p style={{ margin: "4px 0 0", color: t.textFaint, fontSize: 14 }}>{todayLabel}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard icon="🚀" label="Active Projects" value={activeProjects.length} sub="across all clients" />
        <StatCard icon="✅" label="Tasks Completed" value={doneTasks.length} sub="total done" />
        <StatCard icon="👥" label="Active Clients" value={activeClients.length} sub="under management" />
        <StatCard icon="📊" label="KPIs On Track" value={`${kpiOnTrack.length}/${kpis.length}`} sub={`${Math.round((kpiOnTrack.length/Math.max(kpis.length,1))*100)}% on track`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <h3 style={{ margin: 0, color: t.text, fontSize: 15, fontWeight: 700 }}>Project Pipeline</h3>
            <button onClick={() => nav("projects")} style={{ ...bs, padding: "6px 14px", fontSize: 12 }}>View Board →</button>
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: t.textGhost }}>Active projects by stage — spot where work is bottlenecking</p>
          {stageCounts.map(({ stage, count }) => (
            <div key={stage} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 90, fontSize: 12, color: t.textMuted, fontWeight: 600 }}>{stage}</div>
              <ProgressBar value={count} max={Math.max(...stageCounts.map(s=>s.count),1)} color={stageColor(stage)} height={8} />
              <div style={{ width: 24, textAlign: "right", fontSize: 13, fontWeight: 700, color: t.text }}>{count}</div>
            </div>
          ))}
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", color: t.text, fontSize: 15, fontWeight: 700 }}>Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p style={{ color: t.textFaint, fontSize: 13, margin: 0 }}>No activity yet. Start by creating a project or adding a client.</p>
          ) : recentActivity.map(a => (
            <div key={a.id} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent, marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.4 }}>{a.description}</div>
                <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>{a.user} · {fmtDate(a.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: t.card, border: `1px solid #EF444433`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 14px", color: "#EF4444", fontSize: 15, fontWeight: 700 }}>⚠ Overdue Tasks ({overdueTasks.length})</h3>
          {overdueTasks.length === 0 ? <p style={{ color: t.textFaint, fontSize: 13, margin: 0 }}>No overdue tasks — great work!</p> : overdueTasks.map(t2 => (
            <div key={t2.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, padding: "8px 12px", background: "#EF444411", borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 13, color: t.textSub, fontWeight: 600 }}>{t2.title}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>Due {fmtDate(t2.due_date)}</div>
              </div>
              <Badge label={t2.priority} color={priorityColor(t2.priority)} />
            </div>
          ))}
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 14px", color: t.text, fontSize: 15, fontWeight: 700 }}>🔥 High Priority Projects</h3>
          {highPriority.length === 0 ? <p style={{ color: t.textFaint, fontSize: 13, margin: 0 }}>No critical or high priority projects.</p> : highPriority.map(p => (
            <div key={p.id} style={{ marginBottom: 10, padding: "10px 12px", background: t.statBg, borderRadius: 8, cursor: "pointer" }} onClick={() => nav("project-detail", p.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.textSub }}>{p.title}</span>
                <Badge label={p.priority} color={priorityColor(p.priority)} />
              </div>
              <ProgressBar value={p.progress} color={priorityColor(p.priority)} />
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>{p.progress}% complete · Due {fmtDate(p.due_date)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
})
