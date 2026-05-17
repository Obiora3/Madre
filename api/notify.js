const MAX_MESSAGE_LENGTH = 1600;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const csv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const unique = (items) => [...new Set(items.filter(Boolean))];

const json = (res, status, payload) => res.status(status).json(payload);

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function truncate(value, max = MAX_MESSAGE_LENGTH) {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

async function verifySupabaseUser(req) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const allowUnauthenticated = process.env.NOTIFY_ALLOW_UNAUTHENTICATED === "true";
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();

  if (!supabaseUrl || !anonKey) {
    if (!allowUnauthenticated && process.env.NODE_ENV === "production") {
      return { ok: false, error: "Supabase auth is required for outbound notifications." };
    }
    return { ok: true, user: null, mode: "unconfigured" };
  }

  if (!token) {
    return { ok: false, error: "Missing Supabase session token." };
  }

  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });

  if (!resp.ok) {
    return { ok: false, error: "Invalid Supabase session token." };
  }

  return { ok: true, user: await resp.json().catch(() => null), mode: "supabase" };
}

const idempotencyKey = (value, fallback) =>
  String(value || fallback)
    .replace(/[^a-zA-Z0-9:_-]/g, "-")
    .slice(0, 256);

const money = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(amount);
};

const prettyDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const appUrl = () => {
  const configured = process.env.NOTIFICATION_APP_URL;
  if (configured) return configured;
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
};

const notificationMeta = (kind) => ({
  task_assigned: {
    label: "New task assigned",
    eyebrow: "Assignment",
    accent: "#7C3AED",
    tint: "#F5F3FF",
    intro: "A new task has been assigned to you.",
    cta: "Open task",
  },
  project_assigned: {
    label: "New project assigned",
    eyebrow: "Assignment",
    accent: "#2563EB",
    tint: "#EFF6FF",
    intro: "A new project has been assigned to you.",
    cta: "Open project",
  },
  deadline_warning: {
    label: "Deadline warning",
    eyebrow: "Due soon",
    accent: "#D97706",
    tint: "#FFFBEB",
    intro: "A task is approaching its deadline.",
    cta: "Review task",
  },
  escalated: {
    label: "Overdue escalation",
    eyebrow: "Action needed",
    accent: "#DC2626",
    tint: "#FEF2F2",
    intro: "A task is overdue and needs attention.",
    cta: "Review task",
  },
  blocked: {
    label: "Blocked task alert",
    eyebrow: "Blocked",
    accent: "#B45309",
    tint: "#FFFBEB",
    intro: "A task is blocked by unfinished work.",
    cta: "Review blocker",
  },
}[kind] || {
  label: "Workspace notification",
  eyebrow: "Notification",
  accent: "#4B5563",
  tint: "#F9FAFB",
  intro: "There is a new workspace notification.",
  cta: "Open Madre",
});

const row = (label, value) => {
  if (value === null || value === undefined || value === "") return null;
  return { label, value: String(value) };
};

