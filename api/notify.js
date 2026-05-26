const MAX_MESSAGE_LENGTH = 1600;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const csv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const unique = (items) => [...new Set(items.filter(Boolean))];

const json = (res, status, payload) => res.status(status).json(payload);

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

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
  const fallback = "https://madre.com.ng";
  const url = configured || fallback;
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const absoluteUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const logoUrl = () => {
  const configured = absoluteUrl(process.env.NOTIFICATION_LOGO_URL || process.env.NOTIFICATION_BRAND_LOGO_URL);
  if (configured) return configured;
  const base = appUrl().replace(/\/+$/, "");
  return base ? `${base}/logo.png` : "";
};

const notificationMeta = (kind) => ({
  task_assigned: {
    label: "New Task Assigned",
    action: "Open Task",
    accent: "#1F6FEB",
  },
  project_assigned: {
    label: "New Project Assigned",
    action: "Open Project",
    accent: "#0F766E",
  },
  deadline_warning: {
    label: "Deadline Approaching",
    action: "Review Task",
    accent: "#B45309",
  },
  escalated: {
    label: "Task Overdue",
    action: "Review Task",
    accent: "#B91C1C",
  },
  blocked: {
    label: "Task Blocked",
    action: "Review Blockers",
    accent: "#7C2D12",
  },
}[kind] || {
  label: "Workspace Notification",
  action: "Open Workspace",
  accent: "#374151",
});

// Builds a narrative paragraph tailored to the notification kind and available data.
function makeNarrative({ kind, task, project }) {
  const taskName  = task?.title  ? `<strong>${escapeHtml(task.title)}</strong>`  : "A task";
  const projName  = project?.title ? `<strong>${escapeHtml(project.title)}</strong>` : null;
  const client    = project?.client_name ? `<strong>${escapeHtml(project.client_name)}</strong>` : null;
  const dueDate   = task?.due_date || project?.due_date;
  const prettyDue = dueDate ? `<strong>${escapeHtml(prettyDate(dueDate))}</strong>` : null;
  const priority  = task?.priority || project?.priority;
  const stage     = project?.stage;
  const budget    = money(project?.budget);
  const startDate = project?.start_date ? prettyDate(project.start_date) : null;

  const projectCtx = projName ? ` on the ${projName} project` : "";
  const clientCtx  = client  ? ` for ${client}` : "";

  switch (kind) {
    case "task_assigned": {
      const parts = [
        `You've been assigned a new task${projectCtx}${clientCtx}.`,
      ];
      if (priority && priority.toLowerCase() !== "medium") {
        parts.push(`This task carries a <strong>${escapeHtml(priority)}</strong> priority — please plan your schedule accordingly.`);
      }
      if (prettyDue) {
        parts.push(`It's due on ${prettyDue}, so take a moment to review the details below and reach out if anything is unclear.`);
      } else {
        parts.push(`Take a moment to review the details below and get in touch if you have any questions before getting started.`);
      }
      return parts.join(" ");
    }

    case "project_assigned": {
      const parts = [
        `You've been assigned to lead${projName ? ` the ${projName} project` : " a new project"}${clientCtx}.`,
      ];
      if (stage) parts.push(`The project is currently in the <strong>${escapeHtml(stage)}</strong> stage.`);
      const timeline = [
        startDate ? `It kicks off on <strong>${escapeHtml(startDate)}</strong>` : null,
        prettyDue ? `with a target delivery of ${prettyDue}` : null,
      ].filter(Boolean).join(" ");
      if (timeline) parts.push(`${timeline}.`);
      if (budget) parts.push(`The approved budget is <strong>${escapeHtml(budget)}</strong>.`);
      parts.push("Review the full project details below and don't hesitate to reach out with any questions.");
      return parts.join(" ");
    }

    case "deadline_warning": {
      const parts = [
        prettyDue
          ? `${taskName} is due on ${prettyDue}${projectCtx} — the deadline is coming up soon.`
          : `${taskName} has an upcoming deadline${projectCtx} that needs your attention.`,
        "Now's a great time to review where things stand and make sure you're on track to deliver.",
        "If you've hit a blocker or need more time, flag it early so the team can help.",
      ];
      return parts.join(" ");
    }

    case "escalated": {
      const parts = [
        prettyDue
          ? `${taskName} was due on ${prettyDue}${projectCtx} and hasn't been marked complete yet.`
          : `${taskName} is overdue${projectCtx} and needs your attention.`,
        "Please review this task as soon as possible — update its status, log your progress, or flag any blockers so the team can step in.",
      ];
      return parts.join(" ");
    }

    case "blocked": {
      const parts = [
        `${taskName} can't move forward right now${projectCtx} — it's waiting on other work to be completed first.`,
        "Take a look at the dependencies below and coordinate with whoever owns the blocking tasks.",
        "Once those are resolved, this task will be ready to progress.",
      ];
      return parts.join(" ");
    }

    default:
      return `There's a new update${projectCtx}${clientCtx} in your workspace that needs your attention.`;
  }
}

