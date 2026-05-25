import { useEffect, useRef } from "react";
import { getTaskPipelines, isTaskComplete } from "../lib/helpers.js";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const RUNS_KEY = "af_automation_runs";
const MAX_STORED_RUNS = 700;

const readRuns = () => {
  try {
    const value = JSON.parse(localStorage.getItem(RUNS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const writeRuns = (runs) => {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(-MAX_STORED_RUNS)));
  } catch {
    // Local automation dedupe is best-effort only.
  }
};

const hoursUntil = (dateValue) => {
  const due = new Date(dateValue);
  if (Number.isNaN(due.getTime())) return null;
  return (due - Date.now()) / 3600000;
};

const isTaskBlocked = (task, taskById, projectById, taskPipelines) =>
  (task.blocked_by || []).some((depId) => {
    const dependency = taskById.get(depId);
    return dependency && !isTaskComplete(dependency, projectById.get(dependency.project_id), taskPipelines);
  });

async function sendExternalNotification({ action, project, settings }) {
  const channels = [
    settings.automation_email ? "email" : null,
    settings.automation_whatsapp ? "whatsapp" : null,
  ].filter(Boolean);
  if (channels.length === 0) return;

  let token = "";
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token || "";
  }

  const resp = await fetch("/api/notify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      channels,
      kind: action.kind,
      message: action.message,
      task: action.task,
      project,
      assignedEmail: action.task.assigned_to?.email,
      idempotencyKey: action.dedupeKey,
    }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body?.error || `Notification API error ${resp.status}`);
  }

  const body = await resp.json().catch(() => ({}));
  const results = Array.isArray(body.results) ? body.results : [];
  const failures = results.flatMap((result) => {
    if (result?.ok === false) return [result.error || `${result.channel} notification failed.`];
    if (result?.skipped) return [result.reason || `${result.channel} notification skipped.`];
    if (Array.isArray(result?.results)) {
      return result.results
        .filter((item) => item?.ok === false || item?.skipped)
        .map((item) => item.error || item.reason || `${result.channel} notification failed.`);
    }
    return [];
  });

  if (failures.length === results.length || failures.some((message) => !message.includes("not configured"))) {
    throw new Error(failures[0]);
  }
}

export function useOperationalAutomations({ tasks, projects, currentUser, settings, logActivity, toast, users }) {
  const quietInitialSweeps = useRef(new Set());

  useEffect(() => {
    if (!currentUser || !settings?.automation_enabled) return;
    if ((currentUser.role || "member").toLowerCase() === "viewer") return;
    if (!Array.isArray(tasks) || tasks.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const scope = currentUser.agency_id || currentUser.email || "local";
    const isInitialSweep = !quietInitialSweeps.current.has(scope);
    quietInitialSweeps.current.add(scope);
    const previousRuns = readRuns();
    const seen = new Set(previousRuns);
    const nextRuns = [...previousRuns];
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const projectById = new Map((projects || []).map((project) => [project.id, project]));
    const taskPipelines = getTaskPipelines(settings);
    const actions = [];

    const markOnce = (kind, task) => {
      const key = `${scope}:${today}:${kind}:${task.id}`;
      if (seen.has(key)) return null;
      seen.add(key);
      nextRuns.push(key);
      return key;
    };

    const addAction = (kind, task, message, type = "info") => {
      const dedupeKey = markOnce(kind, task);
      if (!dedupeKey) return;
      const project = projectById.get(task.project_id);
      actions.push({
        kind,
        task,
        type,
        message,
        sub: project ? project.title : task.assigned_to?.name || "",
        dedupeKey,
      });
    };

    const deadlineWindow = Number(settings.deadline_warning_hours || 24);
    const escalationHours = Number(settings.overdue_escalation_hours || 24);

    for (const task of tasks) {
      if (!task || isTaskComplete(task, projectById.get(task.project_id), taskPipelines)) continue;

      const diffHours = task.due_date ? hoursUntil(task.due_date) : null;
      if (
        settings.automation_deadline_warnings &&
        settings.notify_deadlines &&
        diffHours !== null &&
        diffHours >= 0 &&
        diffHours <= deadlineWindow
      ) {
        addAction("deadline_warning", task, `"${task.title}" is due soon`, "warning");
      }

      if (
        settings.automation_overdue_escalation &&
        diffHours !== null &&
        diffHours < -escalationHours
      ) {
        addAction("escalated", task, `"${task.title}" is overdue`, "error");
      }

      if (settings.automation_blocked_alerts && isTaskBlocked(task, taskById, projectById, taskPipelines)) {
        addAction("blocked", task, `"${task.title}" is blocked`, "warning");
      }
    }

    if (actions.length === 0) return;

    writeRuns(nextRuns);

    actions.slice(0, 12).forEach((action) => {
      logActivity({
        userName: "Automation",
        eventType: action.kind,
        entityType: "task",
        entityId: action.task.id,
        entityTitle: action.task.title,
      });
    });

    const shouldShowToasts = settings.automation_toasts && !isInitialSweep;

    if (shouldShowToasts) {
      actions.slice(0, 3).forEach((action) => {
        toast({ message: action.message, sub: action.sub, type: action.type });
      });
    }

    if (settings.automation_email || settings.automation_whatsapp) {
      // Build a phone lookup from the live users list so notifications reach the
      // current assignee's WhatsApp even if the task was created before they added their number.
      const phoneByEmail = new Map(
        (users || []).filter(u => u.phone).map(u => [u.email, u.phone])
      );

      actions.slice(0, 6).forEach((action) => {
        const assigneeEmail = action.task.assigned_to?.email;
        const assigneePhone = assigneeEmail ? (phoneByEmail.get(assigneeEmail) || null) : null;
        const enrichedTask = assigneePhone
          ? { ...action.task, assigned_to: { ...action.task.assigned_to, phone: assigneePhone } }
          : action.task;

        sendExternalNotification({
          action: { ...action, task: enrichedTask },
          project: projectById.get(action.task.project_id) || null,
          settings,
        }).catch((error) => {
          if (shouldShowToasts) {
            toast({ message: "External notification failed", sub: error.message, type: "error" });
          }
        });
      });
    }
  }, [tasks, projects, currentUser, settings, logActivity, toast, users]);
}
