import {
  FunctionCallItem,
  ResponseOutputItem,
  ResponseStreamEvent,
  StreamError,
} from "../../types/openai";
import { ToolInteraction } from "../../types";

export interface StreamCallbacks {
  onContent?: (content: string) => void;
  onToolCalls?: (functionCalls: FunctionCallItem[]) => void | Promise<void>;
  onToolActivity?: (interactions: ToolInteraction[]) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Parses the server-sent event stream of the Responses API.
 *
 * Text arrives as `response.output_text.delta` events. Completed items arrive
 * as `response.output_item.done`: function calls have to be executed locally
 * and answered with a follow-up request, while hosted tools such as web search
 * are already resolved by OpenAI and only reported for visibility.
 */
export class StreamProcessor {
  private buffer = "";
  private functionCalls: FunctionCallItem[] = [];

  async processStream(
    response: Response,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    if (!response.body) {
      throw new StreamError("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        this.buffer += decoder.decode(value, { stream: true });
        this.processBuffer(callbacks);
      }
    } catch (error) {
      if (error instanceof StreamError) {
        throw error;
      }
      const streamError = new StreamError(
        "Stream processing failed",
        error instanceof Error ? error : undefined,
      );
      callbacks.onError?.(streamError);
      throw streamError;
    }

    if (this.functionCalls.length > 0) {
      await callbacks.onToolCalls?.(this.functionCalls);
      return;
    }

    callbacks.onComplete?.();
  }

  private processBuffer(callbacks: StreamCallbacks): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() as string;

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      const data = line.slice(6);
      if (!data.startsWith("{")) continue;

      try {
        this.processEvent(this.parseEvent(data), callbacks);
      } catch (error) {
        if (error instanceof StreamError) {
          callbacks.onError?.(error);
          throw error;
        }
      }
    }
  }

  private parseEvent(data: string): ResponseStreamEvent {
    try {
      return JSON.parse(data) as ResponseStreamEvent;
    } catch (error) {
      throw new StreamError(
        "Invalid JSON in stream",
        error instanceof Error ? error : undefined,
      );
    }
  }

  private processEvent(
    event: ResponseStreamEvent,
    callbacks: StreamCallbacks,
  ): void {
    switch (event.type) {
      case "response.output_text.delta":
        if (event.delta) {
          callbacks.onContent?.(event.delta);
        }
        return;
      case "response.output_item.done":
        if (event.item) {
          this.processOutputItem(event.item, callbacks);
        }
        return;
      case "error":
        throw new StreamError(event.message || "OpenAI API Error");
      case "response.failed":
      case "response.incomplete":
        throw new StreamError(
          event.response?.error?.message || "OpenAI API Error",
        );
      default:
        return;
    }
  }

  private processOutputItem(
    item: ResponseOutputItem,
    callbacks: StreamCallbacks,
  ): void {
    if (item.type === "function_call" && item.call_id && item.name) {
      this.functionCalls.push({
        type: "function_call",
        id: item.id,
        call_id: item.call_id,
        name: item.name,
        arguments: item.arguments || "",
      });
      return;
    }

    if (item.type === "web_search_call") {
      callbacks.onToolActivity?.([
        {
          name: "web_search",
          arguments: JSON.stringify({ query: item.action?.query ?? "" }),
          result: item.status ?? "completed",
        },
      ]);
    }
  }

  reset(): void {
    this.buffer = "";
    this.functionCalls = [];
  }
}
