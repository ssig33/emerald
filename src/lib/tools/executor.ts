import { ToolCall, ToolResult, ToolExecutionError } from "../../types/openai";
import Defuddle from "defuddle";
import TurndownService from "turndown";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_page_text",
      description:
        "Extract the complete text content and structure from the current web page. Use this tool IMMEDIATELY and PROACTIVELY whenever: the user asks about 'this page', 'this article', 'here', or references current content; when discussing, analyzing, or summarizing webpage content; when the user's question might be answered by page content; when helping with anything related to the current webpage. Always fetch page content first before making assumptions. This provides clean, structured text with headings, links, and context that is essential for understanding what the user is viewing.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

export class ToolExecutor {
  async execute(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeSingleTool(toolCall);
        results.push(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        results.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: `Error: ${errorMessage}`,
        });
      }
    }

    return results;
  }

  private async executeSingleTool(toolCall: ToolCall): Promise<ToolResult> {
    const { function: func } = toolCall;

    switch (func.name) {
      case "get_page_text":
        return await this.executeGetPageText(toolCall.id);
      default:
        throw new ToolExecutionError(`Unknown tool: ${func.name}`, func.name);
    }
  }

  private async executeGetPageText(toolCallId: string): Promise<ToolResult> {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tabs[0]?.id) {
        throw new ToolExecutionError("No active tab found", "get_page_text");
      }

      const result = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "extractHtml",
      });
      const info = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "getPageInfo",
      });

      if (!result || typeof result.text !== "string") {
        throw new ToolExecutionError(
          "Failed to extract text from page",
          "get_page_text",
        );
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(result.text, "text/html");

      const defuddle = new Defuddle(doc, { markdown: true, url: info.url });
      const parseResult = defuddle.parse();

      const contentHTML = parseResult.content;
      const turndownService = new TurndownService();
      const content = turndownService.turndown(contentHTML);

      return {
        tool_call_id: toolCallId,
        role: "tool",
        content,
      };
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      throw new ToolExecutionError(
        `Failed to extract page text: ${error instanceof Error ? error.message : "Unknown error"}`,
        "get_page_text",
        error instanceof Error ? error : undefined,
      );
    }
  }
}
