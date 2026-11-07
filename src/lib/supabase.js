import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// Unwraps a Supabase response so callers (and TanStack Query) get data or a thrown error.
export async function unwrap(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
