import { useState, useEffect } from "react";

interface Settings {
  openaiApiKey: string;
  systemPrompt: string;
  baseUrl: string;
  model: string;
  braveApiKey: string;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3PathStyle: boolean;
  s3Prefix: string;
  s3PublicBaseUrl: string;
}

interface Profile {
  id: string;
  name: string;
  baseUrl: string;
  openaiApiKey: string;
  model: string;
}

const DEFAULT_SETTINGS: Settings = {
  openaiApiKey: "",
  systemPrompt:
    "You are a helpful AI assistant integrated into a Chrome extension called Emerald. You can help users with various tasks while they browse the web. When users provide page content, use it to give more contextual and relevant responses. Be concise but helpful, and adapt your responses to the context of what the user is doing.",
  baseUrl: "https://api.openai.com/v1/chat/completions",
  model: "gpt-5.4",
  braveApiKey: "",
  s3Endpoint: "",
  s3Region: "us-east-1",
  s3Bucket: "",
  s3AccessKeyId: "",
  s3SecretAccessKey: "",
  s3PathStyle: true,
  s3Prefix: "emerald/conversations",
  s3PublicBaseUrl: "",
};

export type { Settings, Profile };

const PROFILES_KEY = "llmProfiles";

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get(["settings", PROFILES_KEY]);
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
      }
      if (Array.isArray(result[PROFILES_KEY])) {
        setProfiles(result[PROFILES_KEY]);
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

  const persistProfiles = async (newProfiles: Profile[]) => {
    try {
      await chrome.storage.local.set({ [PROFILES_KEY]: newProfiles });
      setProfiles(newProfiles);
    } catch (error) {
      console.error("Failed to save profiles:", error);
    }
  };

  const saveProfile = async (
    name: string,
    config: Pick<Settings, "baseUrl" | "openaiApiKey" | "model">,
  ) => {
    const profile: Profile = {
      id: crypto.randomUUID(),
      name,
      baseUrl: config.baseUrl,
      openaiApiKey: config.openaiApiKey,
      model: config.model,
    };
    await persistProfiles([...profiles, profile]);
  };

  const applyProfile = async (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    await saveSettings({
      baseUrl: profile.baseUrl,
      openaiApiKey: profile.openaiApiKey,
      model: profile.model,
    });
  };

  const deleteProfile = async (id: string) => {
    await persistProfiles(profiles.filter((p) => p.id !== id));
  };

  return {
    settings,
    profiles,
    loading,
    updateApiKey,
    updateSystemPrompt,
    saveSettings,
    saveProfile,
    applyProfile,
    deleteProfile,
  };
};
