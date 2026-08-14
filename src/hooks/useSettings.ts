import { useState, useEffect } from "react";
import { ReasoningEffort } from "../types/openai";
import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  ModelId,
  isModelId,
  isReasoningEffort,
} from "../lib/openai/constants";

interface Settings {
  openaiApiKey: string;
  systemPrompt: string;
  model: ModelId;
  reasoningEffort: ReasoningEffort;
  /** Whether the chat-level model pickers are expanded. */
  modelSelectorOpen: boolean;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3PathStyle: boolean;
  s3Prefix: string;
  s3PublicBaseUrl: string;
}

const DEFAULT_SETTINGS: Settings = {
  openaiApiKey: "",
  systemPrompt:
    "You are a helpful AI assistant integrated into a Chrome extension called Emerald. You can help users with various tasks while they browse the web. When users provide page content, use it to give more contextual and relevant responses. Use the built-in web search tool whenever up-to-date or external information would help, and cite the source URLs as Markdown links. You can also drive the active tab yourself with the browser tools: read the page with browser_read_page, discover what you can act on with browser_list_elements, then use browser_click, browser_fill, browser_scroll and browser_navigate. Always list the elements again after the page changes, because the indices are only valid for the page you listed them on. Be concise but helpful, and adapt your responses to the context of what the user is doing.",
  model: DEFAULT_MODEL,
  reasoningEffort: DEFAULT_REASONING_EFFORT,
  modelSelectorOpen: false,
  s3Endpoint: "",
  s3Region: "us-east-1",
  s3Bucket: "",
  s3AccessKeyId: "",
  s3SecretAccessKey: "",
  s3PathStyle: true,
  s3Prefix: "emerald/conversations",
  s3PublicBaseUrl: "",
};

export type { Settings };

/** Drop model and reasoning effort values that the API no longer accepts. */
function sanitize(settings: Settings): Settings {
  return {
    ...settings,
    model: isModelId(settings.model) ? settings.model : DEFAULT_MODEL,
    reasoningEffort: isReasoningEffort(settings.reasoningEffort)
      ? settings.reasoningEffort
      : DEFAULT_REASONING_EFFORT,
  };
}

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  // Every hook instance keeps its own copy, so mirror writes made elsewhere
  // (e.g. the model selector) into this one.
  useEffect(() => {
    const handleChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes.settings) return;
      const stored = changes.settings.newValue as Partial<Settings> | undefined;
      setSettings(sanitize({ ...DEFAULT_SETTINGS, ...stored }));
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get(["settings"]);
      if (result.settings) {
        setSettings(sanitize({ ...DEFAULT_SETTINGS, ...result.settings }));
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

  const updateModel = async (model: ModelId) => {
    await saveSettings({ model });
  };

  const updateReasoningEffort = async (reasoningEffort: ReasoningEffort) => {
    await saveSettings({ reasoningEffort });
  };

  const updateModelSelectorOpen = async (modelSelectorOpen: boolean) => {
    await saveSettings({ modelSelectorOpen });
  };

  return {
    settings,
    loading,
    updateApiKey,
    updateSystemPrompt,
    updateModel,
    updateReasoningEffort,
    updateModelSelectorOpen,
    saveSettings,
  };
};
