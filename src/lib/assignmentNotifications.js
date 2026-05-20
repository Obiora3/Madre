import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const emailLike = (value) => /\S+@\S+\.\S+/.test(String(value || ""));
const unique = (items) => [...new Set(items.filter(Boolean))];
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

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

function uniqueRecipientUsers(users) {
  const byEmail = new Map();
  users.forEach((user) => {
    const email = normalizeEmail(user?.email);
    if (!email || byEmail.has(email)) return;
    byEmail.set(email, {
      email,
      name: String(user?.name || "").trim(),
    });
  });
  return [...byEmail.values()];
}

export async function sendAssignmentEmail({ kind, task, project, assignedEmail, emailRecipients = [], recipientUsers = [], actorName }) {
  const recipients = unique([
    assignedEmail,
    task?.assigned_to?.email,
    project?.assigned_to?.email,
    ...emailRecipients,
  ].filter(emailLike));
  if (recipients.length === 0) return { skipped: true, reason: "No assigned user email." };
  const recipientProfiles = uniqueRecipientUsers([
    task?.assigned_to,
    project?.assigned_to,
    ...recipientUsers,
  ]);

  const entity = task || project;
  const message = kind === "task_assigned"
    ? `${actorName || "Someone"} assigned you a new task.`
    : kind === "mentioned"
      ? `${actorName || "Someone"} mentioned you in a comment.`
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
      recipientUsers: recipientProfiles,
      idempotencyKey: assignmentIdempotencyKey(kind, entity, recipients.join(",")),
    }),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body?.error || `Notification API error ${resp.status}`);
  }

  const result = body.results?.find((item) => item.channel === "email");
  if (!result) {
    throw new Error("Notification API did not return an email result.");
  }
  if (result?.ok === false || result?.skipped) {
    throw new Error(result.error || result.reason || "Email notification was not sent.");
  }

  return { ...body, recipientCount: recipients.length, emailId: result?.id || null };
}
