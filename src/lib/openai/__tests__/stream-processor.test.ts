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

const createMockResponse = (chunks: string[], hasBody = true) =>
  ({
    ok: true,
    body: hasBody ? { getReader: () => createMockReader(chunks) } : null,
  }) as Response;

const textDelta = (text: string) =>
  `data: {"type":"response.output_text.delta","delta":${JSON.stringify(text)}}\n`;

const completed = 'data: {"type":"response.completed"}\n';

describe("StreamProcessor", () => {
  let streamProcessor: StreamProcessor;

  beforeEach(() => {
    streamProcessor = new StreamProcessor();
    vi.clearAllMocks();
  });

  describe("processStream", () => {
    it("should emit text deltas", async () => {
      const response = createMockResponse([
        textDelta("Hello"),
        textDelta(" World"),
        completed,
      ]);
      const onContent = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, { onContent, onComplete });

      expect(onContent).toHaveBeenCalledWith("Hello");
      expect(onContent).toHaveBeenCalledWith(" World");
      expect(onComplete).toHaveBeenCalled();
    });

    it("should collect function calls and skip completion", async () => {
      const response = createMockResponse([
        'data: {"type":"response.output_item.added","item":{"type":"function_call","call_id":"call_1","name":"get_current_time"}}\n',
        'data: {"type":"response.function_call_arguments.delta","delta":"{}"}\n',
        'data: {"type":"response.output_item.done","item":{"type":"function_call","id":"fc_1","call_id":"call_1","name":"get_current_time","arguments":"{}"}}\n',
        completed,
      ]);
      const onToolCalls = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, {
        onToolCalls,
        onComplete,
      });

      expect(onToolCalls).toHaveBeenCalledWith([
        {
          type: "function_call",
          id: "fc_1",
          call_id: "call_1",
          name: "get_current_time",
          arguments: "{}",
        },
      ]);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("should collect multiple function calls", async () => {
      const response = createMockResponse([
        'data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"call_1","name":"tool1","arguments":"{}"}}\n',
        'data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"call_2","name":"tool2","arguments":"{}"}}\n',
        completed,
      ]);
      const onToolCalls = vi.fn();

      await streamProcessor.processStream(response, { onToolCalls });

      expect(onToolCalls).toHaveBeenCalledWith([
        expect.objectContaining({ call_id: "call_1", name: "tool1" }),
        expect.objectContaining({ call_id: "call_2", name: "tool2" }),
      ]);
    });

    it("should report built-in web search calls as tool activity", async () => {
      const response = createMockResponse([
        'data: {"type":"response.web_search_call.searching","item_id":"ws_1"}\n',
        'data: {"type":"response.output_item.done","item":{"type":"web_search_call","id":"ws_1","status":"completed","action":{"type":"search","query":"emerald extension"}}}\n',
        textDelta("Here is what I found"),
        completed,
      ]);
      const onToolActivity = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, {
        onToolActivity,
        onComplete,
      });

      expect(onToolActivity).toHaveBeenCalledWith([
        {
          name: "web_search",
          arguments: JSON.stringify({ query: "emerald extension" }),
          result: "completed",
        },
      ]);
      expect(onComplete).toHaveBeenCalled();
    });

    it("should handle error events", async () => {
      const response = createMockResponse([
        'data: {"type":"error","code":"server_error","message":"API Error occurred"}\n',
      ]);
      const onError = vi.fn();

      await expect(
        streamProcessor.processStream(response, { onError }),
      ).rejects.toThrow(StreamError);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "API Error occurred" }),
      );
    });

    it("should handle failed responses", async () => {
      const response = createMockResponse([
        'data: {"type":"response.failed","response":{"status":"failed","error":{"message":"Rate limited"}}}\n',
      ]);
      const onError = vi.fn();

      await expect(
        streamProcessor.processStream(response, { onError }),
      ).rejects.toThrow(StreamError);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Rate limited" }),
      );
    });

    it("should handle invalid JSON", async () => {
      const response = createMockResponse(["data: {invalid json}\n"]);

      await expect(streamProcessor.processStream(response, {})).rejects.toThrow(
        StreamError,
      );
    });

    it("should handle null response body", async () => {
      const response = createMockResponse([], false);

      await expect(streamProcessor.processStream(response, {})).rejects.toThrow(
        StreamError,
      );
    });

    it("should handle reader errors", async () => {
      const response = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockRejectedValue(new Error("Reader error")),
          }),
        },
      } as unknown as Response;
      const onError = vi.fn();

      await expect(
        streamProcessor.processStream(response, { onError }),
      ).rejects.toThrow(StreamError);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Stream processing failed" }),
      );
    });

    it("should handle multiple lines in a single chunk", async () => {
      const response = createMockResponse([
        textDelta("First") + textDelta(" Second"),
        textDelta(" Third") + completed,
      ]);
      const onContent = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, { onContent, onComplete });

      expect(onContent).toHaveBeenCalledTimes(3);
      expect(onContent).toHaveBeenNthCalledWith(1, "First");
      expect(onContent).toHaveBeenNthCalledWith(2, " Second");
      expect(onContent).toHaveBeenNthCalledWith(3, " Third");
      expect(onComplete).toHaveBeenCalled();
    });

    it("should handle partial chunks correctly", async () => {
      const response = createMockResponse([
        'data: {"type":"response.output_te',
        'xt.delta","delta":"Hello"}\n' + completed,
      ]);
      const onContent = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, { onContent, onComplete });

      expect(onContent).toHaveBeenCalledWith("Hello");
      expect(onComplete).toHaveBeenCalled();
    });

    it("should ignore unrelated events and non-JSON data lines", async () => {
      const response = createMockResponse([
        "event: response.created\n",
        "data: some-non-json-data\n",
        'data: {"type":"response.reasoning_summary_text.delta","delta":"thinking"}\n',
        textDelta("Hello"),
        completed,
      ]);
      const onContent = vi.fn();
      const onComplete = vi.fn();

      await streamProcessor.processStream(response, { onContent, onComplete });

      expect(onContent).toHaveBeenCalledTimes(1);
      expect(onContent).toHaveBeenCalledWith("Hello");
      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("should drop collected function calls", async () => {
      const first = createMockResponse([
        'data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"call_1","name":"test","arguments":"{}"}}\n',
      ]);

      await streamProcessor.processStream(first, {});
      streamProcessor.reset();

      const second = createMockResponse([
        'data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"call_2","name":"test2","arguments":"{}"}}\n',
      ]);
      const onToolCalls = vi.fn();

      await streamProcessor.processStream(second, { onToolCalls });

      expect(onToolCalls).toHaveBeenCalledWith([
        expect.objectContaining({ call_id: "call_2", name: "test2" }),
      ]);
    });
  });
});
