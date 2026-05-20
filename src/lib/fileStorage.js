import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

export const formatFileSize = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return `${size.toFixed(unit > 0 ? 1 : 0)} ${units[unit]}`;
};

export const fileIcon = (mimeType) => {
  if (!mimeType) return "📄";
  if (mimeType.startsWith("image/")) return "🖼";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📕";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "📊";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "📋";
  if (mimeType.includes("zip") || mimeType.includes("compress") || mimeType.includes("archive")) return "🗜";
  if (mimeType.startsWith("text/")) return "📃";
  return "📄";
};

export async function fetchFiles(agencyId) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function uploadFiles({ files, agencyId, category = "general", departmentName = null, projectId = null, description = "", currentUser }) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured");
  const results = [];
  for (const file of files) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const storagePath = `${agencyId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("agency-files")
      .upload(storagePath, file);
    if (uploadError) throw uploadError;
    const record = {
      agency_id: agencyId,
      name: file.name,
      description,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      category,
      department_name: departmentName || null,
      project_id: projectId || null,
      uploaded_by_name: currentUser?.name || "",
      uploaded_by_email: currentUser?.email || "",
    };
    const { data, error: dbError } = await supabase
      .from("files")
      .insert(record)
      .select()
      .single();
    if (dbError) throw dbError;
    results.push(data);
  }
  return results;
}

export async function deleteFile(fileRecord) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured");
  await supabase.storage.from("agency-files").remove([fileRecord.storage_path]);
  const { error } = await supabase.from("files").delete().eq("id", fileRecord.id);
  if (error) throw error;
}

export async function getSignedUrl(storagePath) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.storage
    .from("agency-files")
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
