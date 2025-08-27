import { useState } from "react";
import { Message } from "../types";
import { chatStorage } from "../utils/chatStorage";

export const useChatThread = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string>("");

  const getThreadId = (): string => {
    if (!threadId) {
      const newThreadId = crypto.randomUUID();
      setThreadId(newThreadId);
      return newThreadId;
    }
    return threadId;
  };

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

  const completeLastMessage = () => {
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages.length > 0) {
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.sender === "ai" && lastMessage.status === "streaming") {
          newMessages[newMessages.length - 1] = {
            ...lastMessage,
            status: "done",
          };
        }
      }
      chatStorage.saveChatHistory(getThreadId(), newMessages);
      return newMessages;
    });
  };

  const loadChatHistory = async (id: string) => {
    try {
      const chatData = await chatStorage.getChatHistory(id);
      if (chatData && chatData.messages) {
        setMessages(chatData.messages);
        setThreadId(id);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  };

  return {
    messages,
    threadId: getThreadId(),
    addMessage,
    appendToLastMessage,
    completeLastMessage,
    loadChatHistory,
  };
};
