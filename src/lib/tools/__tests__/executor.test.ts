import { describe, it, expect, beforeEach, vi } from "vitest";
import { ToolExecutor, getAvailableTools } from "../executor";
import { FunctionCallItem } from "../../../types/openai";

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

  describe("getAvailableTools", () => {
    it("exposes the local function tools in the Responses API format", () => {
      const functionTools = getAvailableTools().filter(
        (tool) => tool.type === "function",
      );

      expect(functionTools).toEqual([
        expect.objectContaining({
          type: "function",
          name: "get_current_time",
          strict: true,
        }),
      ]);
    });

    it("enables the built-in web search tool", () => {
      expect(getAvailableTools()).toContainEqual({ type: "web_search" });
    });
  });
});
