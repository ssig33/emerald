import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatThread } from "../useChatThread";
import { Message } from "../../types";

// Mock crypto.randomUUID
const mockCrypto = {
  randomUUID: vi.fn().mockReturnValue("test-uuid-123"),
};
Object.defineProperty(global, "crypto", {
  value: mockCrypto,
  writable: true,
});

// Mock chatStorage
vi.mock("../../utils/chatStorage", () => ({
  chatStorage: {
    getChatHistory: vi.fn(),
    saveChatHistory: vi.fn(),
  },
}));

import { chatStorage } from "../../utils/chatStorage";

describe("useChatThread", () => {
  const mockMessage: Message = {
    id: "msg-1",
    content: "Hello",
    sender: "user",
    timestamp: 1625097600000,
  };

  const mockAIMessage: Message = {
    id: "msg-2",
    content: "Hello!",
    sender: "ai",
    timestamp: 1625097660000,
    status: "streaming",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCrypto.randomUUID.mockReturnValue("test-uuid-123");
  });

  it("initial state is set correctly", () => {
    const { result } = renderHook(() => useChatThread());

    expect(result.current.messages).toEqual([]);
    expect(result.current.threadId).toBe("test-uuid-123");
    expect(typeof result.current.addMessage).toBe("function");
    expect(typeof result.current.appendToLastMessage).toBe("function");
    expect(typeof result.current.completeLastMessage).toBe("function");
    expect(typeof result.current.loadChatHistory).toBe("function");
  });

  it("returns same ID once threadId is generated", () => {
    const { result } = renderHook(() => useChatThread());

    const firstId = result.current.threadId;
    const secondId = result.current.threadId;

    expect(firstId).toBe(secondId);
    expect(mockCrypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("can add messages", () => {
    const { result } = renderHook(() => useChatThread());

    act(() => {
      result.current.addMessage(mockMessage);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual(mockMessage);
  });

  it("can add multiple messages in order", () => {
    const { result } = renderHook(() => useChatThread());

    const secondMessage: Message = {
      id: "msg-2",
      content: "World",
      sender: "ai",
      timestamp: 1625097660000,
    };

    act(() => {
      result.current.addMessage(mockMessage);
      result.current.addMessage(secondMessage);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual(mockMessage);
    expect(result.current.messages[1]).toEqual(secondMessage);
  });

  it("can append text to last message", () => {
    const { result } = renderHook(() => useChatThread());

    act(() => {
      result.current.addMessage(mockAIMessage);
    });

    act(() => {
      result.current.appendToLastMessage(" How can I help?");
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe("Hello! How can I help?");
  });

  it("appendToLastMessage does nothing when no messages", () => {
    const { result } = renderHook(() => useChatThread());

    act(() => {
      result.current.appendToLastMessage("Should not appear");
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it("can complete last message", async () => {
    const { result } = renderHook(() => useChatThread());

    act(() => {
      result.current.addMessage(mockAIMessage);
    });

    expect(result.current.messages[0].status).toBe("streaming");

    await act(async () => {
      result.current.completeLastMessage();
    });

    expect(result.current.messages[0].status).toBe("done");
    expect(chatStorage.saveChatHistory).toHaveBeenCalledWith(
      "test-uuid-123",
      result.current.messages,
    );
  });

  it("completeLastMessage does not change state for non-AI messages", async () => {
    const { result } = renderHook(() => useChatThread());

    const userMessage = { ...mockMessage, status: "done" as const };
    act(() => {
      result.current.addMessage(userMessage);
    });

    await act(async () => {
      result.current.completeLastMessage();
    });

    expect(result.current.messages[0]).toEqual(userMessage);
  });

  it("does not change state for non-streaming AI messages", async () => {
    const { result } = renderHook(() => useChatThread());

    const completedAIMessage = { ...mockAIMessage, status: "done" as const };
    act(() => {
      result.current.addMessage(completedAIMessage);
    });

    await act(async () => {
      result.current.completeLastMessage();
    });

    expect(result.current.messages[0].status).toBe("done");
  });

  it("can load chat history", async () => {
    const mockChatData = {
      messages: [mockMessage, mockAIMessage],
      title: "Test Chat",
      lastUpdated: 1625097720000,
    };

    vi.mocked(chatStorage.getChatHistory).mockResolvedValueOnce(mockChatData);

    const { result } = renderHook(() => useChatThread());

    await act(async () => {
      await result.current.loadChatHistory("existing-thread-id");
    });

    expect(result.current.messages).toEqual(mockChatData.messages);
    expect(result.current.threadId).toBe("existing-thread-id");
    expect(chatStorage.getChatHistory).toHaveBeenCalledWith(
      "existing-thread-id",
    );
  });

  it("loading non-existent chat history does not cause error", async () => {
    vi.mocked(chatStorage.getChatHistory).mockResolvedValueOnce(null);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useChatThread());

    await act(async () => {
      await result.current.loadChatHistory("non-existent-id");
    });

    expect(result.current.messages).toEqual([]);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles chat history loading errors", async () => {
    const error = new Error("Storage error");
    vi.mocked(chatStorage.getChatHistory).mockRejectedValueOnce(error);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useChatThread());

    await act(async () => {
      await result.current.loadChatHistory("error-id");
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to load chat history:",
      error,
    );
    expect(result.current.messages).toEqual([]);
    consoleSpy.mockRestore();
  });

  it("completeLastMessage does nothing when no messages", async () => {
    const { result } = renderHook(() => useChatThread());

    await act(async () => {
      result.current.completeLastMessage();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(chatStorage.saveChatHistory).toHaveBeenCalledWith(
      "test-uuid-123",
      [],
    );
  });

  it("can call appendToLastMessage multiple times", () => {
    const { result } = renderHook(() => useChatThread());

    act(() => {
      result.current.addMessage(mockAIMessage);
    });

    act(() => {
      result.current.appendToLastMessage(" How");
    });

    act(() => {
      result.current.appendToLastMessage(" can I help?");
    });

    expect(result.current.messages[0].content).toBe("Hello! How can I help?");
  });
});
