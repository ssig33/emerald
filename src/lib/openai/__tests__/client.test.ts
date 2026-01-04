import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAIClient } from "../client";
import { OpenAIMessage, ApiError } from "../../../types/openai";

vi.mock("../stream-processor");
vi.mock("../tools/executor");

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

const createMockResponse = (chunks: string[], status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? "OK" : "Error",
  body: {
    getReader: () => createMockReader(chunks),
  },
});

describe("OpenAIClient", () => {
  let client: OpenAIClient;
  const mockApiKey = "sk-test-key-123";

  beforeEach(() => {
    client = new OpenAIClient({ apiKey: mockApiKey });
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default config", () => {
      const client = new OpenAIClient({ apiKey: mockApiKey });
      expect(client).toBeInstanceOf(OpenAIClient);
    });

    it("should allow custom model", () => {
      const client = new OpenAIClient({
        apiKey: mockApiKey,
        model: "gpt-4o",
      });
      expect(client).toBeInstanceOf(OpenAIClient);
    });

    it("should allow custom base URL", () => {
      const client = new OpenAIClient({
        apiKey: mockApiKey,
        baseUrl: "https://custom.api.com/v1/chat/completions",
      });
      expect(client).toBeInstanceOf(OpenAIClient);
    });
  });

  describe("sendMessage", () => {
    const mockMessages: OpenAIMessage[] = [
      {
        role: "user",
        content: "Hello, AI!",
      },
    ];

    it("should send message successfully", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" World"}}]}\n',
        "data: [DONE]\n",
      ];

      global.fetch = vi.fn().mockResolvedValue(createMockResponse(chunks));

      const onContent = vi.fn();
      const onComplete = vi.fn();

      await client.sendMessage(mockMessages, {
        onContent,
        onComplete,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockApiKey}`,
          },
        }),
      );

      const requestBody = JSON.parse(
        (global.fetch as any).mock.calls[0][1].body,
      );
      expect(requestBody.model).toBe("gpt-5.2");
      expect(requestBody.messages).toEqual(mockMessages);
      expect(requestBody.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "function",
            function: expect.objectContaining({
              name: "get_page_text",
            }),
          }),
        ]),
      );
      expect(requestBody.tool_choice).toBe("auto");
      expect(requestBody.stream).toBe(true);
    });

    it("should handle HTTP errors", async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockResponse([], 500));

      await expect(client.sendMessage(mockMessages, {})).rejects.toThrow(
        ApiError,
      );
    });

    it("should handle network errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(client.sendMessage(mockMessages, {})).rejects.toThrow(
        ApiError,
      );
    });

    it("should handle fetch rejection", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection failed"));

      const onError = vi.fn();

      await expect(
        client.sendMessage(mockMessages, { onError }),
      ).rejects.toThrow(ApiError);
    });

    it("should use custom model when provided", async () => {
      const customClient = new OpenAIClient({
        apiKey: mockApiKey,
        model: "gpt-4o",
      });

      const chunks = ['data: {"choices":[{"delta":{"content":"test"}}]}\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockResponse(chunks));

      await customClient.sendMessage(mockMessages, {});

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4o"'),
        }),
      );
    });

    it("should use custom base URL when provided", async () => {
      const customBaseUrl = "https://custom.api.com/v1/chat/completions";
      const customClient = new OpenAIClient({
        apiKey: mockApiKey,
        baseUrl: customBaseUrl,
      });

      const chunks = ['data: {"choices":[{"delta":{"content":"test"}}]}\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockResponse(chunks));

      await customClient.sendMessage(mockMessages, {});

      expect(global.fetch).toHaveBeenCalledWith(
        customBaseUrl,
        expect.any(Object),
      );
    });

    it("should include tools in request", async () => {
      const chunks = ['data: {"choices":[{"delta":{"content":"test"}}]}\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockResponse(chunks));

      await client.sendMessage(mockMessages, {});

      const requestBody = JSON.parse(
        (global.fetch as any).mock.calls[0][1].body,
      );

      expect(requestBody.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "function",
            function: expect.objectContaining({
              name: "get_page_text",
            }),
          }),
        ]),
      );
    });

    it("should set stream to true", async () => {
      const chunks = ['data: {"choices":[{"delta":{"content":"test"}}]}\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockResponse(chunks));

      await client.sendMessage(mockMessages, {});

      const requestBody = JSON.parse(
        (global.fetch as any).mock.calls[0][1].body,
      );

      expect(requestBody.stream).toBe(true);
    });

    it("should set tool_choice to auto", async () => {
      const chunks = ['data: {"choices":[{"delta":{"content":"test"}}]}\n'];
      global.fetch = vi.fn().mockResolvedValue(createMockResponse(chunks));

      await client.sendMessage(mockMessages, {});

      const requestBody = JSON.parse(
        (global.fetch as any).mock.calls[0][1].body,
      );

      expect(requestBody.tool_choice).toBe("auto");
    });

    it("should handle multiple messages", async () => {
      const multipleMessages: OpenAIMessage[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello!" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ];

      const chunks = [
        'data: {"choices":[{"delta":{"content":"I\'m good"}}]}\n',
      ];
      global.fetch = vi.fn().mockResolvedValue(createMockResponse(chunks));

      await client.sendMessage(multipleMessages, {});

      const requestBody = JSON.parse(
        (global.fetch as any).mock.calls[0][1].body,
      );

      expect(requestBody.messages).toEqual(multipleMessages);
    });

    it("should handle multimodal messages", async () => {
      const multimodalMessage: OpenAIMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "What's in this image?" },
            {
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64,..." },
            },
          ],
        },
      ];

      const chunks = [
        'data: {"choices":[{"delta":{"content":"I see an image"}}]}\n',
      ];
      global.fetch = vi.fn().mockResolvedValue(createMockResponse(chunks));

      await client.sendMessage(multimodalMessage, {});

      const requestBody = JSON.parse(
        (global.fetch as any).mock.calls[0][1].body,
      );

      expect(requestBody.messages).toEqual(multimodalMessage);
    });
  });
});
