import { describe, it, expect, beforeEach, vi } from "vitest";
import { ToolExecutor } from "../executor";
import { ToolCall, ToolExecutionError } from "../../../types/openai";

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
});
