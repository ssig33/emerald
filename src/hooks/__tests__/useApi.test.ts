import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useApi } from "../useApi";
import { ApiRequest, Message } from "../../types";

// Mock useSettings hook
vi.mock("../useSettings", () => ({
  useSettings: () => ({
    settings: {
      openaiApiKey: "sk-test-key-123",
      systemPrompt: "You are a helpful AI assistant for testing.",
    },
    loading: false,
    updateApiKey: vi.fn(),
    updateSystemPrompt: vi.fn(),
    saveSettings: vi.fn(),
  }),
}));

// Mock ReadableStreamDefaultReader
const createMockReader = (chunks: string[]) => {
  let index = 0;
  return {
    read: vi.fn().mockImplementation(() => {
      if (index >= chunks.length) {
        return Promise.resolve({ done: true, value: undefined });
      }
      const chunk = new TextEncoder().encode(chunks[index]);
      index++;
      return Promise.resolve({ done: false, value: chunk });
    }),
  };
};

// Create mock Response
const createMockResponse = (chunks: string[], status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? "OK" : "Error",
  body: {
    getReader: () => createMockReader(chunks),
  },
});

describe("useApi", () => {
  const mockRequest: ApiRequest = {
    message: "Hello, OpenAI!",
  };

  const mockConversationHistory: Message[] = [
    {
      id: "1",
      content: "What is the weather?",
      sender: "user",
      timestamp: 123456788,
    },
    {
      id: "2",
      content: "I need more information about your location.",
      sender: "ai",
      timestamp: 123456789,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set initial state correctly", () => {
    const { result } = renderHook(() => useApi());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.sendMessage).toBe("function");
  });

  it("should handle normal streaming response", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
      'data: {"choices":[{"delta":{"content":" World"}}]}\n',
      "data: [DONE]\n",
    ];

    global.fetch = vi.fn().mockResolvedValueOnce(createMockResponse(chunks));

    const onMessage = vi.fn();
    const onComplete = vi.fn();

    const { result } = renderHook(() => useApi());

    await act(async () => {
      await result.current.sendMessage(
        mockRequest,
        [],
        undefined,
        onMessage,
        onComplete,
      );
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test-key-123",
        },
        body: JSON.stringify({
          model: "gpt-5",
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant for testing.",
            },
            {
              role: "user",
              content: "Hello, OpenAI!",
            },
          ],
          stream: true,
        }),
      },
    );

    expect(onMessage).toHaveBeenCalledWith("Hello");
    expect(onMessage).toHaveBeenCalledWith(" World");
    expect(onComplete).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("should send conversation history to OpenAI", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Response"}}]}\n',
      "data: [DONE]\n",
    ];

    global.fetch = vi.fn().mockResolvedValueOnce(createMockResponse(chunks));

    const { result } = renderHook(() => useApi());

    await act(async () => {
      await result.current.sendMessage(mockRequest, mockConversationHistory);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test-key-123",
        },
        body: JSON.stringify({
          model: "gpt-5",
          messages: [
            {
              role: "user",
              content: "What is the weather?",
            },
            {
              role: "assistant",
              content: "I need more information about your location.",
            },
            {
              role: "user",
              content: "Hello, OpenAI!",
            },
          ],
          stream: true,
        }),
      },
    );
  });

  it("should include context data in message", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Response"}}]}\n',
      "data: [DONE]\n",
    ];
    global.fetch = vi.fn().mockResolvedValueOnce(createMockResponse(chunks));

    const contextData = {
      text: "Page content here",
    };

    const { result } = renderHook(() => useApi());

    await act(async () => {
      await result.current.sendMessage(mockRequest, [], contextData);
    });

    const expectedMessage = `Hello, OpenAI!

Page content: Page content here`;

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test-key-123",
        },
        body: JSON.stringify({
          model: "gpt-5",
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant for testing.",
            },
            {
              role: "user",
              content: expectedMessage,
            },
          ],
          stream: true,
        }),
      },
    );
  });

  it("should handle partial context data", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Response"}}]}\n',
      "data: [DONE]\n",
    ];
    global.fetch = vi.fn().mockResolvedValueOnce(createMockResponse(chunks));

    const contextData = {};

    const { result } = renderHook(() => useApi());

    await act(async () => {
      await result.current.sendMessage(mockRequest, [], contextData);
    });

    const expectedMessage = `Hello, OpenAI!`;

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test-key-123",
        },
        body: JSON.stringify({
          model: "gpt-5",
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant for testing.",
            },
            {
              role: "user",
              content: expectedMessage,
            },
          ],
          stream: true,
        }),
      },
    );
  });

  it("should handle HTTP errors", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(createMockResponse([], 500));

    const { result } = renderHook(() => useApi());

    await act(async () => {
      await result.current.sendMessage(mockRequest);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("HTTP 500: Error");
  });

  it("should handle network errors", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useApi());

    await act(async () => {
      await result.current.sendMessage(mockRequest);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Network error");
  });

  it("should handle API error responses", async () => {
    const chunks = ['data: {"error":{"message":"Invalid request"}}\n'];

    global.fetch = vi.fn().mockResolvedValueOnce(createMockResponse(chunks));

    const { result } = renderHook(() => useApi());

    await act(async () => {
      await result.current.sendMessage(mockRequest);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Invalid request");
  });

  it("should set loading flag correctly during sending", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Response"}}]}\n',
      "data: [DONE]\n",
    ];

    global.fetch = vi.fn().mockResolvedValueOnce(createMockResponse(chunks));

    const { result } = renderHook(() => useApi());

    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.sendMessage(mockRequest);
    });

    expect(result.current.loading).toBe(false);
  });

  it("should handle multiple lines of data correctly", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"First"}}]}\ndata: {"choices":[{"delta":{"content":" Second"}}]}\n',
      'data: {"choices":[{"delta":{"content":" Third"}}]}\ndata: [DONE]\n',
    ];

    global.fetch = vi.fn().mockResolvedValueOnce(createMockResponse(chunks));

    const onMessage = vi.fn();
    const onComplete = vi.fn();

    const { result } = renderHook(() => useApi());

    await act(async () => {
      await result.current.sendMessage(
        mockRequest,
        [],
        undefined,
        onMessage,
        onComplete,
      );
    });

    expect(onMessage).toHaveBeenNthCalledWith(1, "First");
    expect(onMessage).toHaveBeenNthCalledWith(2, " Second");
    expect(onMessage).toHaveBeenNthCalledWith(3, " Third");
    expect(onComplete).toHaveBeenCalled();
  });

  it("should send message with empty context data", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Response"}}]}\n',
      "data: [DONE]\n",
    ];
    global.fetch = vi.fn().mockResolvedValueOnce(createMockResponse(chunks));

    const contextData = {};

    const { result } = renderHook(() => useApi());

    await act(async () => {
      await result.current.sendMessage(mockRequest, [], contextData);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test-key-123",
        },
        body: JSON.stringify({
          model: "gpt-5",
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant for testing.",
            },
            {
              role: "user",
              content: "Hello, OpenAI!",
            },
          ],
          stream: true,
        }),
      },
    );
  });

  it("should not send system prompt when there is conversation history", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Response"}}]}\n',
      "data: [DONE]\n",
    ];

    global.fetch = vi.fn().mockResolvedValueOnce(createMockResponse(chunks));

    const { result } = renderHook(() => useApi());

    await act(async () => {
      await result.current.sendMessage(mockRequest, mockConversationHistory);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test-key-123",
        },
        body: JSON.stringify({
          model: "gpt-5",
          messages: [
            {
              role: "user",
              content: "What is the weather?",
            },
            {
              role: "assistant",
              content: "I need more information about your location.",
            },
            {
              role: "user",
              content: "Hello, OpenAI!",
            },
          ],
          stream: true,
        }),
      },
    );
  });
});
