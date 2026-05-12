import { useCallback, useEffect } from "react";
import { MOCK_USERS } from "../data/mockData.js";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { useLocalStorage } from "./useLocalStorage.js";

const DEMO_PASSWORD = "agencyflow";

const normalizeEmail = (email) => email.trim().toLowerCase();

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role || "admin",
  department: user.department || "Leadership",
  department_id: user.department_id || "d1",
  job_title: user.job_title || "Account Owner",
  skills: user.skills || ["Client Services"],
  avatar_url: user.avatar_url || null,
  agency_id: user.agency_id || null,
  agency_code: user.agency_code || null,
  agency_name: user.agency_name || null,
});

const publicSupabaseUser = (user) => {
  const meta = user.user_metadata || {};
  const name = meta.name || user.email?.split("@")[0] || "User";
  return publicUser({
    id: user.id,
    name,
    email: user.email,
    role: meta.role || "admin",
    department: meta.department || "Leadership",
    department_id: meta.department_id || "d1",
    job_title: meta.job_title || "Account Owner",
    skills: meta.skills || ["Client Services"],
    avatar_url: meta.avatar_url || null,
  });
};

const randomSalt = () => {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}-${Math.random()}`;
};

async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle) return `local:${salt}:${password}`;
  const input = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Generates a random 8-char uppercase agency code, e.g. "NOVA8K2X"
const generateAgencyCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export function useAuth() {
  const [accounts, setAccounts] = useLocalStorage("af_auth_accounts", []);
  const [currentUser, setCurrentUser] = useLocalStorage("af_current_user", null);

  // Fetches agency info and merges it into currentUser.
  // Uses two queries so agency_id is always set even if the agencies join fails.
  const loadUserAgency = useCallback(async (userId) => {
    if (!isSupabaseConfigured || !supabase) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", userId)
      .single();

    if (!profile?.agency_id) return;

    const { data: agency } = await supabase
      .from("agencies")
      .select("id, name, code")
      .eq("id", profile.agency_id)
      .single();

    setCurrentUser(prev => prev ? {
      ...prev,
      agency_id: profile.agency_id,
      agency_code: agency?.code ?? null,
      agency_name: agency?.name ?? null,
    } : null);
  }, [setCurrentUser]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const user = data.session?.user ? publicSupabaseUser(data.session.user) : null;
      setCurrentUser(user);
      if (user) loadUserAgency(user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ? publicSupabaseUser(session.user) : null;
      setCurrentUser(user);
      if (user) loadUserAgency(user.id);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [setCurrentUser, loadUserAgency]);

  const signUp = useCallback(async ({ name, email, password, agencyMode, agencyName, agencyCode }) => {
    const cleanName = name.trim();
    const cleanEmail = normalizeEmail(email);

    if (!cleanName) throw new Error("Enter your name.");
    if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("Enter a valid email address.");
    if (password.length < 6) throw new Error("Use at least 6 characters for your password.");

    if (agencyMode === "create" && !agencyName?.trim()) throw new Error("Enter your agency name.");
    if (agencyMode === "join" && !agencyCode?.trim()) throw new Error("Enter the agency code.");

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            role: agencyMode === "create" ? "admin" : "user",
            department: "Leadership",
            department_id: "d1",
            job_title: "Account Owner",
            skills: ["Client Services"],
          },
        },
      });

      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Sign up failed. Please try again.");

      // Link or create agency
      if (agencyMode === "create") {
        const code = generateAgencyCode();
        const { error: rpcError } = await supabase.rpc("create_agency", {
          p_name: agencyName.trim(),
          p_code: code,
        });
        if (rpcError) throw new Error(rpcError.message);
      } else if (agencyMode === "join") {
        const { error: rpcError } = await supabase.rpc("join_agency", {
          p_code: agencyCode.trim().toUpperCase(),
        });
        if (rpcError) throw new Error(rpcError.message);
      }

      const supabaseUser = publicSupabaseUser(data.user);
      setCurrentUser(supabaseUser);
      await loadUserAgency(data.user.id);
      return;
    }

    // ── Local fallback (no Supabase) ──────────────────────────────────────────
    if (accounts.some((a) => normalizeEmail(a.email) === cleanEmail)) {
      throw new Error("An account already exists for that email.");
    }

    const salt = randomSalt();
    const localAgencyCode = agencyMode === "create" ? generateAgencyCode() : (agencyCode?.trim().toUpperCase() || null);
    const account = {
      id: `auth-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: agencyMode === "create" ? "admin" : "user",
      department: "Leadership",
      department_id: "d1",
      job_title: "Account Owner",
      skills: ["Client Services"],
      avatar_url: null,
      agency_code: localAgencyCode,
      agency_name: agencyMode === "create" ? agencyName?.trim() : null,
      password_salt: salt,
      password_hash: await hashPassword(password, salt),
    };

    setAccounts([...accounts, account]);
    setCurrentUser(publicUser(account));
  }, [accounts, setAccounts, setCurrentUser, loadUserAgency]);

  const signIn = useCallback(async ({ email, password }) => {
    const cleanEmail = normalizeEmail(email);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw new Error(error.message);
      if (data.user) {
        setCurrentUser(publicSupabaseUser(data.user));
        await loadUserAgency(data.user.id);
      }
      return;
    }

    const account = accounts.find((item) => normalizeEmail(item.email) === cleanEmail);

    if (!account) {
      const demoUser = MOCK_USERS.find((user) => normalizeEmail(user.email) === cleanEmail);
      if (demoUser && password === DEMO_PASSWORD) {
        setCurrentUser(publicUser(demoUser));
        return;
      }
      throw new Error("No account found for that email.");
    }

    const hash = await hashPassword(password, account.password_salt);
    if (hash !== account.password_hash) throw new Error("Incorrect password.");
    setCurrentUser(publicUser(account));
  }, [accounts, setCurrentUser, loadUserAgency]);

  const continueAsDemo = useCallback(() => {
    setCurrentUser(publicUser(MOCK_USERS[0]));
  }, [setCurrentUser]);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    }
    setCurrentUser(null);
  }, [setCurrentUser]);

  const setupAgency = useCallback(async ({ agencyMode, agencyName, agencyCode }) => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not connected.");
    if (agencyMode === "create") {
      if (!agencyName?.trim()) throw new Error("Enter your agency name.");
      const code = generateAgencyCode();
      const { error } = await supabase.rpc("create_agency", { p_name: agencyName.trim(), p_code: code });
      if (error) throw new Error(error.message);
    } else {
      if (!agencyCode?.trim()) throw new Error("Enter the agency code.");
      const { error } = await supabase.rpc("join_agency", { p_code: agencyCode.trim().toUpperCase() });
      if (error) throw new Error(error.message);
    }
    // Re-fetch agency info — must be awaited so agency_id is set before the caller returns
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) await loadUserAgency(user.id);
  }, [loadUserAgency]);

  const updateProfile = useCallback(async ({ name, job_title, department, skills }) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.updateUser({
        data: { name, job_title, department, skills },
      });
      if (error) throw new Error(error.message);
      if (data.user) {
        const updated = publicSupabaseUser(data.user);
        setCurrentUser(prev => prev ? { ...updated, agency_id: prev.agency_id, agency_code: prev.agency_code, agency_name: prev.agency_name } : null);
      }
      return;
    }
    setCurrentUser(prev => prev ? { ...prev, name, job_title, department, skills } : null);
  }, [setCurrentUser]);

  return {
    accounts,
    currentUser,
    signIn,
    signUp,
    continueAsDemo,
    signOut,
    updateProfile,
    setupAgency,
  };
}
