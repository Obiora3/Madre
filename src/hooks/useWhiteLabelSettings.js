import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage.js";
import { DEFAULT_PROJECT_PIPELINES, DEFAULT_TASK_TEMPLATES, getTaskTemplates } from "../lib/helpers.js";

export const DEFAULT_WHITE_LABEL_SETTINGS = {
  // Branding
  agency_name:   "Madre",
  tagline:       "Your Agency, Delivered.",
  primary_colour: "#7C3AED",
  accent_colour:  "#A78BFA",
  dark_sidebar:   false,
  hide_attribution: false,

  // Preferences
  billing_rate:          150,      // $/h used in Reports budget tracking
  currency:              "NGN",    // USD | GBP | EUR | AUD | NGN
  default_task_priority: "Medium",
  week_starts_on:        "monday", // "monday" | "sunday"
  project_pipelines:     DEFAULT_PROJECT_PIPELINES,
  task_templates:        DEFAULT_TASK_TEMPLATES,

  // Notifications
  notify_deadlines:       true,
  notify_mentions:        true,
  notify_comments:        true,
  deadline_warning_hours: 24,      // hours before due to show warning

  // Operational automations
  automation_enabled: true,
  automation_deadline_warnings: true,
  automation_overdue_escalation: true,
  automation_blocked_alerts: true,
  automation_toasts: true,
  automation_email: false,
  automation_whatsapp: false,
  assignment_email_alerts: true,
  overdue_escalation_hours: 24,     // hours after due date before escalation
};

export function useWhiteLabelSettings() {
  const [settings, setStoredSettings] = useLocalStorage(
    "af_white_label_settings",
    DEFAULT_WHITE_LABEL_SETTINGS
  );

  const setSettings = useCallback((nextSettings) => {
    setStoredSettings({ ...DEFAULT_WHITE_LABEL_SETTINGS, ...nextSettings });
  }, [setStoredSettings]);

  const resetSettings = useCallback(() => {
    setStoredSettings(DEFAULT_WHITE_LABEL_SETTINGS);
  }, [setStoredSettings]);

  const normalizedSettings = useMemo(() => {
    const projectPipelines = settings?.project_pipelines || settings?.task_pipelines || DEFAULT_WHITE_LABEL_SETTINGS.project_pipelines;
    const taskTemplates = getTaskTemplates(settings?.task_templates || DEFAULT_WHITE_LABEL_SETTINGS.task_templates);
    return { ...DEFAULT_WHITE_LABEL_SETTINGS, ...settings, project_pipelines: projectPipelines, task_templates: taskTemplates };
  }, [settings]);

  return { settings: normalizedSettings, setSettings, resetSettings };
}
