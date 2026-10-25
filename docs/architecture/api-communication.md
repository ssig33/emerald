# API Communication Architecture

## Overview

The API communication system targets the **Responses API**, either OpenAI's or
any server compatible with it, and is designed around **streaming responses**,
**tool execution**, and **modular responsibility separation**. The architecture
supports real-time conversation updates while maintaining robust error handling
and extensibility.

The default base URL, the selectable models and the selectable reasoning efforts
live in `src/lib/openai/constants.ts`:

| Setting           | Value                                           |
| ----------------- | ----------------------------------------------- |
| Default base URL  | `https://api.openai.com/v1`                     |
| Endpoint          | `<base URL>/responses`                          |
| Models            | `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna`      |
| Default model     | `gpt-6-luna`                                    |
| Reasoning efforts | `none`, `low`, `medium`, `high`, `xhigh`, `max` |
| Default effort    | `max`                                           |

The model tiers are surfaced in the UI as Astra, Sol and Luna. Astra and Sol do
not accept the `none` effort, so the reasoning picker only lists the efforts the
selected model accepts; switching to a model that rejects the current effort
moves to its lightest accepted effort. The user-provided
API settings are the API keys, the model and the reasoning effort, all stored in
`chrome.storage.local` alongside the other settings.

### API keys

`settings.apiKeys` is a list of `{ id, label, baseUrl, apiKey }` entries with at
least one entry, and `settings.activeApiKeyId` names the one requests are sent
with (`activeApiKey()` in `src/hooks/useSettings.ts`). Keys are edited in the
settings drawer; the active key is switched there or, once more than one key is
saved, from the picker above the chat input (`selectApiKey()`). A stored
single `openaiApiKey` is read as the first entry of the list.

### Conversation state

Every finished answer records the ID of the response it ended with and the key
it was made with (`Message.responseId`, `Message.apiKeyId`). The next request
sends `previous_response_id` with only the new user message, so the server
carries the conversation. When the last answer was made with another key, or
has no response ID, the whole conversation is sent instead, starting with the
system prompt.

## Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   useApi Hook   │◄──►│   OpenAIClient  │◄──►│   OpenAI API    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ MessageBuilder  │    │ StreamProcessor │    │  ToolExecutor   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                 │                        │
                                 ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  UI Callbacks   │    │  Chrome APIs    │
                       └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. OpenAIClient (`src/lib/openai/client.ts`)

**Responsibility**: Orchestrates API communication and manages the complete request/response lifecycle.

**Key Features**:

- Request payload construction (model, tools, reasoning effort)
- Stream processing coordination
- Tool execution integration
- Error reporting (no retries: a failed request ends the answer)

**Interface**:

```typescript
interface OpenAIClient {
  sendMessage(
    input: ResponseInputItem[],
    callbacks: StreamCallbacks,
    previousResponseId?: string,
  ): Promise<void>;
}
```

When a response stops on function calls, the client runs them and sends the
`function_call_output` items (plus a user message with any images the tools
produced) with `previous_response_id` set to that response. If the server never
announced a response ID, the whole input is replayed with the calls and their
outputs instead.

One message allows at most `MAX_TOOL_ROUNDS` (20) of these follow-ups. When the
model asks for tools once more after that, the calls are not run and `onError`
reports that the answer was stopped; the browser tools run without
confirmation, so this keeps a model from driving the page indefinitely.

**Request Shape**:

```json
{
  "model": "gpt-6.1-sol",
  "input": [{ "role": "user", "content": "..." }],
  "tools": [
    { "type": "function", "name": "get_current_time" },
    { "type": "web_search" }
  ],
  "tool_choice": "auto",
  "reasoning": { "effort": "max" },
  "stream": true
}
```

**Design Principles**:

- Single responsibility: API communication only
- Dependency injection: Receives configuration, not hardcoded
- Callback-based: Non-blocking streaming interface

### 2. StreamProcessor (`src/lib/openai/stream-processor.ts`)

**Responsibility**: Parses the Responses API server-sent event stream and emits
application events.

**Handled Events**:

