import { useState, useEffect } from "react";
import { ReasoningEffort } from "../types/openai";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  ModelId,
  isModelId,
  isReasoningEffort,
  supportedReasoningEffort,
} from "../lib/openai/constants";

/** An API key, with the Responses API server it belongs to. */
interface ApiKeyEntry {
  id: string;
  /** Name shown in the key pickers. */
  label: string;
  /** Base URL of the server; `/responses` is appended to it. */
  baseUrl: string;
  apiKey: string;
}

interface Settings {
  /** Saved API keys. There is always at least one. */
  apiKeys: ApiKeyEntry[];
  /** The key requests are sent with. */
  activeApiKeyId: string;
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

const DEFAULT_API_KEY_ID = "default";

export function createApiKeyEntry(
  overrides: Partial<ApiKeyEntry> = {},
): ApiKeyEntry {
  return {
    id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: "OpenAI",
    baseUrl: DEFAULT_BASE_URL,
    apiKey: "",
    ...overrides,
  };
}

const DEFAULT_SETTINGS: Settings = {
  apiKeys: [createApiKeyEntry({ id: DEFAULT_API_KEY_ID })],
  activeApiKeyId: DEFAULT_API_KEY_ID,
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

export type { ApiKeyEntry, Settings };

/** The key requests are sent with. */
export function activeApiKey(settings: Settings): ApiKeyEntry {
  return (
    settings.apiKeys.find((entry) => entry.id === settings.activeApiKeyId) ??
    settings.apiKeys[0]
  );
}

/** Settings as stored, which may hold a single `openaiApiKey` instead of a key list. */
type StoredSettings = Partial<Settings> & { openaiApiKey?: string };

/**
 * Fill in missing values, turn a single stored `openaiApiKey` into the key
 * list, and drop model and reasoning effort values the API no longer accepts.
 */
function sanitize(stored: StoredSettings = {}): Settings {
  const { openaiApiKey, ...rest } = stored;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...rest };

  const apiKeys =
    Array.isArray(stored.apiKeys) && stored.apiKeys.length > 0
      ? stored.apiKeys
      : [
          createApiKeyEntry({
            id: DEFAULT_API_KEY_ID,
            apiKey: openaiApiKey ?? "",
          }),
        ];
  const activeApiKeyId = apiKeys.some(
    (entry) => entry.id === settings.activeApiKeyId,
  )
    ? settings.activeApiKeyId
    : apiKeys[0].id;

  const model = isModelId(settings.model) ? settings.model : DEFAULT_MODEL;
  const reasoningEffort = isReasoningEffort(settings.reasoningEffort)
    ? settings.reasoningEffort
    : DEFAULT_REASONING_EFFORT;
  return {
    ...settings,
    apiKeys,
    activeApiKeyId,
    model,
    reasoningEffort: supportedReasoningEffort(model, reasoningEffort),
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
      setSettings(
        sanitize(changes.settings.newValue as StoredSettings | undefined),
      );
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get(["settings"]);
      if (result.settings) {
        setSettings(sanitize(result.settings as StoredSettings));
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

  /** Switch the key requests are sent with. */
  const selectApiKey = async (activeApiKeyId: string) => {
    if (!settings.apiKeys.some((entry) => entry.id === activeApiKeyId)) return;
    await saveSettings({ activeApiKeyId });
  };

  const updateSystemPrompt = async (systemPrompt: string) => {
    await saveSettings({ systemPrompt });
  };

  const updateModel = async (model: ModelId) => {
    await saveSettings({
      model,
      reasoningEffort: supportedReasoningEffort(
        model,
        settings.reasoningEffort,
      ),
    });
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
    selectApiKey,
    updateSystemPrompt,
    updateModel,
    updateReasoningEffort,
    updateModelSelectorOpen,
    saveSettings,
  };
};
