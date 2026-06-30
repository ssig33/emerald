import { Message } from "../types";

const key = (groupId: number) => `group_${groupId}`;

export const groupChatStorage = {
  async getGroupChat(groupId: number): Promise<Message[] | null> {
    try {
      const result = await chrome.storage.session.get(key(groupId));
      const data = result[key(groupId)] as { messages: Message[] } | undefined;
      return data?.messages ?? null;
    } catch (error) {
      console.error("Failed to get group chat:", error);
      return null;
    }
  },

  async saveGroupChat(groupId: number, messages: Message[]): Promise<void> {
    try {
      await chrome.storage.session.set({ [key(groupId)]: { messages } });
    } catch (error) {
      console.error("Failed to save group chat:", error);
    }
  },

  async clearGroupChat(groupId: number): Promise<void> {
    try {
      await chrome.storage.session.remove(key(groupId));
    } catch (error) {
      console.error("Failed to clear group chat:", error);
    }
  },
};
