import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage.js";

export const DEFAULT_WHITE_LABEL_SETTINGS = {
  agency_name: "AgencyFlow",
  tagline: "Your Agency, Delivered.",
  primary_colour: "#7C3AED",
  accent_colour: "#A78BFA",
  dark_sidebar: true,
  hide_attribution: false
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

  return {
    settings: normalizedSettings,
    setSettings,
    resetSettings
  };
}
