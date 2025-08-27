import { create } from "zustand";

interface ContextData {
  text: string;
}

interface ContextStore {
  // Data
  contextData: ContextData;
  includePageText: boolean;
  loading: boolean;
  error: string;

  // Actions
  setContextData: (data: Partial<ContextData>) => void;
  togglePageText: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;

  // Async actions
  fetchText: () => Promise<void>;
}

export const useContextStore = create<ContextStore>()((set, get) => ({
  // Initial state
  contextData: { text: "" },
  includePageText: false,
  loading: false,
  error: "",

  // Actions
  setContextData: (data) =>
    set((state) => ({
      contextData: { ...state.contextData, ...data },
    })),

  togglePageText: () =>
    set((state) => ({
      includePageText: !state.includePageText,
    })),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Async actions
  fetchText: async () => {
    try {
      get().setLoading(true);
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]?.id) {
        throw new Error("No active tab found");
      }

      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "extractText",
      });
      if (response.error) {
        throw new Error(response.error);
      }
      get().setContextData({ text: response.text });
      get().setError("");
    } catch (err) {
      get().setError(
        err instanceof Error ? err.message : "Failed to fetch page text",
      );
    } finally {
      get().setLoading(false);
    }
  },
}));
