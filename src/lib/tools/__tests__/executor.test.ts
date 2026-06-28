import { describe, it, expect, beforeEach, vi } from "vitest";
import { ToolExecutor, getAvailableTools } from "../executor";
import { ToolCall } from "../../../types/openai";

describe("ToolExecutor", () => {
  let toolExecutor: ToolExecutor;

  beforeEach(() => {
    toolExecutor = new ToolExecutor();
    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("should execute get_current_time tool successfully", async () => {
      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_current_time",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(1);
      expect(results[0].tool_call_id).toBe("test-id-1");
      expect(results[0].role).toBe("tool");
      expect(results[0].content).toMatch(/^Current local time:/);
    });

    it("should handle unknown tool", async () => {
      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "unknown_tool",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        tool_call_id: "test-id-1",
        role: "tool",
        content: "Error: Unknown tool: unknown_tool",
      });
    });

    it("should execute multiple tools", async () => {
      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_current_time",
            arguments: "{}",
          },
        },
        {
          id: "test-id-2",
          type: "function",
          function: {
            name: "get_current_time",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(2);
      expect(results[0].tool_call_id).toBe("test-id-1");
      expect(results[0].content).toMatch(/^Current local time:/);
      expect(results[1].tool_call_id).toBe("test-id-2");
      expect(results[1].content).toMatch(/^Current local time:/);
    });

    it("should handle mixed success and error cases", async () => {
      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_current_time",
            arguments: "{}",
          },
        },
        {
          id: "test-id-2",
          type: "function",
          function: {
            name: "unknown_tool",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(2);
      expect(results[0].content).toMatch(/^Current local time:/);
      expect(results[1]).toEqual({
        tool_call_id: "test-id-2",
        role: "tool",
        content: "Error: Unknown tool: unknown_tool",
      });
    });
  });

  describe("getAvailableTools", () => {
    it("does not include web_search without a Brave API key", () => {
      const names = getAvailableTools().map((t) => t.function.name);
      expect(names).toContain("get_current_time");
      expect(names).not.toContain("web_search");
    });

    it("includes web_search when a Brave API key is set", () => {
      const names = getAvailableTools({ braveApiKey: "test-key" }).map(
        (t) => t.function.name,
      );
      expect(names).toContain("web_search");
    });
  });

  describe("web_search", () => {
    const searchCall: ToolCall[] = [
      {
        id: "search-1",
        type: "function",
        function: {
          name: "web_search",
          arguments: JSON.stringify({ query: "emerald chrome extension" }),
        },
      },
    ];

    it("returns an error when no Brave API key is configured", async () => {
      const results = await new ToolExecutor().execute(searchCall);

      expect(results[0].content).toBe(
        "Error: Brave API key is not configured.",
      );
    });

    it("calls the Brave API and formats results with source URLs", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          web: {
            results: [
              {
                title: "Result A",
                url: "https://example.com/a",
                description: "Snippet A",
              },
              {
                title: "Result B",
                url: "https://example.com/b",
                description: "Snippet B",
              },
            ],
          },
        }),
      });
      globalThis.fetch = fetchMock;

      const executor = new ToolExecutor({ braveApiKey: "brave-key" });
      const results = await executor.execute(searchCall);

      const [calledUrl, calledInit] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain(
        "https://api.search.brave.com/res/v1/web/search",
      );
      expect(calledUrl).toContain("q=emerald");
      expect(calledInit.headers["X-Subscription-Token"]).toBe("brave-key");

      expect(results[0].content).toContain("https://example.com/a");
      expect(results[0].content).toContain("https://example.com/b");
      expect(results[0].content).toContain("Result A");
    });

    it("returns a message when there are no results", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ web: { results: [] } }),
      });

      const executor = new ToolExecutor({ braveApiKey: "brave-key" });
      const results = await executor.execute(searchCall);

      expect(results[0].content).toBe("No search results found.");
    });

    it("returns an error message on HTTP failure", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });

      const executor = new ToolExecutor({ braveApiKey: "brave-key" });
      const results = await executor.execute(searchCall);

      expect(results[0].content).toBe(
        "Error: Brave Search API returned HTTP 429",
      );
    });
  });
});