- `response.output_text.delta`: Streamed assistant text
- `response.output_item.done` with a `function_call` item: A local tool has to run
- `response.output_item.done` with a `web_search_call` item: Reported as tool activity
- `toolcall` with `status: "completed"`: A tool the server ran on its own, reported as tool activity
- Any event carrying `response.id` (`response.created`, `response.completed`, …): Records the response ID handed to `onComplete`
- `error`, `response.failed`, `response.incomplete`: Turned into a `StreamError`

**Processing Flow**:

```
Raw Stream → Buffer Management → Line Processing → JSON Parsing → Event Emission
```

**State Management**:

- **Buffer**: Accumulates partial stream data
- **Function Calls**: Collected until the stream ends, then handed to the client
- **Error State**: Handles malformed data gracefully

When the stream ends with pending function calls, `onToolCalls` fires instead of
`onComplete`: the conversation is not finished until the follow-up request that
carries the tool outputs has streamed its own answer.

### 3. ToolExecutor (`src/lib/tools/executor.ts`)

**Responsibility**: Executes the local function tools and manages tool lifecycle.

**Local Tools**:

- `get_current_time`: Provides current local date and time
  - Returns current local time in readable format
  - Essential for temporal context in conversations
  - Automatically called at conversation start for time-aware responses
- `browser_*`: Read and drive the active tab (`src/lib/tools/browser-tools.ts`,
  see [browser-agent.md](./browser-agent.md))

**Hosted Tools**:

- `web_search`: OpenAI's built-in web search. It runs server side, so there is
  nothing to execute locally; results and `url_citation` annotations come back in
  the same stream.

**Execution Pattern**:

```typescript
// Calls run one after another; each failure becomes an "Error: ..." output
const { outputs, images } = await toolExecutor.execute(functionCalls);
```

`outputs` holds one `function_call_output` per call. `images` holds the
pictures tools produced (`ToolImageAttachment`, tied to the call by `callId`);
a function call output is text only, so the client sends them as a user message
after the outputs.

**Error Isolation**: Tool failures don't break the conversation flow.

### 4. MessageBuilder (`src/lib/message-builder.ts`)

**Responsibility**: Converts application data structures to Responses API input items.

**Key Transformations**:

- Conversation history → input message items
- Multimodal content (`input_text` + `input_image`) → structured format
- System prompt at the head of the input whenever the whole conversation is sent
- The new user message alone (`buildCurrentMessage`) when continuing from `previous_response_id`
- Page context (`<page_context>`) prepended to the user message it was attached to
- Message role mapping (user/ai → user/assistant)

## Message Flow Patterns

### 1. Simple Text Conversation

```
User Input → MessageBuilder → OpenAIClient → StreamProcessor → UI Update
```

### 2. Multimodal Conversation (with Images)

```
User Input + Images → MessageBuilder (multimodal format) → OpenAIClient → Stream...
```

### 3. Tool-Enhanced Conversation

```
User Input → OpenAI → function_call → ToolExecutor → Chrome API →
function_call_output → OpenAI (follow-up) → StreamProcessor → UI Update
```

### 4. Web Search Conversation

```
User Input → OpenAI → hosted web search → answer with citations → StreamProcessor → UI Update
```

## Streaming Architecture

### 1. Real-time Processing

- **Chunk-based**: Process data as it arrives
- **Non-blocking**: UI remains responsive during long responses
- **Progressive rendering**: Users see responses as they're generated

### 2. Buffer Management

```typescript
// Efficient handling of partial data
private buffer = "";
private processBuffer() {
  const lines = this.buffer.split("\n");
  this.buffer = lines.pop(); // Keep incomplete line
  // Process complete lines...
}
```

### 3. Event-Driven Updates

```typescript
interface StreamCallbacks {
  onContent?: (content: string) => void; // Real-time text updates
  onToolCalls?: (calls: FunctionCallItem[]) => void; // Tool execution trigger
  onToolActivity?: (interactions: ToolInteraction[]) => void; // Tool transcript
  onComplete?: (responseId?: string) => void; // Stream completion
  onError?: (error: Error) => void; // Error handling
}
```

## Tool Integration System

### 1. Tool Definition

```typescript
// Local function tool (flat shape, as required by the Responses API)
interface FunctionTool {
  type: "function";
  name: string;
  description: string;
  parameters: JSONSchema;
  strict: true;
}

// Hosted tool
interface WebSearchTool {
  type: "web_search";
}
```

### 2. Execution Pipeline