function renderRows(rows) {
  return rows.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:13px;width:38%">${escapeHtml(item.label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E5E7EB;color:#111827;font-size:13px;font-weight:600">${escapeHtml(item.value)}</td>
    </tr>
  `).join("");
}

function renderEmailHtml({ brand, meta, title, message, rows, description, ctaUrl }) {
  const safeBrand = escapeHtml(brand);
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message || meta.intro);
  const safeDescription = escapeHtml(description);
  const safeUrl = escapeHtml(ctaUrl);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F4F6;padding:28px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:22px 28px;background:${meta.tint};border-bottom:1px solid #E5E7EB">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${meta.accent};margin-bottom:10px">${escapeHtml(meta.eyebrow)}</div>
                <div style="font-size:24px;line-height:1.25;font-weight:800;color:#111827;margin-bottom:8px">${safeTitle}</div>
                <div style="font-size:14px;line-height:1.6;color:#374151">${safeMessage}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px">
                <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:${meta.tint};color:${meta.accent};font-size:12px;font-weight:700;margin-bottom:16px">${escapeHtml(meta.label)}</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                  ${renderRows(rows)}
                </table>
                ${description ? `
                  <div style="margin-top:20px;padding:16px;border-radius:12px;background:#F9FAFB;border:1px solid #E5E7EB">
                    <div style="font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Details</div>
                    <div style="font-size:14px;line-height:1.6;color:#1F2937">${safeDescription}</div>
                  </div>
                ` : ""}
                ${ctaUrl ? `
                  <div style="margin-top:24px">
                    <a href="${safeUrl}" style="display:inline-block;background:${meta.accent};color:#FFFFFF;text-decoration:none;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:700">${escapeHtml(meta.cta)}</a>
                  </div>
                ` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#F9FAFB;border-top:1px solid #E5E7EB;color:#6B7280;font-size:12px;line-height:1.5">
                Sent by ${safeBrand}. You received this because this workspace notification is enabled.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function makeNotification(input) {
  const kind = input.kind || "notification";
  const task = input.task || {};
  const project = input.project || {};
  const title = task.title || project.title || input.title || "Madre notification";
  const meta = notificationMeta(kind);
  const brand = process.env.NOTIFICATION_BRAND_NAME || "Madre";
  const description = task.description || project.description || "";
  const rows = [
    row(task.title ? "Task" : "Project", title),
    task.title ? row("Project", project.title) : null,
    row("Client", project.client_name),
    row("Status", task.status || project.status),
    row("Priority", task.priority || project.priority),
    row("Stage", project.stage),
    row("Start date", prettyDate(project.start_date)),
    row("Due date", prettyDate(task.due_date || project.due_date)),
    row("Estimated hours", task.estimated_hours ? `${task.estimated_hours}h` : ""),
    row("Budget", money(project.budget)),
    row("Assigned to", task.assigned_to?.name || project.assigned_to?.name),
  ].filter(Boolean);

  const subject = truncate(`${brand}: ${meta.label} - ${title}`, 140);
  const text = truncate([
    `${meta.label}: ${title}`,
    input.message || meta.intro,
    ...rows.map((item) => `${item.label}: ${item.value}`),
    description ? `Details: ${description}` : null,
  ].filter(Boolean).join("\n"));
  const html = renderEmailHtml({
    brand,
    meta,
    title,
    message: input.message,
    rows,
    description,
    ctaUrl: appUrl(),
  });

  return { kind, subject, text, html, variables: { label: meta.label, title, project: project.title || "-", due: task.due_date || "-" } };
}

async function sendEmail(notification, recipients, { includeFallbackRecipients = true } = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_EMAIL_FROM || process.env.RESEND_FROM_EMAIL;
  const fallbackRecipients = includeFallbackRecipients ? csv(process.env.NOTIFICATION_EMAIL_TO) : [];
  const to = unique([...fallbackRecipients, ...recipients]);

  if (!apiKey) {
    return { channel: "email", skipped: true, reason: "RESEND_API_KEY is not configured for this deployment." };
  }

  if (!from) {
    return { channel: "email", skipped: true, reason: "NOTIFICATION_EMAIL_FROM is not configured for this deployment." };
  }

  if (to.length === 0) {
    return { channel: "email", skipped: true, reason: "No assigned user email was provided." };
  }

  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey(
        notification.idempotencyKey,
        `madre-${notification.kind}-${Date.now()}`
      ),
    },
    body: JSON.stringify({
      from,
      to,
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
    }),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { channel: "email", ok: false, error: body?.message || body?.error || `Resend error ${resp.status}` };
  }
  return { channel: "email", ok: true, id: body.id };
}

function makeWhatsAppPayload(to, notification) {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";

  if (templateName) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: notification.variables.label },
              { type: "text", text: notification.variables.title },
              { type: "text", text: notification.variables.project },
              { type: "text", text: notification.variables.due },
            ],
          },
        ],
      },
    };
  }

  if (process.env.WHATSAPP_ALLOW_TEXT !== "true") return null;

  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { preview_url: false, body: notification.text },
  };
}

async function sendWhatsApp(notification) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v25.0";
  const recipients = unique(csv(process.env.NOTIFICATION_WHATSAPP_TO));

  if (!token || !phoneNumberId || recipients.length === 0) {
    return { channel: "whatsapp", skipped: true, reason: "WhatsApp provider or recipients not configured." };
  }

  const results = [];
  for (const to of recipients) {
    const payload = makeWhatsAppPayload(to, notification);
    if (!payload) {
      results.push({ to, skipped: true, reason: "Configure WHATSAPP_TEMPLATE_NAME or set WHATSAPP_ALLOW_TEXT=true." });
      continue;
    }

    const resp = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await resp.json().catch(() => ({}));
    results.push(resp.ok
      ? { to, ok: true, id: body?.messages?.[0]?.id || null }
      : { to, ok: false, error: body?.error?.message || `WhatsApp error ${resp.status}` });
  }

  return { channel: "whatsapp", results };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return json(res, 405, { error: "Method not allowed" });
    }

    const verified = await verifySupabaseUser(req);
    if (!verified.ok) return json(res, 401, { error: verified.error });

    const body = req.body || {};
    const channels = unique(Array.isArray(body.channels) ? body.channels : [])
      .filter((channel) => ["email", "whatsapp"].includes(channel));
    if (channels.length === 0) return json(res, 400, { error: "At least one channel is required." });

    const notification = makeNotification(body);
    notification.idempotencyKey = body.idempotencyKey;
    const emailRecipients = unique([
      body.task?.assigned_to?.email,
      body.assignedEmail,
      ...(Array.isArray(body.emailRecipients) ? body.emailRecipients : []),
    ].filter(email => String(email || "").includes("@")));

    const results = [];
    if (channels.includes("email")) {
      results.push(await sendEmail(notification, emailRecipients, {
        includeFallbackRecipients: body.includeFallbackRecipients !== false,
      }));
    }
    if (channels.includes("whatsapp")) results.push(await sendWhatsApp(notification));

    return json(res, 200, { ok: true, results });
  } catch (error) {
    return json(res, 502, {
      error: error instanceof Error ? error.message : "Unable to send notification.",
    });
  }
}
