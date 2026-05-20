import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";

export function useNotifications(currentUser) {
  const [notifications, setNotifications] = useState([]);
  const email = currentUser?.email;

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !email) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_email", email)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications(data || []);
  }, [email]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription — new notifs appear instantly
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !email) return;
    const channel = supabase
      .channel(`notifs:${email}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_email=eq.${email}` },
        ({ new: n }) => setNotifications(prev => [n, ...prev])
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_email=eq.${email}` },
        ({ new: n }) => setNotifications(prev => prev.map(x => x.id === n.id ? n : x))
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notifications", filter: `recipient_email=eq.${email}` },
        ({ old: n }) => setNotifications(prev => prev.filter(x => x.id !== (n?.id)))
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [email]);

  const markRead = useCallback(async (id) => {
    if (!isSupabaseConfigured || !supabase) return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !email) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("recipient_email", email).eq("read", false);
  }, [email]);

  const dismiss = useCallback(async (id) => {
    if (!isSupabaseConfigured || !supabase) return;
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  }, []);

  const dismissAll = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !email) return;
    setNotifications([]);
    await supabase.from("notifications").delete().eq("recipient_email", email);
  }, [email]);

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    markRead,
    markAllRead,
    dismiss,
    dismissAll,
  };
}
