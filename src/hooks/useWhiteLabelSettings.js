import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage.js";

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
  currency:              "USD",    // USD | GBP | EUR | AUD | NGN
  default_task_priority: "Medium",
  week_starts_on:        "monday", // "monday" | "sunday"

  // Notifications
  notify_deadlines:       true,
  notify_mentions:        true,
  notify_comments:        true,
  deadline_warning_hours: 24,      // hours before due to show warning
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

  const normalizedSettings = useMemo(
    () => ({ ...DEFAULT_WHITE_LABEL_SETTINGS, ...settings }),
    [settings]
  );

  return { settings: normalizedSettings, setSettings, resetSettings };
}
