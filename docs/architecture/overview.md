# Architecture Overview

## System Design Philosophy

Emerald follows a **modular, layered architecture** that separates concerns and promotes maintainability. The system is designed around the principle of **unidirectional data flow** with clear boundaries between layers.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Layer      │    │  Business Logic │    │   External      │
│   (Components)  │◄──►│   (Hooks/Lib)   │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
    React State            Custom Hooks               OpenAI API
    User Interactions      State Management          Chrome APIs
    Material-UI           Data Processing           Storage APIs
```

## Core Modules

### 1. UI Layer (`src/components/`)

- **Responsibility**: User interface and user interactions
- **Key Components**: ChatArea, InputArea, ModelSelector, ThreadList, ImageSelector
- **Pattern**: Presentational components with minimal business logic
- **Communication**: Props down, events up

### 2. Hook Layer (`src/hooks/`)

- **Responsibility**: State management and business logic coordination
- **Key Hooks**: `useApi`, `useChatThread`, `useSettings`, `useStorage`
- **Pattern**: Custom hooks encapsulate stateful logic
- **Benefits**: Reusable, testable, composable

### 3. Business Logic Layer (`src/lib/`)

- **Responsibility**: Core business logic and external service integration
- **Architecture**: Modular classes with single responsibilities

#### OpenAI Integration (`src/lib/openai/`)

```
OpenAIClient
├── StreamProcessor     # Handles streaming Responses API events
├── ToolExecutor       # Executes local function tools
└── MessageBuilder     # Converts to Responses API input items
```

The client talks to the OpenAI Responses API only. The endpoint, the selectable
models and the selectable reasoning efforts are declared in
`src/lib/openai/constants.ts`; the active model and reasoning effort come from
the settings, which the user changes through `ModelSelector`. That component
keeps its pickers collapsed behind a summary button and stores the expanded
state in the settings as well.

#### Tool System (`src/lib/tools/`)

- **ToolExecutor**: Executes the local function tools
- **Local Tools**: `get_current_time` and the browser agent tools
- **Hosted Tools**: OpenAI's built-in `web_search`, resolved server side
- **Pattern**: Strategy pattern for tool implementations

#### Browser Agent (`src/lib/browser-agent/`, `src/content/browser-agent.ts`)

The browser tools (`browser_read_page`, `browser_screenshot`,
`browser_list_elements`, `browser_click`, `browser_hover`,
`browser_describe_point`, `browser_fill`, `browser_press_key`,
`browser_navigate`, `browser_scroll`) let the model operate the active tab. They
run without user confirmation, and every call is logged into the chat by
`ToolActivityLog`. The side panel sends commands through
`browser-agent/bridge.ts`; the content script executes them against the real
DOM. `browser-agent/screenshot.ts` photographs the tab and feeds the picture
back to the model as an image. See [Browser Agent](./browser-agent.md).

### 4. Type System (`src/types/`)

- **Responsibility**: Type safety and API contracts
- **Structure**: Domain-specific type definitions
- **Benefit**: Compile-time error detection and IDE support

## Data Flow

### Request Flow

```
User Input → InputArea → useApi → OpenAIClient → StreamProcessor → UI Update
```

### Tool Execution Flow

```
OpenAI Tool Call → ToolExecutor → Chrome API → Tool Result → OpenAI → Response
                                      │
                                      └─ browser tools → content script → DOM
```

### State Management

- **Local State**: React useState for component-specific data
- **Global State**: Custom hooks for cross-component state
- **Persistence**: Chrome storage APIs for settings and chat history

## Key Design Patterns

### 1. Dependency Injection

```typescript
// Services are injected, not imported directly
const client = new OpenAIClient({ apiKey });
const processor = new StreamProcessor();
```

### 2. Observer Pattern

```typescript
// Streaming responses use callbacks
await client.sendMessage(messages, {
  onContent: (chunk) => setContent((prev) => prev + chunk),
  onError: (error) => setError(error.message),
});
```

### 3. Factory Pattern

```typescript
// MessageBuilder creates appropriate message formats
const messages = messageBuilder.buildMessages(
  currentMessage,
  history,
  systemPrompt,
  images,
);
```

### 4. Strategy Pattern

```typescript
// Different tools can be executed through common interface
const results = await toolExecutor.execute(functionCalls);
```

## Error Handling Strategy

### 1. Layered Error Handling

- **UI Layer**: Display user-friendly error messages
- **Hook Layer**: Handle and transform errors appropriately
- **Service Layer**: Throw specific error types

### 2. Custom Error Types

```typescript
class ApiError extends Error {
  /* API-specific error context */
}
class ToolExecutionError extends Error {
  /* Tool-specific error context */
}
class StreamError extends Error {
  /* Streaming error context */
}
```

### 3. Graceful Degradation

- Network errors: Show retry options
- Tool errors: Continue conversation with error message
- Streaming errors: Fallback to error state

## Performance Considerations

### 1. Streaming Processing

- **Chunk-based processing**: Handle data as it arrives
- **Memory management**: Efficient buffer management for large responses
- **Error resilience**: Continue processing despite partial failures

### 2. Component Optimization

- **React.memo**: Prevent unnecessary re-renders
- **State locality**: Keep state close to where it's used
- **Lazy loading**: Load components and data on demand

### 3. Chrome Extension Optimization

- **Background script efficiency**: Minimal persistent background processing
- **Content script isolation**: Minimal impact on host pages
- **Storage optimization**: Efficient data serialization and storage

## Extensibility Points

### 1. New Tools

Add new tools by:

1. Implementing tool logic in `ToolExecutor`
2. Adding tool definition to `AVAILABLE_TOOLS`
3. Adding tests for new functionality

### 2. New UI Components

Add by:

1. Following existing component patterns
2. Using Material-UI design system
3. Implementing comprehensive tests

## Testing Architecture

### 1. Unit Testing

- **Isolated testing**: Each module tested independently
- **Mock dependencies**: External services mocked appropriately
- **Comprehensive coverage**: All critical paths covered

### 2. Integration Testing

- **Hook testing**: Test complete hook workflows
- **Component testing**: Test component behavior with mocked services
- **End-to-end scenarios**: Critical user workflows tested

### 3. Test Organization

```
__tests__/
├── unit/              # Pure unit tests
├── integration/       # Cross-module tests
└── fixtures/         # Test data and utilities
```

## Development Workflow

### 1. Feature Development

1. Design module interfaces
2. Implement with tests (TDD approach)
3. Integrate with existing components
4. Test end-to-end functionality

### 2. Code Quality

- **TypeScript strict mode**: Maximum type safety
- **ESLint/Prettier**: Code consistency
- **Test coverage**: Maintain high coverage
- **Code reviews**: Architectural consistency

### 3. Deployment

- **Build process**: Vite-based bundling
- **Extension packaging**: Chrome extension format
- **Environment management**: Development vs production configs
