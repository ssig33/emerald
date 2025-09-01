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
    it("should execute get_page_text tool successfully", async () => {
      const mockTabs = [{ id: 123, active: true, currentWindow: true }];
      const mockResult = { text: "Sample page content" };

      global.chrome = {
        tabs: {
          query: vi.fn().mockResolvedValue(mockTabs),
          sendMessage: vi.fn().mockResolvedValue(mockResult),
        },
      } as any;

      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        tool_call_id: "test-id-1",
        role: "tool",
        content: "Sample page content",
      });

      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, {
        action: "extractText",
      });
    });

    it("should handle no active tab found error", async () => {
      global.chrome = {
        tabs: {
          query: vi.fn().mockResolvedValue([]),
          sendMessage: vi.fn(),
        },
      } as any;

      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        tool_call_id: "test-id-1",
        role: "tool",
        content: "Error: No active tab found",
      });
    });

    it("should handle tab without ID", async () => {
      const mockTabs = [{ id: undefined, active: true, currentWindow: true }];

      global.chrome = {
        tabs: {
          query: vi.fn().mockResolvedValue(mockTabs),
          sendMessage: vi.fn(),
        },
      } as any;

      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        tool_call_id: "test-id-1",
        role: "tool",
        content: "Error: No active tab found",
      });
    });

    it("should handle Chrome extension API error", async () => {
      const mockTabs = [{ id: 123, active: true, currentWindow: true }];

      global.chrome = {
        tabs: {
          query: vi.fn().mockResolvedValue(mockTabs),
          sendMessage: vi
            .fn()
            .mockRejectedValue(new Error("Permission denied")),
        },
      } as any;

      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        tool_call_id: "test-id-1",
        role: "tool",
        content: "Error: Failed to extract page text: Permission denied",
      });
    });

    it("should handle invalid response from content script", async () => {
      const mockTabs = [{ id: 123, active: true, currentWindow: true }];
      const mockResult = { error: "Content script not available" };

      global.chrome = {
        tabs: {
          query: vi.fn().mockResolvedValue(mockTabs),
          sendMessage: vi.fn().mockResolvedValue(mockResult),
        },
      } as any;

      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        tool_call_id: "test-id-1",
        role: "tool",
        content: "Error: Failed to extract text from page",
      });
    });

    it("should handle null response from content script", async () => {
      const mockTabs = [{ id: 123, active: true, currentWindow: true }];

      global.chrome = {
        tabs: {
          query: vi.fn().mockResolvedValue(mockTabs),
          sendMessage: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        tool_call_id: "test-id-1",
        role: "tool",
        content: "Error: Failed to extract text from page",
      });
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
      const mockTabs = [{ id: 123, active: true, currentWindow: true }];
      const mockResult = { text: "Sample page content" };

      global.chrome = {
        tabs: {
          query: vi.fn().mockResolvedValue(mockTabs),
          sendMessage: vi.fn().mockResolvedValue(mockResult),
        },
      } as any;

      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
        {
          id: "test-id-2",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        tool_call_id: "test-id-1",
        role: "tool",
        content: "Sample page content",
      });
      expect(results[1]).toEqual({
        tool_call_id: "test-id-2",
        role: "tool",
        content: "Sample page content",
      });
    });

    it("should handle mixed success and error cases", async () => {
      const mockTabs = [{ id: 123, active: true, currentWindow: true }];

      global.chrome = {
        tabs: {
          query: vi.fn().mockResolvedValue(mockTabs),
          sendMessage: vi
            .fn()
            .mockResolvedValueOnce({ text: "Success" })
            .mockRejectedValueOnce(new Error("Failed")),
        },
      } as any;

      const toolCalls: ToolCall[] = [
        {
          id: "test-id-1",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
        {
          id: "test-id-2",
          type: "function",
          function: {
            name: "get_page_text",
            arguments: "{}",
          },
        },
      ];

      const results = await toolExecutor.execute(toolCalls);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        tool_call_id: "test-id-1",
        role: "tool",
        content: "Success",
      });
      expect(results[1]).toEqual({
        tool_call_id: "test-id-2",
        role: "tool",
        content: "Error: Failed to extract page text: Failed",
      });
    });
  });
});
