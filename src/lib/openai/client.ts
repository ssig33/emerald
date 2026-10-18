import {
  ApiError,
  FunctionCallItem,
  FunctionCallOutputItem,
  ReasoningEffort,
  ResponseContentPart,
  ResponseInputItem,
  ResponsesRequest,
} from "../../types/openai";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  ModelId,
  responsesUrl,
} from "./constants";
import { StreamProcessor, StreamCallbacks } from "./stream-processor";
import {
  ToolExecutor,
  ToolImageAttachment,
  getAvailableTools,
} from "../tools/executor";

export interface OpenAIClientConfig {
  apiKey: string;
  /** Base URL of the Responses API server. Defaults to the OpenAI API. */
  baseUrl?: string;
  model?: ModelId;
  reasoningEffort?: ReasoningEffort;
}

export class OpenAIClient {
  private apiKey: string;
  private baseUrl: string;
  private model: ModelId;
  private reasoningEffort: ReasoningEffort;
  private streamProcessor: StreamProcessor;
  private toolExecutor: ToolExecutor;

  constructor(config: OpenAIClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.model = config.model ?? DEFAULT_MODEL;
    this.reasoningEffort = config.reasoningEffort ?? DEFAULT_REASONING_EFFORT;
    this.streamProcessor = new StreamProcessor();
    this.toolExecutor = new ToolExecutor();
  }

  /**
   * Stream an answer. With `previousResponseId` the server continues the
   * conversation it stored for that response, so `input` only carries what is
   * new; without it `input` has to hold the whole conversation.
   */
  async sendMessage(
    input: ResponseInputItem[],
    callbacks: StreamCallbacks,
    previousResponseId?: string,
  ): Promise<void> {
    const request = this.buildRequest(input, previousResponseId);

    try {
      const response = await this.makeRequest(request);

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
        );
      }

      const enhancedCallbacks = this.wrapCallbacks(
        callbacks,
        input,
        previousResponseId,
      );
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

  private buildRequest(
    input: ResponseInputItem[],
    previousResponseId?: string,
  ): ResponsesRequest {
    return {
      model: this.model,
      input,
      tools: getAvailableTools(),
      tool_choice: "auto",
      reasoning: { effort: this.reasoningEffort },
      stream: true,
      ...(previousResponseId
        ? { previous_response_id: previousResponseId }
        : {}),
    };
  }

  private async makeRequest(request: ResponsesRequest): Promise<Response> {
    return fetch(responsesUrl(this.baseUrl), {
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
    previousResponseId?: string,
  ): StreamCallbacks {
    return {
      ...originalCallbacks,
      onToolCalls: async (functionCalls: FunctionCallItem[]) => {
        try {
          const { outputs, images } =
            await this.toolExecutor.execute(functionCalls);
          this.reportToolActivity(
            functionCalls,
            outputs,
            images,
            originalCallbacks,
          );
          await this.continueWithToolOutputs(
            input,
            previousResponseId,
            functionCalls,
            outputs,
            images,
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
    images: ToolImageAttachment[],
    callbacks: StreamCallbacks,
  ): void {
    if (!callbacks.onToolActivity) return;

    const outputByCallId = new Map(
      outputs.map((output) => [output.call_id, output.output]),
    );
    // The log keeps the small copy: a full screenshot per call would fill the
    // session storage the conversation lives in.
    const thumbnailByCallId = new Map(
      images.map((image) => [image.callId, image.thumbnailDataUrl]),
    );

    const interactions = functionCalls.map((functionCall) => ({
      name: functionCall.name,
      arguments: functionCall.arguments,
      result: outputByCallId.get(functionCall.call_id) ?? "",
      image: thumbnailByCallId.get(functionCall.call_id),
    }));

    callbacks.onToolActivity(interactions);
  }

  /**
   * A function call output is text only, so a picture a tool produced is
   * appended as a user message right after the outputs. That is what lets the
   * model actually look at a screenshot it asked for.
   */
  private buildImageMessage(
    images: ToolImageAttachment[],
  ): ResponseInputItem[] {
    if (images.length === 0) return [];

    const content: ResponseContentPart[] = [];

    for (const image of images) {
      content.push({
        type: "input_text",
        text: `Image returned by ${image.toolName}:\n${image.description}`,
      });
      content.push({ type: "input_image", image_url: image.dataUrl });
    }

    return [{ role: "user", content }];
  }

  /**
   * Answer the function calls. When the server announced the ID of the
   * response that stopped on them, the outputs go back against that response;
   * otherwise the whole input is replayed with the calls and their outputs.
   */
  private async continueWithToolOutputs(
    input: ResponseInputItem[],
    previousResponseId: string | undefined,
    functionCalls: FunctionCallItem[],
    outputs: FunctionCallOutputItem[],
    images: ToolImageAttachment[],
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const responseId = this.streamProcessor.responseId;
    const newItems: ResponseInputItem[] = [
      ...outputs,
      ...this.buildImageMessage(images),
    ];

    this.streamProcessor.reset();

    if (responseId) {
      await this.sendMessage(newItems, callbacks, responseId);
      return;
    }

    const replayedCalls: ResponseInputItem[] = functionCalls.map(
      ({ call_id, name, arguments: args }) => ({
        type: "function_call",
        call_id,
        name,
        arguments: args,
      }),
    );

    await this.sendMessage(
      [...input, ...replayedCalls, ...newItems],
      callbacks,
      previousResponseId,
    );
  }
}
