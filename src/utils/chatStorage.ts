import { Message, ChatHistoryItem } from "../types";

export const chatStorage = {
  async getThreadList(): Promise<ChatHistoryItem[]> {
    try {
      const result = await chrome.storage.local.get("system/history");
      return result["system/history"] || [];
    } catch (error) {
      console.error("Failed to get thread list:", error);
      return [];
    }
  },

  async getChatHistory(threadId: string): Promise<{
    messages: Message[];
    title?: string;
    lastUpdated: number;
  } | null> {
    try {
      const result = await chrome.storage.local.get(`chat_${threadId}`);
      return result[`chat_${threadId}`] || null;
    } catch (error) {
      console.error("Failed to get chat history:", error);
      return null;
    }
  },

  async saveChatHistory(threadId: string, messages: Message[]): Promise<void> {
    try {
      let title = "";
      try {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        title = activeTab?.title || "";
      } catch (e) {
        console.warn("Failed to get tab title:", e);
      }

      const chatData = {
        messages,
        title,
        lastUpdated: Date.now(),
      };

      await chrome.storage.local.set({ [`chat_${threadId}`]: chatData });

      const historyResult = await chrome.storage.local.get("system/history");
      const history: ChatHistoryItem[] = historyResult["system/history"] || [];
      const existingIndex = history.findIndex(
        (h: ChatHistoryItem) => h.threadId === threadId,
      );

      const chatItem: ChatHistoryItem = {
        threadId,
        title,
        lastUpdated: Date.now(),
      };

      if (existingIndex >= 0) {
        history[existingIndex] = chatItem;
      } else {
        history.unshift(chatItem);
      }

      const recentHistory = history
        .sort(
          (a: ChatHistoryItem, b: ChatHistoryItem) =>
            b.lastUpdated - a.lastUpdated,
        )
        .slice(0, 30);

      await chrome.storage.local.set({ "system/history": recentHistory });
    } catch (error) {
      console.error("Failed to save chat history:", error);
    }
  },
};
