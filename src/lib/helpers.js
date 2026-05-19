export const DEFAULT_PROJECT_PIPELINE_ID = "standard-delivery";

export const DEFAULT_PROJECT_PIPELINES = [
  {
    id: DEFAULT_PROJECT_PIPELINE_ID,
    name: "Standard Delivery",
    description: "General project delivery workflow.",
    builtIn: true,
    statuses: [
      { id: "brief", label: "Brief", color: "#8B5CF6", category: "todo" },
      { id: "strategy", label: "Strategy", color: "#3B82F6", category: "active" },
      { id: "creative", label: "Creative", color: "#F97316", category: "active" },
      { id: "review", label: "Review", color: "#F59E0B", category: "review" },
      { id: "delivered", label: "Delivered", color: "#059669", category: "complete", isComplete: true },
    ],
  },
  {
    id: "media-planning",
    name: "Media Planning",
    description: "Plan, review, approve, and hand off media work.",
    builtIn: true,
    statuses: [
      { id: "brief", label: "Brief", color: "#8B5CF6", category: "todo" },
      { id: "research", label: "Research", color: "#0891B2", category: "active" },
      { id: "plan_draft", label: "Plan Draft", color: "#3B82F6", category: "active" },
      { id: "internal_review", label: "Internal Review", color: "#F59E0B", category: "review" },
      { id: "client_review", label: "Client Review", color: "#D97706", category: "review" },
      { id: "approved", label: "Approved", color: "#059669", category: "complete", isComplete: true },
    ],
  },
  {
    id: "creative-production",
    name: "Creative Production",
    description: "Creative work from concept through final delivery.",
    builtIn: true,
    statuses: [
      { id: "brief", label: "Brief", color: "#8B5CF6", category: "todo" },
      { id: "concept", label: "Concept", color: "#8B5CF6", category: "active" },
      { id: "production", label: "Production", color: "#3B82F6", category: "active" },
      { id: "review", label: "Review", color: "#F59E0B", category: "review" },
      { id: "client_approval", label: "Client Approval", color: "#D97706", category: "review" },
      { id: "delivered", label: "Delivered", color: "#059669", category: "complete", isComplete: true },
    ],
  },
  {
    id: "web-launch",
    name: "Website Launch",
    description: "Website work from discovery to launch.",
    builtIn: true,
    statuses: [
      { id: "discovery", label: "Discovery", color: "#6B7280", category: "todo" },
      { id: "ux_design", label: "UX / Design", color: "#8B5CF6", category: "active" },
      { id: "development", label: "Development", color: "#3B82F6", category: "active" },
      { id: "qa", label: "QA", color: "#F59E0B", category: "review" },
      { id: "content_load", label: "Content Load", color: "#0891B2", category: "active" },
      { id: "launched", label: "Launched", color: "#059669", category: "complete", isComplete: true },
    ],
  },
  {
    id: "campaign-execution",
    name: "Campaign Execution",
    description: "Campaign setup, live monitoring, and reporting.",
    builtIn: true,
    statuses: [
      { id: "setup", label: "Setup", color: "#6B7280", category: "todo" },
      { id: "trafficking", label: "Trafficking", color: "#3B82F6", category: "active" },
      { id: "live", label: "Live", color: "#059669", category: "active" },
      { id: "optimizing", label: "Optimizing", color: "#F59E0B", category: "review" },
      { id: "reporting", label: "Reporting", color: "#8B5CF6", category: "review" },
      { id: "closed", label: "Closed", color: "#047857", category: "complete", isComplete: true },
    ],
  },
];

export const DEFAULT_TASK_PIPELINE_ID = DEFAULT_PROJECT_PIPELINE_ID;
export const DEFAULT_TASK_PIPELINES = DEFAULT_PROJECT_PIPELINES;

export const priorityColor = (p) => ({
  Critical: "#EF4444",
  High: "#F97316",
  Medium: "#3B82F6",
  Low: "#6B7280",
}[p] || "#6B7280");

