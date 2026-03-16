import { ToolCall, ToolResult, ToolExecutionError } from "../../types/openai";

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
      name: "get_current_time",
      description:
        "Get the current date and time. Use this tool IMMEDIATELY at the beginning of every conversation to establish temporal context. Always call this first regardless of what the user asks - knowing the current time is essential for providing accurate, contextually appropriate responses about schedules, deadlines, time-sensitive information, and general conversation context.",
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
      case "get_current_time":
        return await this.executeGetCurrentTime(toolCall.id);
      default:
        throw new ToolExecutionError(`Unknown tool: ${func.name}`, func.name);
    }
  }

  private async executeGetCurrentTime(toolCallId: string): Promise<ToolResult> {
    const now = new Date();
    const localTime = now.toLocaleString();

    return {
      tool_call_id: toolCallId,
      role: "tool",
      content: `Current local time: ${localTime}`,
    };
  }
}
