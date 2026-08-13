export type ResponseRole = "system" | "user" | "assistant";

export interface ResponseInputText {
  type: "input_text";
  text: string;
}

export interface ResponseInputImage {
  type: "input_image";
  image_url: string;
}

export type ResponseContentPart = ResponseInputText | ResponseInputImage;

export interface ResponseMessageItem {
  role: ResponseRole;
  content: string | ResponseContentPart[];
}

export interface FunctionCallItem {
  type: "function_call";
  id?: string;
  call_id: string;
  name: string;
  arguments: string;
}

export interface FunctionCallOutputItem {
  type: "function_call_output";
  call_id: string;
  output: string;
}

export type ResponseInputItem =
  ResponseMessageItem | FunctionCallItem | FunctionCallOutputItem;

export interface FunctionTool {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
  strict: true;
}

export interface WebSearchTool {
  type: "web_search";
}

export type ToolDefinition = FunctionTool | WebSearchTool;

/** GPT-5.6 accepts none, low, medium, high, xhigh and max. */
export type ReasoningEffort =
  "none" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ResponsesRequest {
  model: string;
  input: ResponseInputItem[];
  tools: ToolDefinition[];
  tool_choice: "auto";
  reasoning: { effort: ReasoningEffort };
  stream: boolean;
}

/** Item emitted by the model, as delivered by response.output_item.* events. */
export interface ResponseOutputItem {
  type: string;
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  status?: string;
  action?: {
    type?: string;
    query?: string;
    url?: string;
  };
}

export interface ResponseStreamEvent {
  type: string;
  delta?: string;
  item?: ResponseOutputItem;
  message?: string;
  code?: string;
  response?: {
    status?: string;
    error?: {
      message?: string;
      code?: string;
    };
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public toolName: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "ToolExecutionError";
  }
}

export class StreamError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "StreamError";
  }
}