export const statusColor = (s) => ({
  Active: "#059669",
  "On Hold": "#F59E0B",
  Completed: "#3B82F6",
  Archived: "#6B7280",
  Cancelled: "#EF4444",
  "To Do": "#6B7280",
  "In Progress": "#3B82F6",
  "In Review": "#F59E0B",
  Done: "#059669",
  Brief: "#8B5CF6",
  Strategy: "#3B82F6",
  Creative: "#F97316",
  Review: "#F59E0B",
  "Brief Received": "#6B7280",
  Research: "#0891B2",
  "Plan Draft": "#3B82F6",
  "Internal Review": "#F59E0B",
  "Client Review": "#D97706",
  Approved: "#059669",
  Queued: "#6B7280",
  Concept: "#8B5CF6",
  Design: "#3B82F6",
  Production: "#3B82F6",
  "Copy Review": "#F59E0B",
  "Client Approval": "#D97706",
  Delivered: "#059669",
  Discovery: "#6B7280",
  "UX / Design": "#8B5CF6",
  Development: "#3B82F6",
  QA: "#F59E0B",
  "Content Load": "#0891B2",
  Launched: "#059669",
  Setup: "#6B7280",
  Trafficking: "#3B82F6",
  Live: "#059669",
  Optimizing: "#F59E0B",
  Reporting: "#8B5CF6",
  Closed: "#047857",
  "On Track": "#059669",
  "At Risk": "#F59E0B",
  Behind: "#EF4444",
  Achieved: "#8B5CF6",
  "Not Started": "#6B7280",
  Won: "#059669",
  Lost: "#EF4444",
}[s] || "#6B7280");

