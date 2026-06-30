import {
  OpenAIRequest,
  OpenAIMessage,
  ToolCall,
  ToolResult,
  ApiError,
} from "../../types/openai";
import { StreamProcessor, StreamCallbacks } from "./stream-processor";
import { ToolExecutor, getAvailableTools } from "../tools/executor";

export interface OpenAIClientConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  braveApiKey?: string;
}

const DEFAULT_CONFIG = {
  model: "gpt-5.4",
  baseUrl: "https://api.openai.com/v1/chat/completions",
  braveApiKey: "",
};

export class OpenAIClient {
  private config: Required<OpenAIClientConfig>;
  private streamProcessor: StreamProcessor;
  private toolExecutor: ToolExecutor;

  constructor(config: OpenAIClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.streamProcessor = new StreamProcessor();
    this.toolExecutor = new ToolExecutor({
      braveApiKey: this.config.braveApiKey,
    });
  }

  async sendMessage(
    messages: OpenAIMessage[],
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const request = this.buildRequest(messages);

    try {
      const response = await this.makeRequest(request);

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
        );
      }

      const enhancedCallbacks = this.wrapCallbacks(callbacks, messages);
      await this.streamProcessor.processStream(response, enhancedCallbacks);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : "Unknown error",
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private buildRequest(messages: OpenAIMessage[]): OpenAIRequest {
    return {
      model: this.config.model,
      messages,
      tools: getAvailableTools({ braveApiKey: this.config.braveApiKey }),
      tool_choice: "auto",
      stream: true,
    };
  }

  private async makeRequest(request: OpenAIRequest): Promise<Response> {
    return fetch(this.config.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(request),
    });
  }

  private wrapCallbacks(
    originalCallbacks: StreamCallbacks,
    messages: OpenAIMessage[],
  ): StreamCallbacks {
    return {
      ...originalCallbacks,
      onToolCalls: async (toolCalls: ToolCall[]) => {
        try {
          const toolResults = await this.toolExecutor.execute(toolCalls);
          this.reportToolActivity(toolCalls, toolResults, originalCallbacks);
          await this.handleToolResults(
            messages,
            toolCalls,
            toolResults,
            originalCallbacks,
          );
        } catch (error) {
          originalCallbacks.onError?.(
            error instanceof Error ? error : new Error("Tool execution failed"),
          );
        }
      },
    };
  }

  private reportToolActivity(
    toolCalls: ToolCall[],
    toolResults: ToolResult[],
    callbacks: StreamCallbacks,
  ): void {
    if (!callbacks.onToolActivity) return;

    const resultById = new Map(
      toolResults.map((result) => [result.tool_call_id, result.content]),
    );

    const interactions = toolCalls.map((toolCall) => ({
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
      result: resultById.get(toolCall.id) ?? "",
    }));

    callbacks.onToolActivity(interactions);
  }

  private async handleToolResults(
    messages: OpenAIMessage[],
    toolCalls: ToolCall[],
    toolResults: ToolResult[],
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const updatedMessages: OpenAIMessage[] = [
      ...messages,
      {
        role: "assistant",
        content: null,
        tool_calls: toolCalls,
      },
      ...toolResults,
    ];

    this.streamProcessor.reset();
    await this.sendMessage(updatedMessages, callbacks);
  }
}
