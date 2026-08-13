# API Communication Architecture

## Overview

The API communication system targets the **OpenAI Responses API** exclusively and
is designed around **streaming responses**, **tool execution**, and **modular
responsibility separation**. The architecture supports real-time conversation
updates while maintaining robust error handling and extensibility.

Fixed configuration lives in `src/lib/openai/constants.ts`:

| Setting          | Value                                 |
| ---------------- | ------------------------------------- |
| Endpoint         | `https://api.openai.com/v1/responses` |
| Model            | `gpt-5.6-luna`                        |
| Reasoning effort | `max`                                 |

The only user-provided API setting is the OpenAI API key.

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
- Error handling and retry logic

**Interface**:

```typescript
interface OpenAIClient {
  sendMessage(
    input: ResponseInputItem[],
    callbacks: StreamCallbacks,
  ): Promise<void>;
}
```

**Request Shape**:

```json
{
  "model": "gpt-5.6-luna",
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

**Hosted Tools**:

- `web_search`: OpenAI's built-in web search. It runs server side, so there is
  nothing to execute locally; results and `url_citation` annotations come back in
  the same stream.

**Execution Pattern**:

```typescript
// Tool execution is async and error-isolated
const outputs = await toolExecutor.execute(functionCalls);
// Each function call gets individual error handling
```

**Error Isolation**: Tool failures don't break the conversation flow.

### 4. MessageBuilder (`src/lib/message-builder.ts`)

**Responsibility**: Converts application data structures to Responses API input items.

**Key Transformations**:

- Conversation history → input message items
- Multimodal content (`input_text` + `input_image`) → structured format
- System prompt injection for new conversations
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
  onComplete?: () => void; // Stream completion
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

**API Level Errors**:

- HTTP errors (network, authentication, rate limits)
- Malformed responses
- Timeout handling

**Stream Level Errors**:

- Invalid JSON in stream
- Unexpected stream termination
- Buffer overflow protection

**Tool Level Errors**:

- Chrome API permission errors
- Tab access failures
- Content script communication errors

### 2. Error Recovery Patterns

**Retry Logic**:

```typescript
// Exponential backoff for transient errors
// Circuit breaker for persistent failures
// Fallback to degraded functionality
```

**User Experience**:

- Clear error messages for user-actionable issues
- Silent retry for transient network issues
- Graceful degradation when tools are unavailable

## Configuration Management

### 1. Client Configuration

```typescript
interface OpenAIClientConfig {
  apiKey: string; // Required: OpenAI API authentication
}
```

Everything else is fixed: model, endpoint, reasoning effort and tools are
compiled in, so there is no provider, model or endpoint selection to configure.

### 2. Runtime Configuration

- API key validation
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

```typescript
// Extend ToolExecutor with new tool
private async executeSingleTool(
  functionCall: FunctionCallItem,
): Promise<FunctionCallOutputItem> {
  switch (functionCall.name) {
    case "new_tool_name":
      return await this.executeNewTool(functionCall.call_id);
    // ... existing cases
  }
}
```

### 2. Custom Message Formatting

```typescript
// Extend MessageBuilder for new content types
buildMessages(message, history, systemPrompt, contextData) {
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
