import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

export async function createNotification({ agencyId, recipientEmail, type, title, body = "", entityType = null, entityId = null }) {
  if (!isSupabaseConfigured || !supabase || !recipientEmail || !agencyId) return;
  try {
    await supabase.from("notifications").insert({
      agency_id: agencyId,
      recipient_email: recipientEmail,
      type,
      title,
      body: body || "",
      entity_type: entityType || null,
      entity_id: entityId ? String(entityId) : null,
    });
  } catch { /* non-blocking — notification failure must never break the main action */ }
}
