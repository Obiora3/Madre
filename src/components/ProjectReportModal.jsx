import React from "react";
import { Badge, Modal, ProgressBar } from "./common.jsx";
import { priorityColor, statusColor } from "../lib/helpers.js";

const numberLabel = (value) => Number(value || 0).toLocaleString();

function SummaryCard({ label, value, sub, color, theme: t }) {
  return (
    <div style={{ background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:10, padding:14, minWidth:0 }}>
      <div style={{ fontSize:10, fontWeight:700, color:t.textGhost, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color:color || t.text, lineHeight:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</div>
      {sub && <div style={{ marginTop:5, fontSize:11, color:t.textFaint }}>{sub}</div>}
    </div>
  );
}

function TrajectoryPanel({ title, periods, theme: t }) {
  return (
    <div style={{ border:`1px solid ${t.border2}`, borderRadius:10, padding:14, minWidth:0 }}>
      <h3 style={{ margin:"0 0 10px", color:t.text, fontSize:13, fontWeight:800 }}>{title}</h3>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {periods.map(period => (
          <div key={`${title}-${period.label}`}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:10, marginBottom:5 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:800, color:t.textSub }}>{period.label}</div>
                <div style={{ fontSize:10, color:t.textFaint }}>{period.rangeLabel}</div>
              </div>
              <div style={{ textAlign:"right", fontSize:11, color:t.textMuted, flexShrink:0 }}>
                <strong style={{ color:t.text }}>{period.completedInPeriodCount}</strong> done
                <div>{period.completedDueCount}/{period.dueCount} due</div>
              </div>
            </div>
            <ProgressBar value={period.progressPercent} color={period.openDueCount ? "#F59E0B" : "#059669"} height={5} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StandupTaskList({ title, tasks, theme: t }) {
  return (
    <div style={{ border:`1px solid ${t.border2}`, borderRadius:10, padding:14, minWidth:0 }}>
      <h3 style={{ margin:"0 0 10px", color:t.text, fontSize:13, fontWeight:800 }}>{title}</h3>
      {tasks.length === 0 ? (
        <div style={{ color:t.textFaint, fontSize:12 }}>No tasks in this group.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          {tasks.map(task => (
            <div key={`${title}-${task.id}`} style={{ paddingBottom:9, borderBottom:`1px solid ${t.divider}` }}>
              <div style={{ fontSize:12, fontWeight:800, color:t.textSub, lineHeight:1.35 }}>{task.title}</div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:5, alignItems:"center" }}>
                <Badge label={task.status} color={statusColor(task.status)} />
                <span style={{ fontSize:11, color:t.textFaint }}>{task.assigneeName}</span>
                <span style={{ fontSize:11, color:t.textFaint }}>Due {task.dueDateLabel}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectReportModal({ open, onClose, report, onDownload, onPrint, theme: t }) {
  if (!report) return null;
  const { project, labels, stats, tasks, activities, standup } = report;
  const money = (value) => `${report.currencySymbol}${numberLabel(value)}`;
  const budgetSub = stats.budget > 0
    ? `${money(stats.budgetSpent)} spent of ${money(stats.budget)}${stats.budgetUsedPercent !== null ? ` (${stats.budgetUsedPercent}%)` : ""}`
    : "No project budget set";

  return (
    <Modal open={open} onClose={onClose} title="Project Detailed Report" width={980}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap", marginBottom:18 }}>
        <div style={{ minWidth:0 }}>
          <h2 style={{ margin:"0 0 4px", color:t.text, fontSize:20, fontWeight:800 }}>{project.title}</h2>
          <div style={{ color:t.textMuted, fontSize:13 }}>{labels.client} - generated {new Date(report.generatedAt).toLocaleString("en-GB", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={onPrint} style={{ background:t.toggleBg, color:t.textSub, border:`1px solid ${t.border2}`, borderRadius:8, padding:"8px 13px", fontWeight:700, fontSize:12, cursor:"pointer" }}>Print / PDF</button>
          <button onClick={onDownload} style={{ background:"#7C3AED", color:"#fff", border:"none", borderRadius:8, padding:"8px 13px", fontWeight:800, fontSize:12, cursor:"pointer" }}>Download Report</button>
        </div>
      </div>

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:18 }}>
        <Badge label={labels.stage} color={statusColor(labels.stage)} />
        <Badge label={labels.status} color={statusColor(labels.status)} />
        <Badge label={labels.priority} color={priorityColor(labels.priority)} />
        <Badge label={`Assigned: ${labels.assignedTo}`} color="#6B7280" />
      </div>

      <div style={{ background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:10, padding:14, marginBottom:18 }}>
        <div style={{ fontSize:13, color:t.textSub, lineHeight:1.7 }}>{report.summaryText}</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:12, marginBottom:18 }}>
        <SummaryCard label="Progress" value={`${stats.progress}%`} sub={`${stats.completedTasks}/${stats.totalTasks} tasks done`} color={t.accent} theme={t} />
        <SummaryCard label="Open Tasks" value={stats.activeTasks} sub={`${stats.overdueTasks} overdue`} theme={t} />
        <SummaryCard label="Blocked" value={stats.blockedTasks} sub="Dependency conflicts" color={stats.blockedTasks ? "#EF4444" : "#059669"} theme={t} />
        <SummaryCard label="Hours" value={`${stats.totalActualHours}h`} sub={`${stats.totalEstimatedHours}h estimated`} theme={t} />
        <SummaryCard label="Budget" value={stats.budget > 0 ? money(stats.budget) : "Not set"} sub={budgetSub} color={stats.budgetUsedPercent > 100 ? "#EF4444" : undefined} theme={t} />
      </div>

      <div style={{ marginBottom:22 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:t.textFaint, marginBottom:5 }}>
          <span>Overall progress</span>
          <span>{stats.progress}%</span>
        </div>
        <ProgressBar value={stats.progress} color={t.accent} height={7} />
      </div>

      <section style={{ marginBottom:22 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap", marginBottom:12 }}>
          <div>
            <h3 style={{ margin:"0 0 4px", color:t.text, fontSize:15, fontWeight:800 }}>Weekly Standup Overview</h3>
            <div style={{ fontSize:12, color:t.textFaint }}>Weekly and monthly project trajectory from task due dates, completions, blockers, and overdue work.</div>
          </div>
          <Badge label={standup.trajectoryLabel} color={standup.trajectoryLabel === "Needs attention" ? "#EF4444" : standup.trajectoryLabel === "In progress" ? "#F59E0B" : "#059669"} />
        </div>
        <div style={{ background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:10, padding:14, marginBottom:12 }}>
          <div style={{ fontSize:13, color:t.textSub, lineHeight:1.7 }}>{standup.headline}</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:12, marginBottom:14 }}>
          <SummaryCard label="Previous Week" value={standup.previousWeek.completedInPeriodCount} sub={`${standup.previousWeek.completedDueCount}/${standup.previousWeek.dueCount} due tasks done`} theme={t} />
          <SummaryCard label="This Week Done" value={standup.currentWeek.completedInPeriodCount} sub={`${standup.currentWeek.completedDueCount}/${standup.currentWeek.dueCount} due tasks done`} theme={t} />
          <SummaryCard label="Weekly Delta" value={`${standup.weeklyDelta >= 0 ? "+" : ""}${standup.weeklyDelta}`} sub="vs last week completions" color={standup.weeklyDelta < 0 ? "#EF4444" : "#059669"} theme={t} />
          <SummaryCard label="This Month" value={`${standup.currentMonth.progressPercent}%`} sub={`${standup.currentMonth.completedDueCount}/${standup.currentMonth.dueCount} due tasks done`} theme={t} />
          <SummaryCard label="Next Week Due" value={standup.nextWeek.dueCount} sub={`${standup.nextWeek.openDueCount} currently open`} theme={t} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:14, marginBottom:14 }}>
          <TrajectoryPanel title="Weekly Trajectory" periods={standup.weeklyTrajectory} theme={t} />
          <TrajectoryPanel title="Monthly Trajectory" periods={standup.monthlyTrajectory} theme={t} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:14 }}>
          <StandupTaskList title="Previous Week" tasks={standup.previousWeekTasks} theme={t} />
          <StandupTaskList title="This Week Focus" tasks={standup.thisWeekTasks} theme={t} />
          <StandupTaskList title="Next Week" tasks={standup.nextWeekTasks} theme={t} />
          <StandupTaskList title="At Risk" tasks={standup.atRiskTasks} theme={t} />
        </div>
      </section>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:14, marginBottom:22 }}>
        <div style={{ border:`1px solid ${t.border2}`, borderRadius:10, padding:14 }}>
          <h3 style={{ margin:"0 0 10px", color:t.text, fontSize:13, fontWeight:800 }}>Task Status Summary</h3>
          {report.statusSummary.length ? report.statusSummary.map(item => (
            <div key={item.label} style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:8, color:t.textMuted, fontSize:12 }}>
              <span>{item.label}</span>
              <strong style={{ color:t.text }}>{item.count}</strong>
            </div>
          )) : <div style={{ color:t.textFaint, fontSize:12 }}>No tasks yet.</div>}
        </div>
        <div style={{ border:`1px solid ${t.border2}`, borderRadius:10, padding:14 }}>
          <h3 style={{ margin:"0 0 10px", color:t.text, fontSize:13, fontWeight:800 }}>Assigned Task Summary</h3>
          {report.assigneeSummary.length ? report.assigneeSummary.map(item => (
            <div key={item.label} style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:8, color:t.textMuted, fontSize:12 }}>
              <span>{item.label}</span>
              <strong style={{ color:t.text }}>{item.count}</strong>
            </div>
          )) : <div style={{ color:t.textFaint, fontSize:12 }}>No assignments yet.</div>}
        </div>
      </div>

      <section style={{ marginBottom:22 }}>
        <h3 style={{ margin:"0 0 12px", color:t.text, fontSize:15, fontWeight:800 }}>Task Details</h3>
        {tasks.length === 0 ? (
          <div style={{ padding:"26px 0", textAlign:"center", color:t.textFaint, fontSize:13, border:`1px dashed ${t.border2}`, borderRadius:10 }}>No tasks have been added to this project.</div>
        ) : (
          <div style={{ overflowX:"auto", border:`1px solid ${t.border2}`, borderRadius:10 }}>
            <div style={{ minWidth:760 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1.4fr 130px 100px 100px 90px 90px", gap:10, padding:"9px 12px", background:t.statBg, borderBottom:`1px solid ${t.border2}` }}>
                {["Task", "Assigned", "Status", "Due", "Progress", "Hours"].map(label => (
                  <div key={label} style={{ fontSize:10, fontWeight:800, color:t.textGhost, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</div>
                ))}
              </div>
              {tasks.map(task => (
                <div key={task.id} style={{ display:"grid", gridTemplateColumns:"1.4fr 130px 100px 100px 90px 90px", gap:10, padding:"12px", borderBottom:`1px solid ${t.divider}`, alignItems:"start" }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:t.textSub }}>{task.title}</div>
                    <div style={{ fontSize:11, color:t.textFaint, marginTop:3, lineHeight:1.5 }}>
                      {task.stage} - {task.description || "No description"}
                      {task.subtasks.length > 0 ? ` - ${task.completedSubtasks}/${task.subtasks.length} subtasks complete` : ""}
                      {task.blockers.length > 0 ? ` - Blocked by ${task.blockers.join(", ")}` : ""}
                      {task.commentCount > 0 ? ` - ${task.commentCount} comment${task.commentCount === 1 ? "" : "s"}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:t.textMuted }}>{task.assigneeName}</div>
                  <div><Badge label={task.status} color={statusColor(task.status)} /></div>
                  <div style={{ fontSize:12, color:t.textMuted }}>{task.dueDateLabel}</div>
                  <div style={{ fontSize:12, color:t.textMuted }}>{task.taskProgress}%</div>
                  <div style={{ fontSize:12, color:t.textMuted }}>{Number(task.actual_hours || 0)}h / {Number(task.estimated_hours || 0)}h</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h3 style={{ margin:"0 0 12px", color:t.text, fontSize:15, fontWeight:800 }}>Activities</h3>
        {activities.length === 0 ? (
          <div style={{ padding:"20px", color:t.textFaint, fontSize:13, border:`1px dashed ${t.border2}`, borderRadius:10, textAlign:"center" }}>No activity has been recorded for this project.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {activities.slice(0, 40).map(activity => (
              <div key={activity.id} style={{ display:"grid", gridTemplateColumns:"130px 90px 1fr", gap:10, alignItems:"start", padding:"10px 12px", background:t.statBg, border:`1px solid ${t.border2}`, borderRadius:9 }}>
                <div style={{ fontSize:11, color:t.textFaint }}>{activity.timestamp ? new Date(activity.timestamp).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }) : "-"}</div>
                <div style={{ fontSize:11, fontWeight:800, color:t.accent }}>{activity.type}</div>
                <div style={{ fontSize:12, color:t.textSub, lineHeight:1.5 }}>{activity.text}</div>
              </div>
            ))}
            {activities.length > 40 && <div style={{ fontSize:11, color:t.textFaint }}>Download the report to see all {activities.length} activities.</div>}
          </div>
        )}
      </section>
    </Modal>
  );
}
