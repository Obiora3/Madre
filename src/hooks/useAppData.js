import { useCallback, useEffect, useRef, useState } from "react";
import {
  MOCK_CLIENTS, MOCK_DEPARTMENTS, MOCK_KPIS,
  MOCK_PITCHES, MOCK_PROJECTS, MOCK_TASKS, MOCK_USERS
} from "../data/mockData.js";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { useLocalStorage } from "./useLocalStorage.js";

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function fetchTable(table) {
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: true });
  if (error) { console.warn(`[data] fetch ${table}:`, error.message); return []; }
  return data ?? [];
}

// Convert empty strings to null — required for date, FK, and other typed columns
// that reject "" but accept null. Safe because all required fields are validated
// non-empty in the UI before calling setXxx.
const sanitize = obj => Object.fromEntries(
  Object.entries(obj).map(([k, v]) => [k, v === "" ? null : v])
);

async function syncCollection(table, oldItems, newItems, agencyId) {
  if (!agencyId) return;

  const oldMap = new Map(oldItems.map(i => [i.id, i]));
  const newMap = new Map(newItems.map(i => [i.id, i]));

  const toUpsert = newItems
    .filter(item => {
      const prev = oldMap.get(item.id);
      return !prev || JSON.stringify(prev) !== JSON.stringify(item);
    })
    .map(item => sanitize({ ...item, agency_id: agencyId }));

  const toDelete = oldItems.filter(i => !newMap.has(i.id)).map(i => i.id);

  if (toUpsert.length > 0) {
    const { error } = await supabase.from(table).upsert(toUpsert);
    if (error) {
      console.error(`[sync] upsert ${table}:`, error.message, error);
      window.dispatchEvent(new CustomEvent("af-sync-error", { detail: error.message }));
    }
  }
  if (toDelete.length > 0) {
    const { error } = await supabase.from(table).delete().in("id", toDelete);
    if (error) {
      console.error(`[sync] delete ${table}:`, error.message, error);
      window.dispatchEvent(new CustomEvent("af-sync-error", { detail: error.message }));
    }
  }
}

const TABLES = ["projects", "tasks", "clients", "kpis", "departments", "pitches"];
const LS_DEFAULTS = {
  projects: [], tasks: [], clients: [], kpis: [], departments: [], pitches: [],
};
const LS_KEYS = {
  projects: "af_projects", tasks: "af_tasks", clients: "af_clients",
  kpis: "af_kpis", departments: "af_departments", pitches: "af_pitches",
};
// Insertion order respects FK constraints (clients/departments before projects, projects before tasks/kpis)
const MIGRATION_ORDER = ["clients", "departments", "projects", "tasks", "kpis", "pitches"];

const EMPTY = { projects: [], tasks: [], clients: [], kpis: [], departments: [], pitches: [] };

// ── One-time localStorage → Supabase migration ────────────────────────────────
// Runs once per agency per browser. Only migrates tables that are empty in Supabase.
// Generates new UUIDs for mock-style IDs (p1, c2, t3 …) to avoid cross-agency collisions.
// Uses name-matching to remap client FKs when Supabase clients have different IDs.

