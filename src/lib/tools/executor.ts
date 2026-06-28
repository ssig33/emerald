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

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web using the Brave Search API and return a list of results, each with a title, URL, and snippet. Use this whenever answering the user would benefit from up-to-date or external information: current events, news, facts you are unsure about, product/library documentation, or anything that may have changed recently. IMPORTANT: Whenever you use information obtained from this tool, you MUST cite the source URLs back to the user in your reply, formatted as Markdown links like [title](url), so the user can verify where the information came from.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query.",
        },
      },
      required: ["query"],
    },
  },
};

export interface ToolExecutorOptions {
  braveApiKey?: string;
}

export const getAvailableTools = (
  options: ToolExecutorOptions = {},
): ToolDefinition[] => {
  const tools = [...AVAILABLE_TOOLS];
  if (options.braveApiKey) {
    tools.push(WEB_SEARCH_TOOL);
  }
  return tools;
};

export class ToolExecutor {
  private braveApiKey: string;

  constructor(options: ToolExecutorOptions = {}) {
    this.braveApiKey = options.braveApiKey || "";
  }

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
      case "web_search":
        return await this.executeWebSearch(toolCall.id, func.arguments);
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

  private async executeWebSearch(
    toolCallId: string,
    rawArguments: string,
  ): Promise<ToolResult> {
    if (!this.braveApiKey) {
      return {
        tool_call_id: toolCallId,
        role: "tool",
        content: "Error: Brave API key is not configured.",
      };
    }

    let query = "";
    try {
      query = (JSON.parse(rawArguments || "{}").query as string) || "";
    } catch {
      query = "";
    }

    if (!query) {
      return {
        tool_call_id: toolCallId,
        role: "tool",
        content: "Error: query is required.",
      };
    }

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "10");
    url.searchParams.set("search_lang", "jp");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": this.braveApiKey,
      },
    });

    if (!response.ok) {
      return {
        tool_call_id: toolCallId,
        role: "tool",
        content: `Error: Brave Search API returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const results = (data?.web?.results ?? []) as Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;

    if (results.length === 0) {
      return {
        tool_call_id: toolCallId,
        role: "tool",
        content: "No search results found.",
      };
    }

    const content = results
      .map(
        (r) =>
          `title: ${r.title ?? ""}\nurl: ${r.url ?? ""}\ncontent: ${r.description ?? ""}`,
      )
      .join("\n=================================\n\n");

    return {
      tool_call_id: toolCallId,
      role: "tool",
      content,
    };
  }
}
