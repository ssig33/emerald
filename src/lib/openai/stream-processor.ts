import { OpenAIStreamChunk, ToolCall, StreamError } from "../../types/openai";

export interface StreamCallbacks {
  onContent?: (content: string) => void;
  onToolCalls?: (toolCalls: ToolCall[]) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export class StreamProcessor {
  private buffer = "";
  private toolCallsBuffer: { [index: string]: Partial<ToolCall> } = {};

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
        await this.processBuffer(callbacks);
      }

      callbacks.onComplete?.();
    } catch (error) {
      const streamError = new StreamError(
        "Stream processing failed",
        error instanceof Error ? error : undefined,
      );
      callbacks.onError?.(streamError);
      throw streamError;
    }
  }

  private async processBuffer(callbacks: StreamCallbacks): Promise<void> {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() as string;

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);

        if (data === "[DONE]") {
          return;
        }

        if (data.startsWith("{")) {
          try {
            const chunk = this.parseChunk(data);
            await this.processChunk(chunk, callbacks);
          } catch (error) {
            if (error instanceof StreamError) {
              callbacks.onError?.(error);
              throw error;
            }
          }
        }
      }
    }
  }

  private parseChunk(data: string): OpenAIStreamChunk {
    try {
      const parsed = JSON.parse(data) as OpenAIStreamChunk;

      if (parsed.error) {
        throw new StreamError(parsed.error.message || "OpenAI API Error");
      }

      return parsed;
    } catch (error) {
      if (error instanceof StreamError) {
        throw error;
      }
      throw new StreamError(
        "Invalid JSON in stream",
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async processChunk(
    chunk: OpenAIStreamChunk,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const choice = chunk.choices?.[0];
    if (!choice) return;

    const { delta, finish_reason } = choice;

    if (delta?.content) {
      callbacks.onContent?.(delta.content);
    }

    if (delta?.tool_calls) {
      this.processToolCallsDeltas(delta.tool_calls);
    }

    if (finish_reason === "tool_calls") {
      const toolCalls = this.buildToolCallsFromBuffer();
      if (toolCalls.length > 0) {
        callbacks.onToolCalls?.(toolCalls);
      }
    }
  }

  private processToolCallsDeltas(
    toolCallsDeltas: Array<{
      index: number;
      id?: string;
      type?: "function";
      function?: {
        name?: string;
        arguments?: string;
      };
    }>,
  ): void {
    for (const delta of toolCallsDeltas) {
      const index = delta.index.toString();

      if (!this.toolCallsBuffer[index]) {
        this.toolCallsBuffer[index] = {
          id: "",
          type: "function",
          function: {
            name: "",
            arguments: "",
          },
        };
      }

      const bufferedToolCall = this.toolCallsBuffer[index];

      if (delta.id) {
        bufferedToolCall.id = (bufferedToolCall.id || "") + delta.id;
      }

      if (delta.function) {
        if (delta.function.name) {
          bufferedToolCall.function!.name =
            (bufferedToolCall.function!.name || "") + delta.function.name;
        }
        if (delta.function.arguments) {
          bufferedToolCall.function!.arguments =
            (bufferedToolCall.function!.arguments || "") +
            delta.function.arguments;
        }
      }
    }
  }

  private buildToolCallsFromBuffer(): ToolCall[] {
    return Object.keys(this.toolCallsBuffer)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((key) => {
        const buffered = this.toolCallsBuffer[key];
        return {
          id: buffered.id || "",
          type: "function" as const,
          function: {
            name: buffered.function?.name || "",
            arguments: buffered.function?.arguments || "",
          },
        };
      })
      .filter((toolCall) => toolCall.id && toolCall.function.name);
  }

  reset(): void {
    this.buffer = "";
    this.toolCallsBuffer = {};
  }
}
