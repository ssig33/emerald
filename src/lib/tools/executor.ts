import {
  FunctionCallItem,
  FunctionCallOutputItem,
  FunctionTool,
  ToolDefinition,
  ToolExecutionError,
  WebSearchTool,
} from "../../types/openai";

export const AVAILABLE_TOOLS: FunctionTool[] = [
  {
    type: "function",
    name: "get_current_time",
    description:
      "Get the current date and time. Use this tool IMMEDIATELY at the beginning of every conversation to establish temporal context. Always call this first regardless of what the user asks - knowing the current time is essential for providing accurate, contextually appropriate responses about schedules, deadlines, time-sensitive information, and general conversation context.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
];

/**
 * Hosted web search tool. OpenAI runs the search server side, so there is
 * nothing to execute locally: results and citations arrive in the stream.
 */
export const WEB_SEARCH_TOOL: WebSearchTool = { type: "web_search" };

export const getAvailableTools = (): ToolDefinition[] => [
  ...AVAILABLE_TOOLS,
  WEB_SEARCH_TOOL,
];

export class ToolExecutor {
  async execute(
    functionCalls: FunctionCallItem[],
  ): Promise<FunctionCallOutputItem[]> {
    const results: FunctionCallOutputItem[] = [];

    for (const functionCall of functionCalls) {
      try {
        results.push(await this.executeSingleTool(functionCall));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        results.push({
          type: "function_call_output",
          call_id: functionCall.call_id,
          output: `Error: ${errorMessage}`,
        });
      }
    }

    return results;
  }

  private async executeSingleTool(
    functionCall: FunctionCallItem,
  ): Promise<FunctionCallOutputItem> {
    switch (functionCall.name) {
      case "get_current_time":
        return this.executeGetCurrentTime(functionCall.call_id);
      default:
        throw new ToolExecutionError(
          `Unknown tool: ${functionCall.name}`,
          functionCall.name,
        );
    }
  }

  private executeGetCurrentTime(callId: string): FunctionCallOutputItem {
    const localTime = new Date().toLocaleString();

    return {
      type: "function_call_output",
      call_id: callId,
      output: `Current local time: ${localTime}`,
    };
  }
}
