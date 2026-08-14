import { describe, it, expect, beforeEach, vi } from "vitest";
import { ToolExecutor, getAvailableTools } from "../executor";
import { FunctionCallItem, FunctionTool } from "../../../types/openai";

const functionCall = (
  callId: string,
  name: string,
  args = "{}",
): FunctionCallItem => ({
  type: "function_call",
  call_id: callId,
  name,
  arguments: args,
});

describe("ToolExecutor", () => {
  let toolExecutor: ToolExecutor;

  beforeEach(() => {
    toolExecutor = new ToolExecutor();
    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("should execute get_current_time tool successfully", async () => {
      const results = await toolExecutor.execute([
        functionCall("test-id-1", "get_current_time"),
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("function_call_output");
      expect(results[0].call_id).toBe("test-id-1");
      expect(results[0].output).toMatch(/^Current local time:/);
    });

    it("should handle unknown tool", async () => {
      const results = await toolExecutor.execute([
        functionCall("test-id-1", "unknown_tool"),
      ]);

      expect(results).toEqual([
        {
          type: "function_call_output",
          call_id: "test-id-1",
          output: "Error: Unknown tool: unknown_tool",
        },
      ]);
    });

    it("should execute multiple tools", async () => {
      const results = await toolExecutor.execute([
        functionCall("test-id-1", "get_current_time"),
        functionCall("test-id-2", "get_current_time"),
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].call_id).toBe("test-id-1");
      expect(results[0].output).toMatch(/^Current local time:/);
      expect(results[1].call_id).toBe("test-id-2");
      expect(results[1].output).toMatch(/^Current local time:/);
    });

    it("should handle mixed success and error cases", async () => {
      const results = await toolExecutor.execute([
        functionCall("test-id-1", "get_current_time"),
        functionCall("test-id-2", "unknown_tool"),
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].output).toMatch(/^Current local time:/);
      expect(results[1].output).toBe("Error: Unknown tool: unknown_tool");
    });
  });

  describe("browser tools", () => {
    it("routes a browser tool to the active tab and returns its output", async () => {
      (chrome.tabs.query as any).mockResolvedValue([
        { id: 3, url: "https://example.com", title: "Example" },
      ]);
      (chrome.tabs.sendMessage as any).mockResolvedValue({
        ok: true,
        result: "Title: Example",
      });

      const results = await toolExecutor.execute([
        functionCall(
          "test-id-1",
          "browser_read_page",
          '{"selector":null,"max_length":null}',
        ),
      ]);

      expect(results).toEqual([
        {
          type: "function_call_output",
          call_id: "test-id-1",
          output: "Title: Example",
        },
      ]);
    });

    it("feeds a browser tool failure back to the model", async () => {
      (chrome.tabs.query as any).mockResolvedValue([
        { id: 3, url: "https://example.com", title: "Example" },
      ]);
      (chrome.tabs.sendMessage as any).mockResolvedValue({
        ok: false,
        error: "No element at index 9",
      });

      const results = await toolExecutor.execute([
        functionCall(
          "test-id-1",
          "browser_click",
          '{"index":9,"selector":null}',
        ),
      ]);

      expect(results[0].output).toBe("Error: No element at index 9");
    });

    it("reports malformed tool arguments instead of crashing", async () => {
      const results = await toolExecutor.execute([
        functionCall("test-id-1", "browser_read_page", "{not json"),
      ]);

      expect(results[0].output).toContain("Invalid JSON arguments");
    });
  });

  describe("getAvailableTools", () => {
    it("exposes the local function tools in the Responses API format", () => {
      const functionTools = getAvailableTools().filter(
        (tool): tool is FunctionTool => tool.type === "function",
      );

      expect(functionTools.map((tool) => tool.name)).toEqual([
        "get_current_time",
        "browser_read_page",
        "browser_list_elements",
        "browser_click",
        "browser_fill",
        "browser_navigate",
        "browser_scroll",
      ]);
      expect(functionTools.every((tool) => tool.strict)).toBe(true);
    });

    it("enables the built-in web search tool", () => {
      expect(getAvailableTools()).toContainEqual({ type: "web_search" });
    });
  });
});