const row = (label, value) => {
  if (value === null || value === undefined || value === "") return null;
  return { label, value: String(value) };
};

function renderRows(rows) {
  return rows.map((item, i) => `
    <tr>
      <td style="padding:10px 14px 10px 0;color:#667085;font-size:13px;line-height:18px;${i < rows.length - 1 ? "border-bottom:1px solid #F2F4F7;" : ""}vertical-align:top;width:38%;white-space:nowrap">${escapeHtml(item.label)}</td>
      <td style="padding:10px 0;color:#101828;font-size:13px;line-height:18px;${i < rows.length - 1 ? "border-bottom:1px solid #F2F4F7;" : ""}vertical-align:top;font-weight:600">${escapeHtml(item.value)}</td>
    </tr>
  `).join("");
}

function renderEmailHtml({ brand, meta, narrative, rows, description, ctaUrl, logo, recipientName }) {
  const safeBrand  = escapeHtml(brand);
  const safeCtaUrl = escapeHtml(ctaUrl);
  const safeLogo   = escapeHtml(logo);
  const greeting   = recipientName ? `Hi ${escapeHtml(recipientName)},` : "Hi there,";

  return `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:'Helvetica Neue',Arial,sans-serif;color:#101828;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F0F2F5;padding:36px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E4E7EC">

        <!-- Brand header -->
        <tr>
          <td style="padding:24px 28px 20px;border-bottom:3px solid ${meta.accent}">
            ${logo
              ? `<img src="${safeLogo}" alt="${safeBrand}" height="40" style="display:block;height:40px;width:auto;max-width:140px;border:0;margin-bottom:14px" />`
              : `<div style="font-size:15px;font-weight:800;color:${meta.accent};letter-spacing:0.05em;text-transform:uppercase;margin-bottom:14px">${safeBrand}</div>`
            }
            <span style="display:inline-block;background:${meta.accent}18;color:${meta.accent};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;padding:4px 12px;border-radius:20px">${escapeHtml(meta.label)}</span>
          </td>
        </tr>

        <!-- Narrative body -->
        <tr>
          <td style="padding:28px 28px 20px">
            <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#344054;font-weight:500">${greeting}</p>
            <p style="margin:0;font-size:15px;line-height:27px;color:#344054">${narrative}</p>
          </td>
        </tr>

        <!-- Details table -->
        ${rows.length > 0 ? `
        <tr>
          <td style="padding:0 28px 24px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#98A2B3;margin-bottom:10px">Details</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#F9FAFB;border:1px solid #EAECF0;border-radius:10px;padding:4px 16px;overflow:hidden">
              <tr><td style="padding:4px 0"></td></tr>
              ${renderRows(rows)}
              <tr><td style="padding:4px 0"></td></tr>
            </table>
          </td>
        </tr>` : ""}

        <!-- Notes / description -->
        ${description ? `
        <tr>
          <td style="padding:0 28px 24px">
            <div style="background:#F9FAFB;border-left:3px solid ${meta.accent};border-radius:0 8px 8px 0;padding:14px 18px">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#98A2B3;margin-bottom:6px">Notes</div>
              <div style="font-size:14px;line-height:22px;color:#344054">${escapeHtml(description)}</div>
            </div>
          </td>
        </tr>` : ""}

        <!-- CTA -->
        ${ctaUrl ? `
        <tr>
          <td style="padding:0 28px 32px">
            <a href="${safeCtaUrl}" style="display:inline-block;background:${meta.accent};color:#FFFFFF;text-decoration:none;border-radius:8px;padding:13px 24px;font-size:14px;font-weight:700;letter-spacing:0.01em">${escapeHtml(meta.action)} &rarr;</a>
          </td>
        </tr>` : ""}

        <!-- Footer -->
        <tr>
          <td style="padding:18px 28px;background:#F9FAFB;border-top:1px solid #EAECF0">
            <p style="margin:0;font-size:12px;line-height:18px;color:#98A2B3">Sent by <strong style="color:#667085">${safeBrand}</strong>. You're receiving this because workspace notifications are enabled for your account.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function recipientMap(input) {
  const entries = [
    input.task?.assigned_to,
    input.project?.assigned_to,
    ...(Array.isArray(input.recipientUsers) ? input.recipientUsers : []),
  ];
  return entries.reduce((map, user) => {
    const email = normalizeEmail(user?.email);
    const name = String(user?.name || "").trim();
    if (email && name) map[email] = name;
    return map;
  }, {});
}

function personalizeNotification(notification, recipientName) {
  const greeting  = recipientName ? `Hi ${recipientName},` : "Hi there,";
  // Plain-text version strips HTML from the narrative
  const plainNarrative = (notification.narrative || "")
    .replace(/<strong>/gi, "").replace(/<\/strong>/gi, "")
    .replace(/<[^>]+>/g, "");
  return {
    subject: notification.subject,
    text: truncate([
      greeting,
      "",
      plainNarrative,
      "",
      ...notification.detailLines,
      notification.description ? `\nNotes: ${notification.description}` : null,
      notification.ctaUrl ? `\nOpen in ${notification.brand}: ${notification.ctaUrl}` : null,
    ].filter((l) => l !== null).join("\n")),
    html: renderEmailHtml({
      brand: notification.brand,
      meta: notification.meta,
      narrative: notification.narrative,
      rows: notification.rows,
      description: notification.description,
      ctaUrl: notification.ctaUrl,
      logo: notification.logo,
      recipientName,
    }),
  };
}

function makeNotification(input) {
  const kind    = input.kind || "notification";
  const task    = input.task    || {};
  const project = input.project || {};
  const title   = task.title || project.title || input.title || "Madre notification";
  const meta    = notificationMeta(kind);
  const brand   = process.env.NOTIFICATION_BRAND_NAME || "Madre";
  const description = task.description || project.description || "";

  const rows = [
    task.title ? row("Task",         task.title)   : row("Project", title),
    task.title ? row("Project",      project.title) : null,
    row("Client",         project.client_name),
    row("Status",         task.status    || project.status),
    row("Priority",       task.priority  || project.priority),
    row("Stage",          project.stage),
    row("Start date",     prettyDate(project.start_date)),
    row("Due date",       prettyDate(task.due_date || project.due_date)),
    row("Estimated",      task.estimated_hours ? `${task.estimated_hours} hrs` : ""),
    row("Budget",         money(project.budget)),
    row("Assigned to",    task.assigned_to?.name || project.assigned_to?.name),
  ].filter(Boolean);

  const detailLines   = rows.map((item) => `${item.label}: ${item.value}`);
  const narrative     = makeNarrative({ kind, task, project });
  const ctaUrl        = appUrl();
  const logo          = logoUrl();
  const recipientNames = recipientMap(input);
  const subject       = truncate(`${brand}: ${meta.label} — ${title}`, 140);

  const notification = {
    kind, subject, brand, meta, title, narrative,
    rows, detailLines, description, ctaUrl, logo, recipientNames,
    variables: { label: meta.label, title, project: project.title || "-", due: task.due_date || "-" },
  };
  return { ...notification, ...personalizeNotification(notification) };
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

  const results = [];
  for (const recipient of to) {
    const recipientName = notification.recipientNames?.[normalizeEmail(recipient)] || "";
    const personalized = personalizeNotification(notification, recipientName);
    const payload = {
      from,
      to: [recipient],
      subject: personalized.subject,
      html: personalized.html,
      text: personalized.text,
    };
    if (replyTo) payload.reply_to = replyTo;

    const resp = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey(`${messageKey}:${recipient}`, messageKey),
      },
      body: JSON.stringify(payload),
    });

    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      results.push({
        to: recipient,
        ok: false,
        error: body?.message || body?.error || `Resend error ${resp.status}`,
      });
      continue;
    }
    results.push({ to: recipient, ok: true, id: body.id });
  }

  const failed = results.find((result) => !result.ok);
  if (failed) {
    return { channel: "email", ok: false, error: failed.error, results };
  }

  return {
    channel: "email",
    ok: true,
    id: results[0]?.id || null,
    ids: results.map((result) => result.id).filter(Boolean),
    recipientCount: results.length,
    results,
  };
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

async function sendWhatsApp(notification, { assigneePhone = "" } = {}) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v25.0";
  // Merge the static fallback list with the assignee's own number (if stored on their profile).
  const envRecipients = csv(process.env.NOTIFICATION_WHATSAPP_TO);
  const recipients = unique([...envRecipients, ...(assigneePhone ? [assigneePhone] : [])]);

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

    // Assignee's WhatsApp number — stored on their profile and forwarded here
    // by the automation hook so messages go directly to the right person.
    const assigneePhone = String(body.task?.assigned_to?.phone || "").trim();

    const results = [];
    if (channels.includes("email")) {
      results.push(await sendEmail(notification, emailRecipients, {
        includeFallbackRecipients: body.includeFallbackRecipients !== false,
      }));
    }
    if (channels.includes("whatsapp")) results.push(await sendWhatsApp(notification, { assigneePhone }));

    return json(res, 200, { ok: true, results });
  } catch (error) {
    return json(res, 502, {
      error: error instanceof Error ? error.message : "Unable to send notification.",
    });
  }
}
