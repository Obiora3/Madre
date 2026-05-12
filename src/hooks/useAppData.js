import { useCallback, useEffect, useRef, useState } from "react";
import {
  MOCK_CLIENTS, MOCK_DEPARTMENTS, MOCK_KPIS,
  MOCK_PITCHES, MOCK_PROJECTS, MOCK_TASKS, MOCK_USERS
} from "../data/mockData.js";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { useLocalStorage } from "./useLocalStorage.js";

const TABLES = ["projects", "tasks", "clients", "kpis", "departments", "pitches"];

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function fetchTable(table) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) { console.warn(`[useAppData] fetch ${table}:`, error.message); return []; }
  return data ?? [];
}

async function syncCollection(table, oldItems, newItems, agencyId) {
  const oldMap = new Map(oldItems.map(i => [i.id, i]));
  const newMap = new Map(newItems.map(i => [i.id, i]));

  const toUpsert = newItems.filter(item => {
    const old = oldMap.get(item.id);
    return !old || JSON.stringify(old) !== JSON.stringify(item);
  }).map(item => ({ ...item, agency_id: agencyId }));

  const toDelete = oldItems.filter(i => !newMap.has(i.id)).map(i => i.id);

  if (toUpsert.length > 0) {
    const { error } = await supabase.from(table).upsert(toUpsert);
    if (error) console.warn(`[useAppData] upsert ${table}:`, error.message);
  }
  if (toDelete.length > 0) {
    const { error } = await supabase.from(table).delete().in("id", toDelete);
    if (error) console.warn(`[useAppData] delete ${table}:`, error.message);
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAppData(agencyId) {
  const useSupabase = isSupabaseConfigured && Boolean(agencyId);

  // ── localStorage fallback ─────────────────────────────────────────────────
  const [lsProjects,    setLsProjects]    = useLocalStorage("af_projects",    MOCK_PROJECTS);
  const [lsTasks,       setLsTasks]       = useLocalStorage("af_tasks",       MOCK_TASKS);
  const [lsClients,     setLsClients]     = useLocalStorage("af_clients",     MOCK_CLIENTS);
  const [lsKpis,        setLsKpis]        = useLocalStorage("af_kpis",        MOCK_KPIS);
  const [lsDepartments, setLsDepartments] = useLocalStorage("af_departments", MOCK_DEPARTMENTS);
  const [lsPitches,     setLsPitches]     = useLocalStorage("af_pitches",     MOCK_PITCHES);

  // ── Supabase state ────────────────────────────────────────────────────────
  const emptyDb = { projects: [], tasks: [], clients: [], kpis: [], departments: [], pitches: [] };
  const [dbData, setDbData] = useState(emptyDb);
  const [dbUsers, setDbUsers] = useState(MOCK_USERS);
  const [loading, setLoading] = useState(false);
  const loadedAgency = useRef(null);

  // Ref always holds latest db state so setters can diff without stale closures
  const dbRef = useRef(dbData);
  useEffect(() => { dbRef.current = dbData; }, [dbData]);

  useEffect(() => {
    if (!useSupabase) return;
    if (loadedAgency.current === agencyId) return;

    setLoading(true);
    Promise.all([
      ...TABLES.map(fetchTable),
      supabase.from("profiles").select("*").then(r => r.data ?? []),
    ]).then(([projects, tasks, clients, kpis, departments, pitches, profiles]) => {
      setDbData({ projects, tasks, clients, kpis, departments, pitches });
      if (profiles.length) setDbUsers(profiles);
      loadedAgency.current = agencyId;
      setLoading(false);
    });
  }, [useSupabase, agencyId]);

  // ── Generic setter factory ────────────────────────────────────────────────
  const makeDbSetter = (table) => (newItems) => {
    const oldItems = dbRef.current[table];
    setDbData(prev => ({ ...prev, [table]: newItems }));
    syncCollection(table, oldItems, newItems, agencyId);
  };

  // ── Public setters ────────────────────────────────────────────────────────
  const setProjects    = useCallback(useSupabase ? makeDbSetter("projects")    : setLsProjects,    [useSupabase, agencyId]); // eslint-disable-line
  const setTasks       = useCallback(useSupabase ? makeDbSetter("tasks")       : setLsTasks,       [useSupabase, agencyId]); // eslint-disable-line
  const setClients     = useCallback(useSupabase ? makeDbSetter("clients")     : setLsClients,     [useSupabase, agencyId]); // eslint-disable-line
  const setKpis        = useCallback(useSupabase ? makeDbSetter("kpis")        : setLsKpis,        [useSupabase, agencyId]); // eslint-disable-line
  const setDepartments = useCallback(useSupabase ? makeDbSetter("departments") : setLsDepartments, [useSupabase, agencyId]); // eslint-disable-line
  const setPitches     = useCallback(useSupabase ? makeDbSetter("pitches")     : setLsPitches,     [useSupabase, agencyId]); // eslint-disable-line

  const resetAllData = useCallback(async () => {
    if (useSupabase) {
      await Promise.all(TABLES.map(t => supabase.from(t).delete().eq("agency_id", agencyId)));
      setDbData(emptyDb);
      loadedAgency.current = null;
    } else {
      setLsProjects(MOCK_PROJECTS); setLsTasks(MOCK_TASKS);
      setLsClients(MOCK_CLIENTS);   setLsKpis(MOCK_KPIS);
      setLsDepartments(MOCK_DEPARTMENTS); setLsPitches(MOCK_PITCHES);
    }
  }, [useSupabase, agencyId]); // eslint-disable-line

  const active = useSupabase ? dbData : {
    projects: lsProjects, tasks: lsTasks, clients: lsClients,
    kpis: lsKpis, departments: lsDepartments, pitches: lsPitches,
  };

  return {
    ...active,
    setProjects, setTasks, setClients, setKpis, setDepartments, setPitches,
    users: useSupabase ? dbUsers : MOCK_USERS,
    resetAllData,
    loading,
  };
}
