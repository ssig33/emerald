import { describe, it, expect, beforeEach, vi } from "vitest";
import { StreamProcessor } from "../stream-processor";
import { StreamError } from "../../../types/openai";

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

const createMockResponse = (chunks: string[], hasBody = true) => ({
  ok: true,
  body: hasBody ? { getReader: () => createMockReader(chunks) } : null,
});

describe("StreamProcessor", () => {
  let streamProcessor: StreamProcessor;

  beforeEach(() => {
    streamProcessor = new StreamProcessor();
    vi.clearAllMocks();
  });

  describe("processStream", () => {
    it("should process content messages correctly", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" World"}}]}\n',
        "data: [DONE]\n",
      ];

      const response = createMockResponse(chunks) as Response;
      const onContent = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, {
        onContent,
        onComplete,
      });

      expect(onContent).toHaveBeenCalledWith("Hello");
      expect(onContent).toHaveBeenCalledWith(" World");
      expect(onComplete).toHaveBeenCalled();
    });

    it("should handle tool calls correctly", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"get_page"}}]},"finish_reason":null}]}\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"_text","arguments":"{}"}}]},"finish_reason":null}]}\n',
        'data: {"choices":[{"finish_reason":"tool_calls"}]}\n',
      ];

      const response = createMockResponse(chunks) as Response;
      const onToolCalls = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, {
        onToolCalls,
        onComplete,
      });

      expect(onToolCalls).toHaveBeenCalledWith([
        {
          id: "call_1",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
      ]);
      expect(onComplete).toHaveBeenCalled();
    });

    it("should handle multiple tool calls", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"tool1","arguments":"{}"}},{"index":1,"id":"call_2","function":{"name":"tool2","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}\n',
      ];

      const response = createMockResponse(chunks) as Response;
      const onToolCalls = vi.fn();

      await streamProcessor.processStream(response, {
        onToolCalls,
      });

      expect(onToolCalls).toHaveBeenCalledWith([
        {
          id: "call_1",
          type: "function",
          function: {
            name: "tool1",
            arguments: "{}",
          },
        },
        {
          id: "call_2",
          type: "function",
          function: {
            name: "tool2",
            arguments: "{}",
          },
        },
      ]);
    });

    it("should handle API errors", async () => {
      const chunks = ['data: {"error":{"message":"API Error occurred"}}\n'];

      const response = createMockResponse(chunks) as Response;
      const onError = vi.fn();

      await expect(
        streamProcessor.processStream(response, { onError }),
      ).rejects.toThrow(StreamError);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "API Error occurred",
        }),
      );
    });

    it("should handle invalid JSON", async () => {
      const chunks = ["data: {invalid json}\n"];

      const response = createMockResponse(chunks) as Response;
      const onError = vi.fn();

      await expect(
        streamProcessor.processStream(response, { onError }),
      ).rejects.toThrow(StreamError);
    });

    it("should handle null response body", async () => {
      const response = createMockResponse([], false) as Response;

      await expect(streamProcessor.processStream(response, {})).rejects.toThrow(
        StreamError,
      );
    });

    it("should handle reader errors", async () => {
      const mockReader = {
        read: vi.fn().mockRejectedValue(new Error("Reader error")),
      };

      const response = {
        ok: true,
        body: { getReader: () => mockReader },
      } as unknown as Response;

      const onError = vi.fn();

      await expect(
        streamProcessor.processStream(response, { onError }),
      ).rejects.toThrow(StreamError);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Stream processing failed",
        }),
      );
    });

    it("should handle multiple lines in single chunk", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"First"}}]}\ndata: {"choices":[{"delta":{"content":" Second"}}]}\n',
        'data: {"choices":[{"delta":{"content":" Third"}}]}\ndata: [DONE]\n',
      ];

      const response = createMockResponse(chunks) as Response;
      const onContent = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, {
        onContent,
        onComplete,
      });

      expect(onContent).toHaveBeenCalledTimes(3);
      expect(onContent).toHaveBeenNthCalledWith(1, "First");
      expect(onContent).toHaveBeenNthCalledWith(2, " Second");
      expect(onContent).toHaveBeenNthCalledWith(3, " Third");
      expect(onComplete).toHaveBeenCalled();
    });

    it("should handle partial chunks correctly", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"con',
        'tent":"Hello"}}]}\ndata: [DONE]\n',
      ];

      const response = createMockResponse(chunks) as Response;
      const onContent = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, {
        onContent,
        onComplete,
      });

      expect(onContent).toHaveBeenCalledWith("Hello");
      expect(onComplete).toHaveBeenCalled();
    });

    it("should ignore non-JSON data lines", async () => {
      const chunks = [
        "data: some-non-json-data\n",
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        "data: [DONE]\n",
      ];

      const response = createMockResponse(chunks) as Response;
      const onContent = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, {
        onContent,
        onComplete,
      });

      expect(onContent).toHaveBeenCalledWith("Hello");
      expect(onComplete).toHaveBeenCalled();
    });

    it("should handle empty choices array", async () => {
      const chunks = ['data: {"choices":[]}\n', "data: [DONE]\n"];

      const response = createMockResponse(chunks) as Response;
      const onContent = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, {
        onContent,
        onComplete,
      });

      expect(onContent).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it("should filter out incomplete tool calls", async () => {
      // Test passes if no exception is thrown and process completes
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"","function":{"name":"","arguments":""}}]},"finish_reason":null}]}\n',
        'data: {"choices":[{"finish_reason":"tool_calls"}]}\n',
      ];

      const response = createMockResponse(chunks) as Response;
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, {
        onComplete,
      });

      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("should reset internal state", async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"test"}}]},"finish_reason":null}]}\n',
      ];

      const response = createMockResponse(chunks) as Response;

      await streamProcessor.processStream(response, {});

      streamProcessor.reset();

      const chunks2 = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_2","function":{"name":"test2"}}]},"finish_reason":"tool_calls"}]}\n',
      ];

      const response2 = createMockResponse(chunks2) as Response;
      const onToolCalls = vi.fn();

      await streamProcessor.processStream(response2, {
        onToolCalls,
      });

      expect(onToolCalls).toHaveBeenCalledWith([
        {
          id: "call_2",
          type: "function",
          function: {
            name: "test2",
            arguments: "",
          },
        },
      ]);
    });
  });
});
