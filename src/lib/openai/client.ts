import {
  ApiError,
  FunctionCallItem,
  FunctionCallOutputItem,
  ResponseInputItem,
  ResponsesRequest,
} from "../../types/openai";
import { MODEL, REASONING_EFFORT, RESPONSES_URL } from "./constants";
import { StreamProcessor, StreamCallbacks } from "./stream-processor";
import { ToolExecutor, getAvailableTools } from "../tools/executor";

export interface OpenAIClientConfig {
  apiKey: string;
}

export class OpenAIClient {
  private apiKey: string;
  private streamProcessor: StreamProcessor;
  private toolExecutor: ToolExecutor;

  constructor(config: OpenAIClientConfig) {
    this.apiKey = config.apiKey;
    this.streamProcessor = new StreamProcessor();
    this.toolExecutor = new ToolExecutor();
  }

  async sendMessage(
    input: ResponseInputItem[],
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const request = this.buildRequest(input);

    try {
      const response = await this.makeRequest(request);

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
        );
      }

      const enhancedCallbacks = this.wrapCallbacks(callbacks, input);
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

  private buildRequest(input: ResponseInputItem[]): ResponsesRequest {
    return {
      model: MODEL,
      input,
      tools: getAvailableTools(),
      tool_choice: "auto",
      reasoning: { effort: REASONING_EFFORT },
      stream: true,
    };
  }

  private async makeRequest(request: ResponsesRequest): Promise<Response> {
    return fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(request),
    });
  }

  private wrapCallbacks(
    originalCallbacks: StreamCallbacks,
    input: ResponseInputItem[],
  ): StreamCallbacks {
    return {
      ...originalCallbacks,
      onToolCalls: async (functionCalls: FunctionCallItem[]) => {
        try {
          const outputs = await this.toolExecutor.execute(functionCalls);
          this.reportToolActivity(functionCalls, outputs, originalCallbacks);
          await this.continueWithToolOutputs(
            input,
            functionCalls,
            outputs,
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
    functionCalls: FunctionCallItem[],
    outputs: FunctionCallOutputItem[],
    callbacks: StreamCallbacks,
  ): void {
    if (!callbacks.onToolActivity) return;

    const outputByCallId = new Map(
      outputs.map((output) => [output.call_id, output.output]),
    );

    const interactions = functionCalls.map((functionCall) => ({
      name: functionCall.name,
      arguments: functionCall.arguments,
      result: outputByCallId.get(functionCall.call_id) ?? "",
    }));

    callbacks.onToolActivity(interactions);
  }

  private async continueWithToolOutputs(
    input: ResponseInputItem[],
    functionCalls: FunctionCallItem[],
    outputs: FunctionCallOutputItem[],
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const replayedCalls: ResponseInputItem[] = functionCalls.map(
      ({ call_id, name, arguments: args }) => ({
        type: "function_call",
        call_id,
        name,
        arguments: args,
      }),
    );

    const updatedInput: ResponseInputItem[] = [
      ...input,
      ...replayedCalls,
      ...outputs,
    ];

    this.streamProcessor.reset();
    await this.sendMessage(updatedInput, callbacks);
  }
}
