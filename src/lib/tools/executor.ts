import {
  FunctionCallItem,
  FunctionCallOutputItem,
  FunctionTool,
  ToolDefinition,
  ToolExecutionError,
  WebSearchTool,
} from "../../types/openai";
import {
  BROWSER_TOOLS,
  ToolImage,
  executeBrowserTool,
  isBrowserToolName,
} from "./browser-tools";

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
  ...BROWSER_TOOLS,
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

/** A picture a tool produced, tied back to the call that produced it. */
export interface ToolImageAttachment extends ToolImage {
  callId: string;
  toolName: string;
}

/**
 * A round of tool calls: the text answers the model expects, plus any images
 * they produced. Images travel separately because a function call output is
 * text only.
 */
export interface ToolRunResult {
  outputs: FunctionCallOutputItem[];
  images: ToolImageAttachment[];
}

interface SingleToolResult {
  output: FunctionCallOutputItem;
  image?: ToolImage;
}

export class ToolExecutor {
  async execute(functionCalls: FunctionCallItem[]): Promise<ToolRunResult> {
    const outputs: FunctionCallOutputItem[] = [];
    const images: ToolImageAttachment[] = [];

    for (const functionCall of functionCalls) {
      try {
        const result = await this.executeSingleTool(functionCall);
        outputs.push(result.output);
        if (result.image) {
          images.push({
            ...result.image,
            callId: functionCall.call_id,
            toolName: functionCall.name,
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        outputs.push({
          type: "function_call_output",
          call_id: functionCall.call_id,
          output: `Error: ${errorMessage}`,
        });
      }
    }

    return { outputs, images };
  }

  private async executeSingleTool(
    functionCall: FunctionCallItem,
  ): Promise<SingleToolResult> {
    if (isBrowserToolName(functionCall.name)) {
      const result = await executeBrowserTool(
        functionCall.name,
        this.parseArguments(functionCall),
      );

      return {
        output: {
          type: "function_call_output",
          call_id: functionCall.call_id,
          output: result.text,
        },
        image: result.image,
      };
    }

    switch (functionCall.name) {
      case "get_current_time":
        return { output: this.executeGetCurrentTime(functionCall.call_id) };
      default:
        throw new ToolExecutionError(
          `Unknown tool: ${functionCall.name}`,
          functionCall.name,
        );
    }
  }

  private parseArguments(
    functionCall: FunctionCallItem,
  ): Record<string, unknown> {
    if (!functionCall.arguments) return {};

    try {
      const parsed = JSON.parse(functionCall.arguments);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch (error) {
      throw new ToolExecutionError(
        `Invalid JSON arguments for ${functionCall.name}: ${functionCall.arguments}`,
        functionCall.name,
        error instanceof Error ? error : undefined,
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
