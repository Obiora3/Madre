import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const emailLike = (value) => /\S+@\S+\.\S+/.test(String(value || ""));
const unique = (items) => [...new Set(items.filter(Boolean))];

async function authHeaders() {
  if (!isSupabaseConfigured || !supabase) return {};

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function assignmentIdempotencyKey(kind, entity, email) {
  return [
    "assignment",
    kind,
    entity?.id || Date.now(),
    email || "unassigned",
  ].join(":");
}

export async function sendAssignmentEmail({ kind, task, project, assignedEmail, emailRecipients = [], actorName }) {
  const recipients = unique([
    assignedEmail,
    task?.assigned_to?.email,
    project?.assigned_to?.email,
    ...emailRecipients,
  ].filter(emailLike));
  if (recipients.length === 0) return { skipped: true, reason: "No assigned user email." };

  const entity = task || project;
  const message = kind === "task_assigned"
    ? `${actorName || "Someone"} assigned you a new task.`
    : `${actorName || "Someone"} assigned you a new project.`;

  const resp = await fetch("/api/notify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({
      channels: ["email"],
      includeFallbackRecipients: false,
      kind,
      message,
      task,
      project,
      assignedEmail: recipients[0],
      emailRecipients: recipients,
      idempotencyKey: assignmentIdempotencyKey(kind, entity, recipients.join(",")),
    }),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body?.error || `Notification API error ${resp.status}`);
  }

  const result = body.results?.find((item) => item.channel === "email");
  if (result?.ok === false || result?.skipped) {
    throw new Error(result.error || result.reason || "Email notification was not sent.");
  }

  return body;
}