async function migrateLocalData(agencyId, dbSnapshot) {
  // v2: bumped so previous incomplete migrations are retried
  const migKey = `af_migrated_v2_${agencyId}`;
  if (localStorage.getItem(migKey)) return dbSnapshot;

  const emptyTables = MIGRATION_ORDER.filter(t => !dbSnapshot[t]?.length);
  // Clear any old migration flag from previous version
  localStorage.removeItem(`af_migrated_${agencyId}`);
  if (!emptyTables.length) { localStorage.setItem(migKey, "1"); return dbSnapshot; }

  const isMockId = id => /^[a-zA-Z]{1,3}\d{1,3}$/.test(String(id ?? ""));
  const idMap = {};
  const staged = {};

  for (const table of emptyTables) {
    let items;
    try { items = JSON.parse(localStorage.getItem(LS_KEYS[table]) ?? "null") ?? LS_DEFAULTS[table]; }
    catch { items = LS_DEFAULTS[table]; }
    staged[table] = items.map(item => {
      const newId = isMockId(item.id) ? crypto.randomUUID() : item.id;
      idMap[item.id] = newId;
      return sanitize({ ...item, id: newId, agency_id: agencyId });
    });
  }

  // Load localStorage clients for name-based FK resolution
  let lsClients;
  try { lsClients = JSON.parse(localStorage.getItem(LS_KEYS.clients) ?? "null") ?? LS_DEFAULTS.clients; }
  catch { lsClients = LS_DEFAULTS.clients; }

  const resolveClientId = localId => {
    if (!localId) return null;
    if (dbSnapshot.clients?.some(c => c.id === localId)) return localId;
    if (idMap[localId]) return idMap[localId];
    const lsClient = lsClients.find(c => c.id === localId);
    if (lsClient) {
      const sbClient = dbSnapshot.clients?.find(c => c.name === lsClient.name);
      if (sbClient) return sbClient.id;
    }
    return null;
  };

  const resolveProjectId = localId => {
    if (!localId) return null;
    if (dbSnapshot.projects?.some(p => p.id === localId)) return localId;
    return idMap[localId] ?? null;
  };

  if (staged.projects) {
    staged.projects = staged.projects.map(p => ({ ...p, client_id: resolveClientId(p.client_id) }));
  }
  if (staged.tasks) {
    staged.tasks = staged.tasks.map(t => ({
      ...t,
      project_id: resolveProjectId(t.project_id),
      depends_on: t.depends_on ? (idMap[t.depends_on] ?? t.depends_on) : null,
    }));
  }
  if (staged.kpis) {
    staged.kpis = staged.kpis.map(k => ({ ...k, project_id: resolveProjectId(k.project_id) }));
  }

  for (const table of MIGRATION_ORDER) {
    if (!staged[table]?.length) continue;
    const { error } = await supabase.from(table).insert(staged[table]);
    if (error) console.warn(`[data] migrate ${table}:`, error.message);
  }

  localStorage.setItem(migKey, "1");

  const refreshed = { ...dbSnapshot };
  await Promise.all(emptyTables.map(async t => { refreshed[t] = await fetchTable(t); }));
  return refreshed;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAppData(agencyId) {
  const live = isSupabaseConfigured && Boolean(agencyId);

  // ── localStorage fallback ─────────────────────────────────────────────────
  const [lsProjects,    setLsProjects]    = useLocalStorage("af_projects",    []);
  const [lsTasks,       setLsTasks]       = useLocalStorage("af_tasks",       []);
  const [lsClients,     setLsClients]     = useLocalStorage("af_clients",     []);
  const [lsKpis,        setLsKpis]        = useLocalStorage("af_kpis",        []);
  const [lsDepartments, setLsDepartments] = useLocalStorage("af_departments", []);
  const [lsPitches,     setLsPitches]     = useLocalStorage("af_pitches",     []);

  // ── Supabase state ────────────────────────────────────────────────────────
  const [db, setDb]           = useState(EMPTY);
  const [dbUsers, setDbUsers] = useState(MOCK_USERS);
  const [loading, setLoading] = useState(false);
  const loadedRef             = useRef(null);
  const dbRef                 = useRef(EMPTY);

  useEffect(() => { dbRef.current = db; }, [db]);

  // Initial load + one-time migration when agency changes
  useEffect(() => {
    if (!live) return;
    if (loadedRef.current === agencyId) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const [projects, tasks, clients, kpis, departments, pitches, profiles] = await Promise.all([
        ...TABLES.map(fetchTable),
        supabase.from("profiles").select("*").then(r => r.data ?? []),
      ]);
      if (cancelled) return;

      let next = { projects, tasks, clients, kpis, departments, pitches };
      next = await migrateLocalData(agencyId, next);
      if (cancelled) return;

      setDb(next);
      dbRef.current = next;
      if (profiles.length) setDbUsers(profiles);
      loadedRef.current = agencyId;
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [live, agencyId]);

  // Realtime: subscribe to all table changes so every agency member sees updates instantly
  useEffect(() => {
    if (!live) return;

    const channels = TABLES.map(table =>
      supabase
        .channel(`agency_${agencyId}_${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          fetchTable(table).then(rows => {
            setDb(prev => {
              const next = { ...prev, [table]: rows };
              dbRef.current = next;
              return next;
            });
          });
        })
        .subscribe()
    );

    // Subscribe to profiles so team member profile edits are reflected immediately
    const profilesChannel = supabase
      .channel(`agency_${agencyId}_profiles`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        supabase.from("profiles").select("*").then(r => {
          if (r.data?.length) setDbUsers(r.data);
        });
      })
      .subscribe();

    return () => {
      channels.forEach(c => supabase.removeChannel(c));
      supabase.removeChannel(profilesChannel);
    };
  }, [live, agencyId]);

  // ── Setters — write to Supabase when live, localStorage otherwise ─────────
  const setProjects = useCallback((v) => {
    if (isSupabaseConfigured && agencyId) {
      syncCollection("projects", dbRef.current.projects, v, agencyId);
      setDb(p => { const n = { ...p, projects: v }; dbRef.current = n; return n; });
    } else { setLsProjects(v); }
  }, [agencyId, setLsProjects]);

  const setTasks = useCallback((v) => {
    if (isSupabaseConfigured && agencyId) {
      syncCollection("tasks", dbRef.current.tasks, v, agencyId);
      setDb(p => { const n = { ...p, tasks: v }; dbRef.current = n; return n; });
    } else { setLsTasks(v); }
  }, [agencyId, setLsTasks]);

  const setClients = useCallback((v) => {
    if (isSupabaseConfigured && agencyId) {
      syncCollection("clients", dbRef.current.clients, v, agencyId);
      setDb(p => { const n = { ...p, clients: v }; dbRef.current = n; return n; });
    } else { setLsClients(v); }
  }, [agencyId, setLsClients]);

  const setKpis = useCallback((v) => {
    if (isSupabaseConfigured && agencyId) {
      syncCollection("kpis", dbRef.current.kpis, v, agencyId);
      setDb(p => { const n = { ...p, kpis: v }; dbRef.current = n; return n; });
    } else { setLsKpis(v); }
  }, [agencyId, setLsKpis]);

  const setDepartments = useCallback((v) => {
    if (isSupabaseConfigured && agencyId) {
      syncCollection("departments", dbRef.current.departments, v, agencyId);
      setDb(p => { const n = { ...p, departments: v }; dbRef.current = n; return n; });
    } else { setLsDepartments(v); }
  }, [agencyId, setLsDepartments]);

  const setPitches = useCallback((v) => {
    if (isSupabaseConfigured && agencyId) {
      syncCollection("pitches", dbRef.current.pitches, v, agencyId);
      setDb(p => { const n = { ...p, pitches: v }; dbRef.current = n; return n; });
    } else { setLsPitches(v); }
  }, [agencyId, setLsPitches]);

  const resetAllData = useCallback(async () => {
    if (isSupabaseConfigured && agencyId) {
      await Promise.all(TABLES.map(t =>
        supabase.from(t).delete().eq("agency_id", agencyId)
      ));
      // Clear localStorage data and migration flag so nothing gets re-migrated
      TABLES.forEach(t => localStorage.removeItem(LS_KEYS[t]));
      localStorage.removeItem(`af_migrated_v2_${agencyId}`);
      localStorage.removeItem(`af_migrated_${agencyId}`);
      setLsProjects([]); setLsTasks([]);
      setLsClients([]);  setLsKpis([]);
      setLsDepartments([]); setLsPitches([]);
      setDb(EMPTY);
      dbRef.current = EMPTY;
      loadedRef.current = null;
    } else {
      TABLES.forEach(t => localStorage.removeItem(LS_KEYS[t]));
      setLsProjects([]); setLsTasks([]);
      setLsClients([]);  setLsKpis([]);
      setLsDepartments([]); setLsPitches([]);
    }
  }, [agencyId, setLsProjects, setLsTasks, setLsClients, setLsKpis, setLsDepartments, setLsPitches]);

  const active = live ? db : {
    projects: lsProjects, tasks: lsTasks, clients: lsClients,
    kpis: lsKpis, departments: lsDepartments, pitches: lsPitches,
  };

  return {
    ...active,
    setProjects, setTasks, setClients, setKpis, setDepartments, setPitches,
    users: live ? dbUsers : MOCK_USERS,
    resetAllData,
    loading,
  };
}
