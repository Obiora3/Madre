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
  avatar_url: user.avatar_url || null
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
    avatar_url: meta.avatar_url || null
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

export function useAuth() {
  const [accounts, setAccounts] = useLocalStorage("af_auth_accounts", []);
  const [currentUser, setCurrentUser] = useLocalStorage("af_current_user", null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setCurrentUser(data.session?.user ? publicSupabaseUser(data.session.user) : null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ? publicSupabaseUser(session.user) : null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [setCurrentUser]);

  const signUp = useCallback(async ({ name, email, password }) => {
    const cleanName = name.trim();
    const cleanEmail = normalizeEmail(email);

    if (!cleanName) throw new Error("Enter your name.");
    if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("Enter a valid email address.");
    if (password.length < 6) throw new Error("Use at least 6 characters for your password.");
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            role: "admin",
            department: "Leadership",
            department_id: "d1",
            job_title: "Account Owner",
            skills: ["Client Services"]
          }
        }
      });

      if (error) throw new Error(error.message);
      if (data.user) setCurrentUser(publicSupabaseUser(data.user));
      return;
    }

    if (accounts.some((account) => normalizeEmail(account.email) === cleanEmail)) {
      throw new Error("An account already exists for that email.");
    }

    const salt = randomSalt();
    const account = {
      id: `auth-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      role: accounts.length === 0 ? "admin" : "user",
      department: "Leadership",
      department_id: "d1",
      job_title: "Account Owner",
      skills: ["Client Services"],
      avatar_url: null,
      password_salt: salt,
      password_hash: await hashPassword(password, salt)
    };

    setAccounts([...accounts, account]);
    setCurrentUser(publicUser(account));
  }, [accounts, setAccounts, setCurrentUser]);

  const signIn = useCallback(async ({ email, password }) => {
    const cleanEmail = normalizeEmail(email);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) throw new Error(error.message);
      if (data.user) setCurrentUser(publicSupabaseUser(data.user));
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
  }, [accounts, setCurrentUser]);

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

  const updateProfile = useCallback(async ({ name, job_title, department, skills }) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.updateUser({
        data: { name, job_title, department, skills }
      });
      if (error) throw new Error(error.message);
      if (data.user) setCurrentUser(publicSupabaseUser(data.user));
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
    updateProfile
  };
}
