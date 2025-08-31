import { useState, useEffect } from "react";

interface Settings {
  openaiApiKey: string;
  systemPrompt: string;
}

const DEFAULT_SETTINGS: Settings = {
  openaiApiKey: "",
  systemPrompt:
    "You are a helpful AI assistant integrated into a Chrome extension called Emerald. You can help users with various tasks while they browse the web. When users provide page content, use it to give more contextual and relevant responses. Be concise but helpful, and adapt your responses to the context of what the user is doing.",
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get("settings");
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<Settings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      console.log("Saving settings:", updatedSettings);
      await chrome.storage.local.set({ settings: updatedSettings });
      setSettings(updatedSettings);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const updateApiKey = async (apiKey: string) => {
    await saveSettings({ openaiApiKey: apiKey });
  };

  const updateSystemPrompt = async (systemPrompt: string) => {
    await saveSettings({ systemPrompt });
  };

  return {
    settings,
    loading,
    updateApiKey,
    updateSystemPrompt,
    saveSettings,
  };
};