```
OpenAI function_call → ToolExecutor.execute() → Chrome API Call → function_call_output → OpenAI
```

### 3. Error Handling in Tools

- Individual tool errors don't crash the system
- Error messages are passed back to OpenAI as tool results
- Graceful degradation: conversation continues despite tool failures

## Error Handling Strategy

### 1. Layered Error Management

**API Level Errors** (`ApiError`, thrown from `sendMessage`):

- Network failures
- Non-2xx responses: the message is `HTTP <status>: <detail>`, where the detail
  is `error.message` of a JSON body, else the body text, else the status text
  (which is empty over HTTP/2)

**Stream Level Errors** (`StreamError`, reported through `onError`):

- Invalid JSON in stream
- Failed reads of the stream
- `error`, `response.failed` and `response.incomplete` events

**Tool Round Limit**: more than `MAX_TOOL_ROUNDS` follow-ups for one message,
reported through `onError`

**Tool Level Errors**:

- Chrome API permission errors
- Tab access failures
- Content script communication errors

### 2. Error Recovery

There is no automatic retry, timeout or backoff. `useApi` shows the error
message in the chat and ends the loading state; the user sends the message
again to retry. A tool that fails does not end the answer: its error text goes
back to the model as the tool output.

## Configuration Management

### 1. Client Configuration

```typescript
interface OpenAIClientConfig {
  apiKey: string; // Required: sent as a Bearer token
  baseUrl?: string; // Defaults to https://api.openai.com/v1
  model?: ModelId; // Defaults to gpt-6-luna
  reasoningEffort?: ReasoningEffort; // Defaults to max
}
```

The tools are compiled in; the server comes from the active API key.

### 2. Runtime Configuration

- API keys and the active one
- Model and reasoning effort selection
- System prompt
- Conversation storage (S3 / MinIO) settings

## Performance Optimization

### 1. Streaming Efficiency

- **Minimal buffering**: Process data immediately when possible
- **Memory management**: Clear processed data promptly
- **Batched updates**: Accumulate rapid updates for UI efficiency

### 2. Request Optimization

- **Payload minimization**: Include only necessary message history
- **Connection reuse**: Maintain persistent connections where possible
- **Caching**: Cache static data (tool definitions, system prompts)

### 3. Chrome Extension Optimization

- **Background script efficiency**: Minimal persistent processing
- **Content script isolation**: Lightweight page interaction
- **Storage optimization**: Efficient serialization of chat data

## Extensibility Points

### 1. Adding New Tools

Add the definition to `AVAILABLE_TOOLS` and a case to `executeSingleTool`,
which returns the output and, optionally, an image:

```typescript
private async executeSingleTool(
  functionCall: FunctionCallItem,
): Promise<SingleToolResult> {
  // browser_* tools are dispatched to executeBrowserTool first
  switch (functionCall.name) {
    case "new_tool_name":
      return { output: this.executeNewTool(functionCall.call_id) };
    // ... existing cases
  }
}
```

Browser tools are defined in `BROWSER_TOOLS` and run by `executeBrowserTool` in
`src/lib/tools/browser-tools.ts` instead.

### 2. Custom Message Formatting

```typescript
// Extend MessageBuilder for new content types
buildMessages(message, history, systemPrompt, images, pageContent) {
  // Handle new context data types
  // Apply custom formatting rules
  // Return Responses API input items
}
```

## Testing Strategy for API Components

### 1. Unit Testing

- **Mock external dependencies**: OpenAI API, Chrome APIs
- **Test error scenarios**: Network failures, malformed responses
- **Verify state management**: Buffer handling, tool call accumulation

### 2. Integration Testing

- **End-to-end flows**: Complete conversation workflows
- **Tool integration**: Chrome API interaction
- **Error propagation**: Error handling across layers

### 3. Performance Testing

- **Stream processing efficiency**: Large response handling
- **Memory usage**: Long conversation history
- **Concurrent requests**: Multiple simultaneous conversations

## Security Considerations

### 1. API Key Management

- Secure storage in Chrome extension storage
- No API key logging or exposure
- Validation before use

### 2. Content Security

- Input sanitization for tool execution
- Safe handling of page content extraction
- Protection against injection attacks

### 3. Privacy Protection

- No sensitive data logging
- Minimal data retention
- User control over data sharing
