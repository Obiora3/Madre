import fs from "node:fs";
import path from "node:path";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) return;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  });
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

loadEnvFile(path.resolve(process.cwd(), ".env"));
loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.NOTIFICATION_EMAIL_FROM || process.env.RESEND_FROM_EMAIL;
const replyTo = process.env.NOTIFICATION_REPLY_TO || process.env.NOTIFICATION_EMAIL_REPLY_TO;
const to = csv(argValue("--to") || process.env.NOTIFICATION_EMAIL_TO);
const hasPlaceholder = (value) => /your_|example|placeholder/i.test(String(value || ""));

if (!apiKey || !from || to.length === 0 || hasPlaceholder(apiKey) || to.some(hasPlaceholder)) {
  console.error("Resend test email is not configured.");
  console.error("Required env: RESEND_API_KEY, NOTIFICATION_EMAIL_FROM, NOTIFICATION_EMAIL_TO");
  process.exit(1);
}

if (!apiKey.startsWith("re_")) {
  console.error("RESEND_API_KEY should be a Resend API key that starts with re_.");
  process.exit(1);
}

const subject = `Madre Resend test - ${new Date().toISOString()}`;
const bodyText = "Resend is connected to Madre. This is a test notification email.";
const messageKey = `madre-resend-test-${Date.now()}`;
const payload = {
  from,
  to,
  subject,
  text: bodyText,
  html: `<p>${bodyText}</p>`,
};
if (replyTo) payload.reply_to = replyTo;

const response = await fetch(RESEND_ENDPOINT, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Idempotency-Key": messageKey,
  },
  body: JSON.stringify(payload),
});

const result = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(result?.message || result?.error || `Resend API error ${response.status}`);
  process.exit(1);
}

console.log(`Resend test email sent: ${result.id || "sent"}`);