const normalizeStatusId = (label, idx) =>
  String(label || `status-${idx + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || `status_${idx + 1}`;

const normalizePipelineStatus = (status, idx, total) => {
  const label = typeof status === "string" ? status : status?.label;
  const fallbackColor = ["#6B7280", "#3B82F6", "#F59E0B", "#059669"][Math.min(idx, 3)] || "#6B7280";
  const category = typeof status === "object" && status?.category
    ? status.category
    : idx === total - 1
      ? "complete"
      : idx === 0
        ? "todo"
        : idx >= total - 2
          ? "review"
          : "active";
  return {
    id: typeof status === "object" && status?.id ? status.id : normalizeStatusId(label, idx),
    label: label || `Status ${idx + 1}`,
    color: typeof status === "object" && status?.color ? status.color : fallbackColor,
    category,
    isComplete: Boolean(typeof status === "object" && status?.isComplete) || category === "complete",
  };
};

const normalizePipeline = (pipeline, idx) => {
  const statuses = Array.isArray(pipeline?.statuses) && pipeline.statuses.length
    ? pipeline.statuses.map((status, statusIdx) => normalizePipelineStatus(status, statusIdx, pipeline.statuses.length))
    : DEFAULT_PROJECT_PIPELINES[0].statuses;

  return {
    id: pipeline?.id || normalizeStatusId(pipeline?.name || "pipeline", idx),
    name: pipeline?.name || `Pipeline ${idx + 1}`,
    description: pipeline?.description || "",
    builtIn: Boolean(pipeline?.builtIn),
    statuses,
  };
};

export const getTaskPipelines = (settingsOrPipelines) => {
  const custom = Array.isArray(settingsOrPipelines)
    ? settingsOrPipelines
    : Array.isArray(settingsOrPipelines?.project_pipelines)
      ? settingsOrPipelines.project_pipelines
      : Array.isArray(settingsOrPipelines?.task_pipelines)
        ? settingsOrPipelines.task_pipelines
        : [];
  const byId = new Map();
  [...DEFAULT_PROJECT_PIPELINES, ...custom].forEach((pipeline, idx) => {
    const normalized = normalizePipeline(pipeline, idx);
    byId.set(normalized.id, normalized);
  });
  return [...byId.values()];
};

export const getProjectPipelines = getTaskPipelines;

export const getPipelineById = (pipelineId, pipelines) =>
  (pipelines?.length ? pipelines : getTaskPipelines()).find(p => p.id === pipelineId) || getTaskPipelines()[0];

export const getProjectPipeline = (project, pipelines) =>
  getPipelineById(project?.pipeline_id || DEFAULT_PROJECT_PIPELINE_ID, pipelines);

export const getPipelineStatuses = (project, pipelines) =>
  getProjectPipeline(project, pipelines).statuses;

export const firstPipelineStatus = (project, pipelines) =>
  getPipelineStatuses(project, pipelines)[0]?.label || "Brief";

export const completePipelineStatus = (project, pipelines) =>
  getPipelineStatuses(project, pipelines).find(s => s.isComplete || s.category === "complete")?.label || "Delivered";

export const getTaskStatusMeta = (status) => {
  const label = typeof status === "string" ? status : status?.status;
  const category = label === "Done"
    ? "complete"
    : label === "To Do"
      ? "todo"
      : ["In Progress", "In Review"].includes(label)
        ? "active"
        : statusCategoryGuess(label);
  return {
    id: normalizeStatusId(label, 0),
    label: label || "To Do",
    color: statusColor(label),
    category,
    isComplete: ["Done", "Completed", "Delivered", "Approved", "Launched", "Closed"].includes(label),
  };
};

export const isTaskComplete = (taskOrStatus, project, pipelines) => {
  const status = typeof taskOrStatus === "string" ? taskOrStatus : taskOrStatus?.status;
  const meta = getTaskStatusMeta(status);
  return Boolean(meta.isComplete || meta.category === "complete");
};

export const isTaskActive = (taskOrStatus, project, pipelines) =>
  !isTaskComplete(taskOrStatus, project, pipelines);

export const isTaskInProgress = (taskOrStatus, project, pipelines) => {
  const status = typeof taskOrStatus === "string" ? taskOrStatus : taskOrStatus?.status;
  return ["In Progress", "In Review"].includes(status);
};

export const taskStatusColor = (taskOrStatus, project, pipelines) => {
  const status = typeof taskOrStatus === "string" ? taskOrStatus : taskOrStatus?.status;
  return statusColor(status);
};

export const nextPipelineStatus = (currentStatus, project, pipelines) => {
  const statuses = getPipelineStatuses(project, pipelines);
  const labels = statuses.map(s => s.label);
  const idx = labels.indexOf(currentStatus);
  return labels[(idx + 1 + labels.length) % labels.length] || firstPipelineStatus(project, pipelines);
};

const statusCategoryGuess = (status) => {
  const s = String(status || "").toLowerCase();
  if (["done", "complete", "completed", "delivered", "approved", "launched", "closed"].some(x => s.includes(x))) return "complete";
  if (["review", "approval", "qa", "report"].some(x => s.includes(x))) return "review";
  if (["strategy", "creative", "progress", "draft", "research", "design", "development", "production", "live", "optim"].some(x => s.includes(x))) return "active";
  return "todo";
};

export const mapStatusToPipeline = (status, targetProject, pipelines) => {
  const statuses = getPipelineStatuses(targetProject, pipelines);
  if (statuses.some(s => s.label === status)) return status;
  const category = statusCategoryGuess(status);
  return statuses.find(s => s.category === category)?.label
    || statuses.find(s => s.isComplete)?.label
    || statuses[0]?.label
    || status
    || "To Do";
};

export const calcProgress = (projectId, tasks, projectsOrProject = null, pipelines = null) => {
  const pt = (tasks || []).filter(t => t.project_id === projectId);
  if (!pt.length) return 0;
  const project = Array.isArray(projectsOrProject)
    ? projectsOrProject.find(p => p.id === projectId)
    : projectsOrProject;
  return Math.round(pt.filter(t => isTaskComplete(t, project, pipelines)).length / pt.length * 100);
};

export const canDeleteTasksForRole = (role) =>
  ["owner", "admin", "manager"].includes(String(role || "").toLowerCase());

export const removeTaskAndReferences = (tasks, taskId) =>
  (tasks || [])
    .filter(t => t.id !== taskId)
    .map(t => Array.isArray(t.blocked_by) && t.blocked_by.includes(taskId)
      ? { ...t, blocked_by: t.blocked_by.filter(id => id !== taskId) }
      : t);

export const initials = (name) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?";
export const fmtDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
export const stageColor = (s) => ({
  Brief: "#8B5CF6",
  Strategy: "#3B82F6",
  Creative: "#F97316",
  Review: "#F59E0B",
  Delivered: "#059669",
}[s] || "#6B7280");
export const avatarBg = (name) => {
  const colors = ["#7C3AED", "#0891B2", "#059669", "#DC2626", "#D97706", "#DB2777"];
  const idx = name ? name.charCodeAt(0) % colors.length : 0;
  return colors[idx];
};
