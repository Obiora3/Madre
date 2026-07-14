import { calcProgress, fmtDate, isTaskComplete } from "./helpers.js";

const FALLBACK = "-";

const safeText = (value, fallback = FALLBACK) => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const escapeHtml = (value) => safeText(value, "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const slugify = (value) => safeText(value, "project")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80) || "project";

const formatDateTime = (value) => {
  if (!value) return FALLBACK;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return FALLBACK;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const groupCounts = (items, getKey) => {
  const counts = new Map();
  items.forEach(item => {
    const key = safeText(getKey(item), "Unassigned");
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

const describeEvent = (event) => {
  const action = safeText(event.event_type, "updated").replace(/_/g, " ");
  const type = safeText(event.entity_type, "item");
  const target = event.entity_title ? ` "${event.entity_title}"` : "";
  return `${safeText(event.user_name, "Someone")} ${action} ${type}${target}`;
};

const dedupeActivities = (activities) => {
  const seen = new Set();
  return activities.filter(activity => {
    const key = `${activity.timestamp || ""}:${activity.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const startOfWeek = (date) => {
  const start = startOfDay(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(start, mondayOffset);
};

const endOfWeek = (date) => addDays(startOfWeek(date), 7);

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const endOfMonth = (date) => addMonths(startOfMonth(date), 1);

const inDateWindow = (value, start, end) => {
  const date = parseDate(value);
  return Boolean(date && date >= start && date < end);
};

const periodLabel = (start, end) =>
  `${start.toLocaleDateString("en-GB", { day:"numeric", month:"short" })} - ${addDays(end, -1).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}`;

const monthLabel = (date) => date.toLocaleDateString("en-GB", { month:"short", year:"numeric" });

const uniqueTasks = (tasks) => {
  const seen = new Set();
  return tasks.filter(task => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
};

export function buildProjectReportData({
  projectId,
  project: givenProject,
  projects = [],
  tasks = [],
  clients = [],
  kpis = [],
  comments = [],
  events = [],
  pipelines = [],
  currencySymbol = "",
}) {
  const project = givenProject || projects.find(item => item.id === projectId);
  if (!project) return null;

  const client = clients.find(item => item.id === project.client_id);
  const projectTasks = tasks.filter(task => task.project_id === project.id);
  const projectKpis = kpis.filter(kpi => kpi.project_id === project.id);
  const taskById = Object.fromEntries(projectTasks.map(task => [task.id, task]));
  const taskIds = new Set(projectTasks.map(task => task.id));
  const progress = calcProgress(project.id, tasks, project, pipelines);
  const now = new Date();
  const isDone = (task) => isTaskComplete(task, project, pipelines);
  const completionEventByTaskId = new Map();
  events.forEach(event => {
    if (event.entity_type !== "task" || event.event_type !== "task_completed" || !taskIds.has(event.entity_id)) return;
    const previous = completionEventByTaskId.get(event.entity_id);
    if (!previous || new Date(event.created_at || 0) > new Date(previous.created_at || 0)) {
      completionEventByTaskId.set(event.entity_id, event);
    }
  });
  const completionDateForTask = (task) => {
    if (!isDone(task)) return null;
    const event = completionEventByTaskId.get(task.id);
    return parseDate(event?.created_at) || parseDate(task.updated_at) || parseDate(task.due_date) || parseDate(task.created_at);
  };

  const completedTasks = projectTasks.filter(isDone);
  const overdueTasks = projectTasks.filter(task =>
    !isDone(task) &&
    task.due_date &&
    new Date(task.due_date) < now
  );
  const blockedTasks = projectTasks.filter(task =>
    (task.blocked_by || []).some(depId => taskById[depId] && !isDone(taskById[depId]))
  );
  const totalEstimatedHours = projectTasks.reduce((sum, task) => sum + Number(task.estimated_hours || 0), 0);
  const totalActualHours = projectTasks.reduce((sum, task) => sum + Number(task.actual_hours || 0), 0);
  const budget = Number(project.budget || 0);
  const budgetSpent = Number(project.budget_spent || 0);
  const budgetUsedPercent = budget > 0 ? Math.round((budgetSpent / budget) * 100) : null;

  const taskComments = comments.filter(comment => comment.entity_type === "task" && taskIds.has(comment.entity_id));
  const projectComments = comments.filter(comment => comment.entity_type === "project" && comment.entity_id === project.id);
  const commentsByTask = taskComments.reduce((map, comment) => {
    map[comment.entity_id] = [...(map[comment.entity_id] || []), comment];
    return map;
  }, {});

  const eventActivities = events
    .filter(event =>
      (event.entity_type === "project" && event.entity_id === project.id) ||
      (event.entity_type === "task" && taskIds.has(event.entity_id))
    )
    .map(event => ({
      id: `event-${event.id}`,
      timestamp: event.created_at,
      actor: safeText(event.user_name, "Someone"),
      type: "Activity",
      text: describeEvent(event),
    }));

  const commentActivities = [...projectComments, ...taskComments].map(comment => {
    const targetTask = comment.entity_type === "task" ? taskById[comment.entity_id] : null;
    return {
      id: `comment-${comment.id}`,
      timestamp: comment.created_at,
      actor: safeText(comment.user_name, "Someone"),
      type: "Comment",
      text: `${safeText(comment.user_name, "Someone")} commented on ${targetTask ? targetTask.title : project.title}: ${safeText(comment.body, "").slice(0, 180)}`,
    };
  });

  const eventKeys = new Set(events.map(event => `${event.entity_type}:${event.entity_id}:${event.event_type}`));
  const derivedActivities = [];
  if (project.created_at && !eventKeys.has(`project:${project.id}:created`)) {
    derivedActivities.push({
      id: `derived-project-${project.id}`,
      timestamp: project.created_at,
      actor: safeText(project.assigned_to?.name, "Team"),
      type: "Project",
      text: `Project "${project.title}" was created`,
    });
  }
  projectTasks.forEach(task => {
    if (task.created_at && !eventKeys.has(`task:${task.id}:task_added`)) {
      derivedActivities.push({
        id: `derived-task-${task.id}`,
        timestamp: task.created_at,
        actor: safeText(task.assigned_to?.name, "Team"),
        type: "Task",
        text: `Task "${task.title}" was added`,
      });
    }
    if (isDone(task) && !eventKeys.has(`task:${task.id}:task_completed`)) {
      derivedActivities.push({
        id: `derived-task-done-${task.id}`,
        timestamp: task.updated_at || task.due_date || task.created_at,
        actor: safeText(task.assigned_to?.name, "Team"),
        type: "Task",
        text: `Task "${task.title}" is marked complete`,
      });
    }
  });

  const activities = dedupeActivities([...eventActivities, ...commentActivities, ...derivedActivities])
    .filter(activity => activity.timestamp || activity.text)
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  const detailedTasks = projectTasks
    .slice()
    .sort((a, b) => {
      const completeDelta = Number(isDone(a)) - Number(isDone(b));
      if (completeDelta !== 0) return completeDelta;
      return safeText(a.due_date, "9999").localeCompare(safeText(b.due_date, "9999"));
    })
    .map(task => {
      const subtasks = task.subtasks || [];
      const completedSubtasks = subtasks.filter(subtask => subtask.done).length;
      const blockers = (task.blocked_by || []).map(depId => taskById[depId]?.title).filter(Boolean);
      const taskProgress = subtasks.length
        ? Math.round((completedSubtasks / subtasks.length) * 100)
        : isDone(task)
          ? 100
          : 0;
      return {
        ...task,
        assigneeName: safeText(task.assigned_to?.name, "Unassigned"),
        assigneeEmail: safeText(task.assigned_to?.email, ""),
        stage: safeText(task.project_stage, "No Stage"),
        status: safeText(task.status, "No Status"),
        priority: safeText(task.priority, "No Priority"),
        dueDateLabel: fmtDate(task.due_date),
        taskProgress,
        subtasks,
        completedSubtasks,
        blockers,
        commentCount: (commentsByTask[task.id] || []).length,
      };
    });

  const detailedTaskById = Object.fromEntries(detailedTasks.map(task => [task.id, task]));
  const toDetailedTasks = (items, limit = 8) => uniqueTasks(items)
    .map(task => detailedTaskById[task.id])
    .filter(Boolean)
    .slice(0, limit);
  const tasksDueInRange = (start, end) => projectTasks.filter(task => inDateWindow(task.due_date, start, end));
  const tasksCompletedInRange = (start, end) => projectTasks.filter(task => inDateWindow(completionDateForTask(task), start, end));
  const makeTrajectoryPeriod = (label, start, end, rangeLabel = periodLabel(start, end)) => {
    const dueTasks = tasksDueInRange(start, end);
    const completedDueTasks = dueTasks.filter(isDone);
    const completedInPeriod = tasksCompletedInRange(start, end);
    return {
      label,
      rangeLabel,
      dueCount: dueTasks.length,
      completedDueCount: completedDueTasks.length,
      openDueCount: dueTasks.length - completedDueTasks.length,
      completedInPeriodCount: completedInPeriod.length,
      progressPercent: dueTasks.length ? Math.round((completedDueTasks.length / dueTasks.length) * 100) : (completedInPeriod.length ? 100 : 0),
    };
  };
  const currentWeekStart = startOfWeek(now);
  const currentWeekEnd = endOfWeek(now);
  const previousWeekStart = addDays(currentWeekStart, -7);
  const nextWeekStart = currentWeekEnd;
  const followingWeekStart = addDays(nextWeekStart, 7);
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const previousMonthStart = addMonths(currentMonthStart, -1);
  const nextMonthStart = currentMonthEnd;

  const previousWeek = makeTrajectoryPeriod("Last week", previousWeekStart, currentWeekStart);
  const currentWeek = makeTrajectoryPeriod("This week", currentWeekStart, currentWeekEnd);
  const nextWeek = makeTrajectoryPeriod("Next week", nextWeekStart, followingWeekStart);
  const followingWeek = makeTrajectoryPeriod("Following week", followingWeekStart, addDays(followingWeekStart, 7));
  const previousMonth = makeTrajectoryPeriod("Last month", previousMonthStart, currentMonthStart, monthLabel(previousMonthStart));
  const currentMonth = makeTrajectoryPeriod("This month", currentMonthStart, currentMonthEnd, monthLabel(currentMonthStart));
  const nextMonth = makeTrajectoryPeriod("Next month", nextMonthStart, endOfMonth(nextMonthStart), monthLabel(nextMonthStart));
  const duePreviousWeek = tasksDueInRange(previousWeekStart, currentWeekStart);
  const completedPreviousWeek = tasksCompletedInRange(previousWeekStart, currentWeekStart);
  const dueThisWeek = tasksDueInRange(currentWeekStart, currentWeekEnd);
  const completedThisWeek = tasksCompletedInRange(currentWeekStart, currentWeekEnd);
  const dueNextWeek = tasksDueInRange(nextWeekStart, followingWeekStart);
  const weeklyDelta = currentWeek.completedInPeriodCount - previousWeek.completedInPeriodCount;
  const trajectoryLabel = overdueTasks.length || blockedTasks.length
    ? "Needs attention"
    : currentWeek.openDueCount > 0
      ? "In progress"
      : "On track";
  const standup = {
    headline: `${trajectoryLabel}: ${currentWeek.completedInPeriodCount} task${currentWeek.completedInPeriodCount === 1 ? "" : "s"} completed this week, compared with ${previousWeek.completedInPeriodCount} last week. ${currentWeek.openDueCount} due task${currentWeek.openDueCount === 1 ? "" : "s"} still open, and ${nextWeek.dueCount} task${nextWeek.dueCount === 1 ? "" : "s"} due next week.`,
    trajectoryLabel,
    weeklyDelta,
    currentWeek,
    previousWeek,
    nextWeek,
    currentMonth,
    weeklyTrajectory: [previousWeek, currentWeek, nextWeek, followingWeek],
    monthlyTrajectory: [previousMonth, currentMonth, nextMonth],
    previousWeekTasks: toDetailedTasks([...duePreviousWeek, ...completedPreviousWeek], 10),
    thisWeekTasks: toDetailedTasks([...dueThisWeek, ...completedThisWeek], 10),
    nextWeekTasks: toDetailedTasks(dueNextWeek, 10),
    atRiskTasks: toDetailedTasks([...overdueTasks, ...blockedTasks], 10),
  };

  const summaryText = [
    `${project.title} is ${progress}% complete with ${completedTasks.length} of ${projectTasks.length} tasks done.`,
    overdueTasks.length ? `${overdueTasks.length} task${overdueTasks.length === 1 ? " is" : "s are"} overdue.` : "No overdue tasks are currently visible.",
    blockedTasks.length ? `${blockedTasks.length} task${blockedTasks.length === 1 ? " is" : "s are"} blocked by dependencies.` : "No blocked tasks were found.",
    totalEstimatedHours || totalActualHours ? `${totalActualHours}h logged against ${totalEstimatedHours}h estimated.` : "",
  ].filter(Boolean).join(" ");

  return {
    project,
    client,
    generatedAt: new Date().toISOString(),
    currencySymbol,
    summaryText,
    stats: {
      progress,
      totalTasks: projectTasks.length,
      completedTasks: completedTasks.length,
      activeTasks: projectTasks.length - completedTasks.length,
      overdueTasks: overdueTasks.length,
      blockedTasks: blockedTasks.length,
      totalEstimatedHours,
      totalActualHours,
      budget,
      budgetSpent,
      budgetUsedPercent,
    },
    labels: {
      client: safeText(client?.name, "No client"),
      assignedTo: safeText(project.assigned_to?.name, "Unassigned"),
      stage: safeText(project.stage),
      status: safeText(project.status),
      priority: safeText(project.priority),
      startDate: fmtDate(project.start_date),
      dueDate: fmtDate(project.due_date),
    },
    tasks: detailedTasks,
    kpis: projectKpis,
    activities,
    standup,
    statusSummary: groupCounts(projectTasks, task => task.status || "No Status"),
    assigneeSummary: groupCounts(projectTasks, task => task.assigned_to?.name || "Unassigned"),
    prioritySummary: groupCounts(projectTasks, task => task.priority || "No Priority"),
  };
}

const renderSummaryList = (items) => items.length
  ? items.map(item => `<li><strong>${escapeHtml(item.label)}</strong>: ${item.count}</li>`).join("")
  : "<li>No data</li>";

const renderTrajectoryRows = (periods) => periods.length
  ? periods.map(period => `
    <tr>
      <td><strong>${escapeHtml(period.label)}</strong><div class="muted small">${escapeHtml(period.rangeLabel)}</div></td>
      <td>${period.completedInPeriodCount}</td>
      <td>${period.completedDueCount}/${period.dueCount}</td>
      <td>${period.openDueCount}</td>
      <td>${period.progressPercent}%</td>
    </tr>
  `).join("")
  : `<tr><td colspan="5" class="empty">No trajectory data.</td></tr>`;

const renderStandupTaskList = (items) => items.length
  ? `<ul>${items.map(task => `
    <li>
      <strong>${escapeHtml(task.title)}</strong>
      <span class="muted"> - ${escapeHtml(task.status)} - ${escapeHtml(task.assigneeName)} - due ${escapeHtml(task.dueDateLabel)}</span>
      ${task.description ? `<div class="muted small">${escapeHtml(task.description)}</div>` : ""}
    </li>
  `).join("")}</ul>`
  : `<p class="muted">No tasks in this group.</p>`;

export function renderProjectReportHtml(report) {
  if (!report) return "";
  const { project, labels, stats, tasks, activities, currencySymbol, standup } = report;
  const money = (value) => `${escapeHtml(currencySymbol)}${Number(value || 0).toLocaleString()}`;
  const taskRows = tasks.length ? tasks.map(task => {
    const details = [
      task.description ? `Description: ${escapeHtml(task.description)}` : "",
      task.subtasks.length ? `Subtasks: ${task.completedSubtasks}/${task.subtasks.length} complete` : "",
      task.blockers.length ? `Blocked by: ${task.blockers.map(escapeHtml).join(", ")}` : "",
      task.commentCount ? `Comments: ${task.commentCount}` : "",
    ].filter(Boolean).join("<br>");
    return `
      <tr>
        <td><strong>${escapeHtml(task.title)}</strong>${details ? `<div class="muted small">${details}</div>` : ""}</td>
        <td>${escapeHtml(task.assigneeName)}${task.assigneeEmail ? `<div class="muted small">${escapeHtml(task.assigneeEmail)}</div>` : ""}</td>
        <td>${escapeHtml(task.stage)}</td>
        <td>${escapeHtml(task.status)}</td>
        <td>${escapeHtml(task.priority)}</td>
        <td>${escapeHtml(task.dueDateLabel)}</td>
        <td>${task.taskProgress}%</td>
        <td>${Number(task.actual_hours || 0)}h / ${Number(task.estimated_hours || 0)}h</td>
      </tr>`;
  }).join("") : `<tr><td colspan="8" class="empty">No tasks have been added to this project.</td></tr>`;

  const activityRows = activities.length ? activities.map(activity => `
    <tr>
      <td>${escapeHtml(formatDateTime(activity.timestamp))}</td>
      <td>${escapeHtml(activity.type)}</td>
      <td>${escapeHtml(activity.actor)}</td>
      <td>${escapeHtml(activity.text)}</td>
    </tr>
  `).join("") : `<tr><td colspan="4" class="empty">No activity has been recorded for this project.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(project.title)} - Detailed Project Report</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 40px; color: #172033; background: #f6f7fb; font-family: Arial, sans-serif; line-height: 1.45; }
    main { max-width: 1120px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 34px; }
    h1 { margin: 0 0 6px; font-size: 30px; }
    h2 { margin: 30px 0 12px; font-size: 18px; }
    p { margin: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #667085; background: #f3f4f6; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #eaecf0; vertical-align: top; font-size: 13px; }
    ul { margin: 8px 0 0; padding-left: 18px; }
    .meta { color: #667085; font-size: 13px; margin-bottom: 24px; }
    .summary { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 22px 0; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; background: #fff; }
    .label { color: #667085; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
    .value { color: #101828; font-size: 20px; font-weight: 800; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .three-col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .focus-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
    .muted { color: #667085; }
    .small { font-size: 11px; margin-top: 4px; }
    .empty { text-align: center; color: #667085; padding: 18px; }
    @media print { body { background: #fff; padding: 0; } main { border: 0; border-radius: 0; } }
    @media (max-width: 760px) { body { padding: 16px; } main { padding: 20px; } .grid, .two-col, .three-col, .focus-grid { grid-template-columns: 1fr; } table { display: block; overflow-x: auto; } }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(project.title)}</h1>
    <div class="meta">Detailed Project Report generated ${escapeHtml(formatDateTime(report.generatedAt))}</div>

    <div class="summary">
      <p>${escapeHtml(report.summaryText)}</p>
    </div>

    <div class="grid">
      <div class="card"><div class="label">Client</div><div class="value">${escapeHtml(labels.client)}</div></div>
      <div class="card"><div class="label">Assigned To</div><div class="value">${escapeHtml(labels.assignedTo)}</div></div>
      <div class="card"><div class="label">Stage</div><div class="value">${escapeHtml(labels.stage)}</div></div>
      <div class="card"><div class="label">Progress</div><div class="value">${stats.progress}%</div></div>
      <div class="card"><div class="label">Tasks</div><div class="value">${stats.completedTasks}/${stats.totalTasks}</div></div>
      <div class="card"><div class="label">Overdue</div><div class="value">${stats.overdueTasks}</div></div>
      <div class="card"><div class="label">Blocked</div><div class="value">${stats.blockedTasks}</div></div>
      <div class="card"><div class="label">Hours</div><div class="value">${stats.totalActualHours}h / ${stats.totalEstimatedHours}h</div></div>
    </div>

    <h2>Weekly Standup Overview</h2>
    <div class="summary">
      <p>${escapeHtml(standup.headline)}</p>
    </div>
    <div class="grid">
      <div class="card"><div class="label">Previous Week</div><div class="value">${standup.previousWeek.completedInPeriodCount}</div><div class="muted small">${standup.previousWeek.completedDueCount}/${standup.previousWeek.dueCount} due tasks complete</div></div>
      <div class="card"><div class="label">This Week Completed</div><div class="value">${standup.currentWeek.completedInPeriodCount}</div><div class="muted small">${standup.currentWeek.completedDueCount}/${standup.currentWeek.dueCount} due tasks complete</div></div>
      <div class="card"><div class="label">Weekly Delta</div><div class="value">${standup.weeklyDelta >= 0 ? "+" : ""}${standup.weeklyDelta}</div><div class="muted small">vs last week completions</div></div>
      <div class="card"><div class="label">This Month</div><div class="value">${standup.currentMonth.progressPercent}%</div><div class="muted small">${standup.currentMonth.completedDueCount}/${standup.currentMonth.dueCount} due tasks complete</div></div>
      <div class="card"><div class="label">Next Week Due</div><div class="value">${standup.nextWeek.dueCount}</div><div class="muted small">${standup.nextWeek.openDueCount} currently open</div></div>
    </div>

    <div class="two-col">
      <section>
        <h2>Weekly Trajectory</h2>
        <table>
          <thead><tr><th>Period</th><th>Completed</th><th>Due Done</th><th>Open Due</th><th>Progress</th></tr></thead>
          <tbody>${renderTrajectoryRows(standup.weeklyTrajectory)}</tbody>
        </table>
      </section>
      <section>
        <h2>Monthly Trajectory</h2>
        <table>
          <thead><tr><th>Period</th><th>Completed</th><th>Due Done</th><th>Open Due</th><th>Progress</th></tr></thead>
          <tbody>${renderTrajectoryRows(standup.monthlyTrajectory)}</tbody>
        </table>
      </section>
    </div>

    <h2>Standup Focus Tasks</h2>
    <div class="focus-grid">
      <section class="card">
        <div class="label">Previous Week</div>
        ${renderStandupTaskList(standup.previousWeekTasks)}
      </section>
      <section class="card">
        <div class="label">This Week</div>
        ${renderStandupTaskList(standup.thisWeekTasks)}
      </section>
      <section class="card">
        <div class="label">Next Week</div>
        ${renderStandupTaskList(standup.nextWeekTasks)}
      </section>
      <section class="card">
        <div class="label">At Risk</div>
        ${renderStandupTaskList(standup.atRiskTasks)}
      </section>
    </div>

    <h2>Project Details</h2>
    <table>
      <tbody>
        <tr><th>Status</th><td>${escapeHtml(labels.status)}</td><th>Priority</th><td>${escapeHtml(labels.priority)}</td></tr>
        <tr><th>Start Date</th><td>${escapeHtml(labels.startDate)}</td><th>Due Date</th><td>${escapeHtml(labels.dueDate)}</td></tr>
        <tr><th>Budget</th><td>${stats.budget ? money(stats.budget) : "Not set"}</td><th>Spent</th><td>${stats.budgetSpent ? money(stats.budgetSpent) : "Not set"}${stats.budgetUsedPercent !== null ? ` (${stats.budgetUsedPercent}%)` : ""}</td></tr>
        <tr><th>Description</th><td colspan="3">${escapeHtml(project.description || "No description provided.")}</td></tr>
      </tbody>
    </table>

    <div class="two-col">
      <section>
        <h2>Task Status Summary</h2>
        <ul>${renderSummaryList(report.statusSummary)}</ul>
      </section>
      <section>
        <h2>Assigned Task Summary</h2>
        <ul>${renderSummaryList(report.assigneeSummary)}</ul>
      </section>
    </div>

    <h2>Task Details</h2>
    <table>
      <thead>
        <tr><th>Task</th><th>Assigned</th><th>Stage</th><th>Status</th><th>Priority</th><th>Due</th><th>Progress</th><th>Hours</th></tr>
      </thead>
      <tbody>${taskRows}</tbody>
    </table>

    <h2>Activities</h2>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Actor</th><th>Activity</th></tr></thead>
      <tbody>${activityRows}</tbody>
    </table>
  </main>
</body>
</html>`;
}

export function downloadProjectReport(report) {
  if (!report || typeof document === "undefined") return;
  const html = renderProjectReportHtml(report);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(report.project.title)}-detailed-project-report.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 250);
}

export function printProjectReport(report) {
  if (!report || typeof window === "undefined") return false;
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(renderProjectReportHtml(report));
  win.document.close();
  window.setTimeout(() => win.print(), 350);
  return true;
}
