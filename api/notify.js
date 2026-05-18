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
  const fallback = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const url = configured || fallback;
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const notificationMeta = (kind) => ({
  task_assigned: {
    label: "New task assigned",
    intro: "A new task has been assigned to you.",
    action: "Open task",
    accent: "#1F6FEB",
  },
  project_assigned: {
    label: "New project assigned",
    intro: "A new project has been assigned to you.",
    action: "Open project",
    accent: "#0F766E",
  },
  deadline_warning: {
    label: "Deadline warning",
    intro: "A task is approaching its deadline.",
    action: "Review deadline",
    accent: "#B45309",
  },
  escalated: {
    label: "Overdue escalation",
    intro: "A task is overdue and needs attention.",
    action: "Review task",
    accent: "#B91C1C",
  },
  blocked: {
    label: "Blocked task alert",
    intro: "A task is blocked by unfinished work.",
    action: "Review blocker",
    accent: "#7C2D12",
  },
}[kind] || {
  label: "Workspace notification",
  intro: "There is a new workspace notification.",
  action: "Open Madre",
  accent: "#374151",
});

const row = (label, value) => {
  if (value === null || value === undefined || value === "") return null;
  return { label, value: String(value) };
};

function renderRows(rows) {
  return rows.map((item) => `
    <tr>
      <td style="padding:9px 12px 9px 0;color:#667085;font-size:13px;line-height:18px;border-bottom:1px solid #EAECF0;vertical-align:top;width:34%">${escapeHtml(item.label)}</td>
      <td style="padding:9px 0;color:#101828;font-size:13px;line-height:18px;border-bottom:1px solid #EAECF0;vertical-align:top;font-weight:600">${escapeHtml(item.value)}</td>
    </tr>
  `).join("");
}

function renderEmailHtml({ brand, meta, title, message, rows, description, ctaUrl }) {
  const safeBrand = escapeHtml(brand);
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message || meta.intro);
  const safeDescription = escapeHtml(description);
  const safeCtaUrl = escapeHtml(ctaUrl);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F7F9;font-family:Arial,sans-serif;color:#101828">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F7F9;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF;border:1px solid #EAECF0;border-radius:10px;overflow:hidden">
            <tr>
              <td style="padding:18px 24px;border-bottom:1px solid #EAECF0">
                <div style="font-size:13px;line-height:18px;font-weight:700;color:${meta.accent};margin-bottom:8px">${safeBrand}</div>
                <div style="font-size:22px;line-height:28px;font-weight:700;color:#101828;margin-bottom:8px">${escapeHtml(meta.label)}</div>
                <div style="font-size:14px;line-height:20px;color:#475467">${safeMessage}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 24px">
                <div style="font-size:16px;line-height:22px;font-weight:700;color:#101828;margin-bottom:14px">${safeTitle}</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                  ${renderRows(rows)}
                </table>
                ${description ? `
                  <div style="margin-top:16px">
                    <div style="font-size:12px;line-height:16px;font-weight:700;color:#667085;text-transform:uppercase;margin-bottom:6px">Details</div>
                    <div style="font-size:14px;line-height:20px;color:#344054">${safeDescription}</div>
                  </div>
                ` : ""}
                ${ctaUrl ? `
                  <div style="margin-top:22px">
                    <a href="${safeCtaUrl}" style="display:inline-block;background:${meta.accent};color:#FFFFFF;text-decoration:none;border-radius:7px;padding:11px 16px;font-size:14px;line-height:18px;font-weight:700">${escapeHtml(meta.action)}</a>
                  </div>
                ` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#F9FAFB;border-top:1px solid #EAECF0;color:#667085;font-size:12px;line-height:18px">
                Sent by ${safeBrand}. You received this because assignment notifications are enabled for your workspace.
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
  const detailLines = rows.map((item) => `${item.label}: ${item.value}`);
  const ctaUrl = appUrl();

  const subject = truncate(`${brand}: ${meta.label} - ${title}`, 140);
  const text = truncate([
    `${meta.label}: ${title}`,
    input.message || meta.intro,
    ...detailLines,
    description ? `Details: ${description}` : null,
    ctaUrl ? `Open in ${brand}: ${ctaUrl}` : null,
  ].filter(Boolean).join("\n"));
  const html = renderEmailHtml({
    brand,
    meta,
    title,
    message: input.message,
    rows,
    description,
    ctaUrl,
  });

  return { kind, subject, text, html, variables: { label: meta.label, title, project: project.title || "-", due: task.due_date || "-" } };
}

async function sendEmail(notification, recipients, { includeFallbackRecipients = true } = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_EMAIL_FROM || process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.NOTIFICATION_REPLY_TO || process.env.NOTIFICATION_EMAIL_REPLY_TO;
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

  const messageKey = idempotencyKey(
    notification.idempotencyKey,
    `madre-${notification.kind}-${Date.now()}`
  );
  const payload = {
    from,
    to,
    subject: notification.subject,
    html: notification.html,
    text: notification.text,
  };
  if (replyTo) payload.reply_to = replyTo;

  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": messageKey,
    },
    body: JSON.stringify(payload),
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
