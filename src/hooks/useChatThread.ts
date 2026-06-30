import { useState, useEffect, useRef } from "react";
import { Message, ToolInteraction } from "../types";
import { groupChatStorage } from "../utils/groupChatStorage";
import { normalizeCjkMarkdown } from "../lib/markdown/cjk-normalize";

const TAB_GROUP_ID_NONE = -1;

async function getCurrentGroupId(): Promise<number> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.groupId ?? TAB_GROUP_ID_NONE;
  } catch (error) {
    console.error("Failed to get current group id:", error);
    return TAB_GROUP_ID_NONE;
  }
}

export const useChatThread = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const groupIdRef = useRef<number>(TAB_GROUP_ID_NONE);
  const [loaded, setLoaded] = useState(false);

  // Restore the conversation tied to the current tab group on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      const groupId = await getCurrentGroupId();
      groupIdRef.current = groupId;
      if (groupId !== TAB_GROUP_ID_NONE) {
        const stored = await groupChatStorage.getGroupChat(groupId);
        if (active && stored) {
          setMessages(stored);
        }
      }
      if (active) setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Auto-persist the conversation for as long as the group lives.
  useEffect(() => {
    if (!loaded) return;
    const groupId = groupIdRef.current;
    if (groupId === TAB_GROUP_ID_NONE) return;
    groupChatStorage.saveGroupChat(groupId, messages);
  }, [messages, loaded]);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const appendToLastMessage = (chunk: string) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages.length > 0) {
        const lastMessage = newMessages[newMessages.length - 1];
        newMessages[newMessages.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + chunk,
        };
      }
      return newMessages;
    });
  };

  const completeLastMessage = (toolInteractions?: ToolInteraction[]) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages.length > 0) {
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.sender === "ai" && lastMessage.status === "streaming") {
          newMessages[newMessages.length - 1] = {
            ...lastMessage,
            content: normalizeCjkMarkdown(lastMessage.content),
            status: "done",
            toolInteractions:
              toolInteractions && toolInteractions.length > 0
                ? toolInteractions
                : lastMessage.toolInteractions,
          };
        }
      }
      return newMessages;
    });
  };

  // Clear the current group's conversation (used by the "new conversation" action).
  const clearCurrentGroupChat = async (): Promise<void> => {
    const groupId = groupIdRef.current;
    if (groupId !== TAB_GROUP_ID_NONE) {
      await groupChatStorage.clearGroupChat(groupId);
    }
  };

  return {
    messages,
    addMessage,
    appendToLastMessage,
    completeLastMessage,
    clearCurrentGroupChat,
  };
};
