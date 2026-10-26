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

/**
 * Tool-output follow-ups allowed for one message. Browser tools run without
 * confirmation, so a model that keeps calling them is stopped here.
 */
export const MAX_TOOL_ROUNDS = 20;

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
    await this.send(input, callbacks, previousResponseId, 0);
  }

  /** `toolRounds` counts the tool-output follow-ups made so far for this message. */
  private async send(
    input: ResponseInputItem[],
    callbacks: StreamCallbacks,
    previousResponseId: string | undefined,
    toolRounds: number,
  ): Promise<void> {
    const request = this.buildRequest(input, previousResponseId);

    try {
      const response = await this.makeRequest(request);

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${await this.errorDetail(response)}`,
          response.status,
        );
      }

      const enhancedCallbacks = this.wrapCallbacks(
        callbacks,
        input,
        previousResponseId,
        toolRounds,
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

  /**
   * The reason the server gave for a failed request: `error.message` of a JSON
   * body, else the body itself, else the status text (empty over HTTP/2).
   */
  private async errorDetail(response: Response): Promise<string> {
    let body = "";
    try {
      body = (await response.text()).trim();
    } catch {
      // Fall back to the status text.
    }

    if (body) {
      try {
        const message = JSON.parse(body)?.error?.message;
        if (typeof message === "string" && message) return message;
      } catch {
        // Not JSON: show the body as it is.
      }
      return body;
    }

    return response.statusText || "Request failed";
  }

  private wrapCallbacks(
    originalCallbacks: StreamCallbacks,
    input: ResponseInputItem[],
    previousResponseId: string | undefined,
    toolRounds: number,
  ): StreamCallbacks {
    return {
      ...originalCallbacks,
      onToolCalls: async (functionCalls: FunctionCallItem[]) => {
        if (toolRounds >= MAX_TOOL_ROUNDS) {
          originalCallbacks.onError?.(
            new Error(
              `Stopped after ${MAX_TOOL_ROUNDS} rounds of tool calls without a final answer.`,
            ),
          );
          return;
        }

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
            toolRounds + 1,
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
    toolRounds: number,
  ): Promise<void> {
    const responseId = this.streamProcessor.responseId;
    const newItems: ResponseInputItem[] = [
      ...outputs,
      ...this.buildImageMessage(images),
    ];

    this.streamProcessor.reset();

    if (responseId) {
      await this.send(newItems, callbacks, responseId, toolRounds);
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

    await this.send(
      [...input, ...replayedCalls, ...newItems],
      callbacks,
      previousResponseId,
      toolRounds,
    );
  }
}
