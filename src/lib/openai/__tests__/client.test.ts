import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAIClient } from "../client";
import { ResponseInputItem, ApiError } from "../../../types/openai";

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

const textDelta = (text: string) =>
  `data: {"type":"response.output_text.delta","delta":${JSON.stringify(text)}}\n`;

const functionCallDone = (callId: string, name: string, args: string) =>
  `data: {"type":"response.output_item.done","item":{"type":"function_call","id":"fc_1","call_id":"${callId}","name":"${name}","arguments":${JSON.stringify(args)}}}\n`;

describe("OpenAIClient", () => {
  let client: OpenAIClient;
  const mockApiKey = "sk-test-key-123";

  beforeEach(() => {
    client = new OpenAIClient({ apiKey: mockApiKey });
    vi.clearAllMocks();
  });

  describe("sendMessage", () => {
    const mockInput: ResponseInputItem[] = [
      {
        role: "user",
        content: "Hello, AI!",
      },
    ];

    it("should send message successfully", async () => {
      const chunks = [
        textDelta("Hello"),
        textDelta(" World"),
        'data: {"type":"response.completed"}\n',
      ];

      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(chunks));

      const onContent = vi.fn();
      const onComplete = vi.fn();

      await client.sendMessage(mockInput, { onContent, onComplete });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/responses",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockApiKey}`,
          },
        }),
      );

      expect(onContent).toHaveBeenNthCalledWith(1, "Hello");
      expect(onContent).toHaveBeenNthCalledWith(2, " World");
      expect(onComplete).toHaveBeenCalled();
    });

    it("should fall back to gpt-5.6-luna with max reasoning effort", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockResponse([textDelta("test")]));

      await client.sendMessage(mockInput, {});

      const requestBody = JSON.parse(
        (globalThis.fetch as any).mock.calls[0][1].body,
      );

      expect(requestBody.model).toBe("gpt-5.6-luna");
      expect(requestBody.reasoning).toEqual({ effort: "max" });
      expect(requestBody.input).toEqual(mockInput);
      expect(requestBody.tool_choice).toBe("auto");
      expect(requestBody.stream).toBe(true);
    });

    it("should request the configured model and reasoning effort", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockResponse([textDelta("test")]));

      const configured = new OpenAIClient({
        apiKey: mockApiKey,
        model: "gpt-5.6-sol",
        reasoningEffort: "medium",
      });
      await configured.sendMessage(mockInput, {});

      const requestBody = JSON.parse(
        (globalThis.fetch as any).mock.calls[0][1].body,
      );

      expect(requestBody.model).toBe("gpt-5.6-sol");
      expect(requestBody.reasoning).toEqual({ effort: "medium" });
    });

    it("should keep the configured model on the tool-output follow-up", async () => {
      const firstResponse = createMockResponse([
        functionCallDone("call_1", "get_current_time", "{}"),
        'data: {"type":"response.completed"}\n',
      ]);
      const secondResponse = createMockResponse([
        textDelta("It is late."),
        'data: {"type":"response.completed"}\n',
      ]);

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      const configured = new OpenAIClient({
        apiKey: mockApiKey,
        model: "gpt-5.6-terra",
        reasoningEffort: "high",
      });
      await configured.sendMessage(mockInput, {});

      const followUpBody = JSON.parse(
        (globalThis.fetch as any).mock.calls[1][1].body,
      );

      expect(followUpBody.model).toBe("gpt-5.6-terra");
      expect(followUpBody.reasoning).toEqual({ effort: "high" });
    });

    it("should offer the local function tools and the built-in web search", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockResponse([textDelta("test")]));

      await client.sendMessage(mockInput, {});

      const requestBody = JSON.parse(
        (globalThis.fetch as any).mock.calls[0][1].body,
      );

      expect(requestBody.tools).toContainEqual(
        expect.objectContaining({ type: "function", name: "get_current_time" }),
      );
      expect(requestBody.tools).toContainEqual(
        expect.objectContaining({ type: "function", name: "browser_click" }),
      );
      expect(requestBody.tools).toContainEqual({ type: "web_search" });
    });

    it("should handle HTTP errors", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse([], 500));

      await expect(client.sendMessage(mockInput, {})).rejects.toThrow(ApiError);
    });

    it("should handle network errors", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(client.sendMessage(mockInput, {})).rejects.toThrow(ApiError);
    });

    it("should execute function calls and continue with their outputs", async () => {
      const firstResponse = createMockResponse([
        functionCallDone("call_1", "get_current_time", "{}"),
        'data: {"type":"response.completed"}\n',
      ]);
      const secondResponse = createMockResponse([
        textDelta("It is late."),
        'data: {"type":"response.completed"}\n',
      ]);

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      const onContent = vi.fn();
      const onComplete = vi.fn();
      const onToolActivity = vi.fn();

      await client.sendMessage(mockInput, {
        onContent,
        onComplete,
        onToolActivity,
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      const followUpBody = JSON.parse(
        (globalThis.fetch as any).mock.calls[1][1].body,
      );
      expect(followUpBody.input).toEqual([
        ...mockInput,
        {
          type: "function_call",
          call_id: "call_1",
          name: "get_current_time",
          arguments: "{}",
        },
        {
          type: "function_call_output",
          call_id: "call_1",
          output: expect.stringMatching(/^Current local time:/),
        },
      ]);

      expect(onToolActivity).toHaveBeenCalledWith([
        expect.objectContaining({ name: "get_current_time" }),
      ]);
      expect(onContent).toHaveBeenCalledWith("It is late.");
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("should handle multimodal input", async () => {
      const multimodalInput: ResponseInputItem[] = [
        {
          role: "user",
          content: [
            { type: "input_text", text: "What's in this image?" },
            { type: "input_image", image_url: "data:image/jpeg;base64,..." },
          ],
        },
      ];

      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockResponse([textDelta("I see an image")]));

      await client.sendMessage(multimodalInput, {});

      const requestBody = JSON.parse(
        (globalThis.fetch as any).mock.calls[0][1].body,
      );

      expect(requestBody.input).toEqual(multimodalInput);
    });
  });
});
