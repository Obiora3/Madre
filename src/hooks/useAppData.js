import { useCallback } from "react";
import {
  MOCK_CLIENTS,
  MOCK_DEPARTMENTS,
  MOCK_KPIS,
  MOCK_PITCHES,
  MOCK_PROJECTS,
  MOCK_TASKS,
  MOCK_USERS
} from "../data/mockData.js";
import { useLocalStorage } from "./useLocalStorage.js";

// ─── DATA SERVICE ─────────────────────────────────────────────────────────────
// Owns all mutable app data. Persists to localStorage; seeds from MOCK_* on
// first visit (when localStorage keys are absent). The root component calls
// this hook and forwards the result into AppContext — keeping data concerns
// entirely separate from render concerns.

/**
 * @typedef {{ id:string, name:string, email:string, role:string, department:string,
 *   job_title:string, skills:string[] }} User
 * @typedef {{ id:string, title:string, client_id:string, stage:string,
 *   priority:string, status:string, progress:number, due_date:string }} Project
 * @typedef {{ id:string, title:string, project_id:string, status:string,
 *   priority:string, due_date:string, estimated_hours:number, actual_hours:number,
 *   assigned_to:{name:string,email:string} }} Task
 * @typedef {{ id:string, name:string, industry:string, status:string,
 *   health_score:number, primary_contact:{name:string,email:string} }} Client
 * @typedef {{ id:string, name:string, category:string, target_value:number,
 *   current_value:number, unit:string, status:string }} KPI
 * @typedef {{ id:string, name:string, colour:string, lead:string|null,
 *   members:string[] }} Department
 * @typedef {{ id:string, title:string, stage:string, estimated_value:number,
 *   win_probability:number, prospect_company:string }} Pitch
 */

export function useAppData() {
  const [projects,    setProjects]    = useLocalStorage("af_projects",    MOCK_PROJECTS);
  const [tasks,       setTasks]       = useLocalStorage("af_tasks",       MOCK_TASKS);
  const [clients,     setClients]     = useLocalStorage("af_clients",     MOCK_CLIENTS);
  const [kpis,        setKpis]        = useLocalStorage("af_kpis",        MOCK_KPIS);
  const [departments, setDepartments] = useLocalStorage("af_departments", MOCK_DEPARTMENTS);
  const [pitches,     setPitches]     = useLocalStorage("af_pitches",     MOCK_PITCHES);
  // Users are read-only — no persistence needed
  const users = MOCK_USERS;

  /** Wipe all persisted data and restore factory defaults */
  const resetAllData = useCallback(() => {
    setProjects(MOCK_PROJECTS);
    setTasks(MOCK_TASKS);
    setClients(MOCK_CLIENTS);
    setKpis(MOCK_KPIS);
    setDepartments(MOCK_DEPARTMENTS);
    setPitches(MOCK_PITCHES);
  }, [setProjects, setTasks, setClients, setKpis, setDepartments, setPitches]);

  return { projects, setProjects, tasks, setTasks, clients, setClients,
           kpis, setKpis, departments, setDepartments, pitches, setPitches,
           users, resetAllData };
}
