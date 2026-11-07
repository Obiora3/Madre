import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, unwrap } from "../lib/supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user?.id;

  const memberQuery = useQuery({
    queryKey: ["me", userId],
    enabled: Boolean(userId),
    queryFn: () =>
      unwrap(supabase.from("members").select("*, workspace:workspaces(*)").eq("id", userId).single()),
  });

  const value = {
    session,
    loading: session === undefined || (Boolean(userId) && memberQuery.isPending),
    error: memberQuery.error,
    me: memberQuery.data ?? null,
    workspace: memberQuery.data?.workspace ?? null,
    isAdmin: memberQuery.data?.role === "admin",
    recovering,
    finishRecovery: () => setRecovering(false),
    refreshMe: () => queryClient.invalidateQueries({ queryKey: ["me", userId] }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
