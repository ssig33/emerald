import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatThread } from "../useChatThread";
import { Message } from "../../types";

// Mock groupChatStorage
vi.mock("../../utils/groupChatStorage", () => ({
  groupChatStorage: {
    getGroupChat: vi.fn(),
    saveGroupChat: vi.fn(),
    clearGroupChat: vi.fn(),
  },
}));

import { groupChatStorage } from "../../utils/groupChatStorage";

const setActiveTabGroup = (groupId: number) => {
  (chrome.tabs.query as any).mockResolvedValue([
    { id: 1, active: true, currentWindow: true, groupId },
  ]);
};

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
    vi.mocked(groupChatStorage.getGroupChat).mockResolvedValue(null);
    // Default: the active tab is not in a group.
    setActiveTabGroup(-1);
  });

  it("initial state is set correctly", () => {
    const { result } = renderHook(() => useChatThread());

    expect(result.current.messages).toEqual([]);
    expect(typeof result.current.addMessage).toBe("function");
    expect(typeof result.current.appendToLastMessage).toBe("function");
    expect(typeof result.current.completeLastMessage).toBe("function");
    expect(typeof result.current.clearCurrentGroupChat).toBe("function");
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
  });

  it("normalizes CJK markdown on completion", async () => {
    const { result } = renderHook(() => useChatThread());

    act(() => {
      result.current.addMessage({
        ...mockAIMessage,
        content: "これは**やりたかったこと。**だからするの",
      });
    });

    await act(async () => {
      result.current.completeLastMessage();
    });

    expect(result.current.messages[0].content).toBe(
      "これは**やりたかったこと。** だからするの",
    );
    expect(result.current.messages[0].status).toBe("done");
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

  it("completeLastMessage does nothing when no messages", async () => {
    const { result } = renderHook(() => useChatThread());

    await act(async () => {
      result.current.completeLastMessage();
    });

    expect(result.current.messages).toHaveLength(0);
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

  it("restores the conversation tied to the current group on mount", async () => {
    setActiveTabGroup(42);
    vi.mocked(groupChatStorage.getGroupChat).mockResolvedValueOnce([
      mockMessage,
      mockAIMessage,
    ]);

    const { result } = renderHook(() => useChatThread());

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(groupChatStorage.getGroupChat).toHaveBeenCalledWith(42);
    expect(result.current.messages).toEqual([mockMessage, mockAIMessage]);
  });

  it("auto-persists messages to the current group", async () => {
    setActiveTabGroup(42);

    const { result } = renderHook(() => useChatThread());

    await waitFor(() =>
      expect(groupChatStorage.getGroupChat).toHaveBeenCalledWith(42),
    );

    act(() => {
      result.current.addMessage(mockMessage);
    });

    await waitFor(() =>
      expect(groupChatStorage.saveGroupChat).toHaveBeenCalledWith(42, [
        mockMessage,
      ]),
    );
  });

  it("does not persist when the active tab is not in a group", async () => {
    // Default beforeEach sets group -1.
    const { result } = renderHook(() => useChatThread());

    act(() => {
      result.current.addMessage(mockMessage);
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(groupChatStorage.saveGroupChat).not.toHaveBeenCalled();
    expect(groupChatStorage.getGroupChat).not.toHaveBeenCalled();
  });

  it("clearCurrentGroupChat clears the current group's conversation", async () => {
    setActiveTabGroup(42);

    const { result } = renderHook(() => useChatThread());

    await waitFor(() =>
      expect(groupChatStorage.getGroupChat).toHaveBeenCalledWith(42),
    );

    await act(async () => {
      await result.current.clearCurrentGroupChat();
    });

    expect(groupChatStorage.clearGroupChat).toHaveBeenCalledWith(42);
  });
});
