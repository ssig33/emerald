# API Communication Architecture

## Overview

The API communication system is designed around **streaming responses**, **tool execution**, and **modular responsibility separation**. The architecture supports real-time conversation updates while maintaining robust error handling and extensibility.

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

- Configuration management (API key, model, base URL)
- Request payload construction
- Stream processing coordination
- Tool execution integration
- Error handling and retry logic

**Interface**:

```typescript
interface OpenAIClient {
  sendMessage(
    messages: OpenAIMessage[],
    callbacks: StreamCallbacks,
  ): Promise<void>;
}
```

**Design Principles**:

- Single responsibility: API communication only
- Dependency injection: Receives configuration, not hardcoded
- Callback-based: Non-blocking streaming interface

### 2. StreamProcessor (`src/lib/openai/stream-processor.ts`)

**Responsibility**: Handles OpenAI streaming response parsing and event emission.

**Key Features**:

- Real-time chunk processing
- Tool call accumulation
- JSON parsing with error recovery
- Buffer management for partial data
- Event-driven architecture

**Processing Flow**:

```
Raw Stream → Buffer Management → Line Processing → JSON Parsing → Event Emission
```

**State Management**:

- **Buffer**: Accumulates partial stream data
- **Tool Calls Buffer**: Builds complete tool calls from deltas
- **Error State**: Handles malformed data gracefully

### 3. ToolExecutor (`src/lib/tools/executor.ts`)

**Responsibility**: Executes Chrome extension tools and manages tool lifecycle.

**Current Tools**:

- `get_page_text`: Extracts and processes page content from active tab
  - Fetches HTML content from the page
  - Parses HTML using Defuddle for intelligent content extraction
  - Converts processed content to Markdown using Turndown
  - Returns clean, structured text content

**Execution Pattern**:

```typescript
// Tool execution is async and error-isolated
const results = await toolExecutor.execute(toolCalls);
// Each tool call gets individual error handling
```

**Error Isolation**: Tool failures don't break the conversation flow.

### 4. MessageBuilder (`src/lib/message-builder.ts`)

**Responsibility**: Converts application data structures to OpenAI API format.

**Key Transformations**:

- Conversation history → OpenAI messages
- Multimodal content (text + images) → structured format
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
User Input → OpenAI → Tool Call → ToolExecutor → Chrome API →
Tool Result → OpenAI (follow-up) → StreamProcessor → UI Update
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
  onToolCalls?: (calls: ToolCall[]) => void; // Tool execution trigger
  onComplete?: () => void; // Stream completion
  onError?: (error: Error) => void; // Error handling
}
```

## Tool Integration System

### 1. Tool Definition

```typescript
interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}
```

### 2. Execution Pipeline

```
OpenAI Tool Request → ToolExecutor.execute() → Chrome API Call → Result → OpenAI
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
  model?: string; // Optional: Model selection (default: gpt-4.1)
  baseUrl?: string; // Optional: Custom API endpoint
}
```

### 2. Runtime Configuration

- API key validation
- Model capability detection
- Feature flag management
- Environment-specific settings

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

### 1. Adding New AI Providers

```typescript
// Implement common interface
interface AIClient {
  sendMessage(messages: Message[], callbacks: StreamCallbacks): Promise<void>;
}

// Register new provider
const client = providerFactory.create(providerType, config);
```

### 2. Adding New Tools

```typescript
// Extend ToolExecutor with new tool
private async executeSingleTool(toolCall: ToolCall): Promise<ToolResult> {
  switch (toolCall.function.name) {
    case "new_tool_name":
      return await this.executeNewTool(toolCall.id);
    // ... existing cases
  }
}
```

### 3. Custom Message Formatting

```typescript
// Extend MessageBuilder for new content types
buildMessages(message, history, systemPrompt, contextData) {
  // Handle new context data types
  // Apply custom formatting rules
  // Return OpenAI-compatible format
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
