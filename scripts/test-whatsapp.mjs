/**
 * Madre — WhatsApp smoke test
 *
 * Usage:
 *   npm run test:whatsapp
 *   npm run test:whatsapp -- --to 2348012345678
 *
 * Reads credentials from .env / .env.local.
 * Sends a template message if WHATSAPP_TEMPLATE_NAME is set,
 * otherwise sends plain text if WHATSAPP_ALLOW_TEXT=true.
 */

import fs from "node:fs";
import path from "node:path";

// ── Env loader ────────────────────────────────────────────────────────────────
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  });
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function csv(value) {
  return String(value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

const hasPlaceholder = (v) => /your_|example|placeholder/i.test(String(v || ""));

loadEnvFile(path.resolve(process.cwd(), ".env"));
loadEnvFile(path.resolve(process.cwd(), ".env.local"));

// ── Config ────────────────────────────────────────────────────────────────────
const token        = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId      = process.env.WHATSAPP_PHONE_NUMBER_ID;
const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v25.0";
const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
const templateLang = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
const allowText    = process.env.WHATSAPP_ALLOW_TEXT === "true";
const envRecipients = csv(process.env.NOTIFICATION_WHATSAPP_TO);

// --to flag overrides the recipient list for this test run
const recipients = argValue("--to") ? [argValue("--to")] : envRecipients;

// ── Validation ────────────────────────────────────────────────────────────────
const errors = [];
if (!token || hasPlaceholder(token))   errors.push("WHATSAPP_ACCESS_TOKEN is not set");
if (!phoneId || hasPlaceholder(phoneId)) errors.push("WHATSAPP_PHONE_NUMBER_ID is not set");
if (recipients.length === 0)           errors.push("No recipient — set NOTIFICATION_WHATSAPP_TO or pass --to <number>");
if (!templateName && !allowText)       errors.push("Set WHATSAPP_TEMPLATE_NAME (recommended) or WHATSAPP_ALLOW_TEXT=true");

if (errors.length > 0) {
  errors.forEach((e) => console.error("  ✗", e));
  console.error("\nFix the above issues in .env.local, then retry.");
  process.exit(1);
}

// ── Build payload ─────────────────────────────────────────────────────────────
const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function makePayload(to) {
  if (templateName) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Test Alert" },
              { type: "text", text: "Madre smoke test" },
              { type: "text", text: "Madre" },
              { type: "text", text: now },
            ],
          },
        ],
      },
    };
  }

  // Plain text fallback (only works with WHATSAPP_ALLOW_TEXT=true and existing conversations)
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: `✅ Madre WhatsApp test — ${now}\n\nThis message confirms your WhatsApp integration is working correctly.`,
    },
  };
}

// ── Send ──────────────────────────────────────────────────────────────────────
const endpoint = `https://graph.facebook.com/${graphVersion}/${phoneId}/messages`;
const mode = templateName ? `template "${templateName}"` : "plain text";

console.log(`\nMadre WhatsApp smoke test`);
console.log(`Mode       : ${mode}`);
console.log(`Recipients : ${recipients.join(", ")}`);
console.log(`Endpoint   : ${endpoint}\n`);

let allOk = true;

for (const to of recipients) {
  const payload = makePayload(to);
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await resp.json().catch(() => ({}));

  if (resp.ok) {
    const msgId = body?.messages?.[0]?.id || "sent";
    console.log(`  ✓ ${to}  →  ${msgId}`);
  } else {
    const errMsg = body?.error?.message || body?.error?.error_data?.details || `HTTP ${resp.status}`;
    const errCode = body?.error?.code ? ` (code ${body.error.code})` : "";
    console.error(`  ✗ ${to}  →  ${errMsg}${errCode}`);
    allOk = false;
  }
}

if (!allOk) {
  console.error("\nOne or more messages failed. Common causes:");
  console.error("  • Access token expired — regenerate in Meta Business Manager");
  console.error("  • Phone number not added as a test recipient in API Setup");
  console.error("  • Template not approved or name mismatch");
  console.error("  • Number format wrong — use international format without +, e.g. 2348012345678");
  process.exit(1);
}

console.log("\nAll messages sent successfully.");
