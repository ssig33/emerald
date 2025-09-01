# Testing Strategy and Guidelines

## Overview

The testing strategy emphasizes **comprehensive coverage**, **isolation**, and **maintainability**. We use a layered testing approach that mirrors our application architecture, ensuring each component is thoroughly tested in isolation and integration.

## Testing Philosophy

### Core Principles

1. **Test Pyramid**: More unit tests, fewer integration tests, minimal E2E
2. **Isolation**: Each test should be independent and deterministic
3. **Fast Feedback**: Tests should run quickly and provide clear failure messages
4. **Maintainable**: Tests should be easy to understand and modify
5. **Confidence**: Tests should provide confidence in deployment and refactoring

### Test-Driven Development (TDD)

We encourage TDD for new features:

1. **Red**: Write a failing test
2. **Green**: Write minimal code to make it pass
3. **Refactor**: Improve code while keeping tests green

## Test Organization

### Directory Structure

```
src/
├── lib/
│   ├── __tests__/              # Business logic tests
│   ├── openai/__tests__/       # API communication tests
│   └── tools/__tests__/        # Tool execution tests
├── hooks/__tests__/            # Hook logic tests
├── components/__tests__/       # UI component tests
└── test/                       # Test utilities and global mocks
    ├── setup.ts               # Test environment setup
    └── mocks/                 # Shared mock implementations
```

### Test Categories

#### 1. Unit Tests

**Scope**: Individual functions, classes, and components in isolation
**Location**: `__tests__` directories adjacent to source files
**Coverage**: All critical business logic, edge cases, and error scenarios

#### 2. Integration Tests

**Scope**: Multiple components working together
**Location**: Mixed with unit tests, clearly labeled
**Coverage**: Cross-module communication, data flow, and API integration

#### 3. Component Tests

**Scope**: React components with user interactions
**Location**: `components/__tests__/`
**Coverage**: User workflows, state changes, and event handling

## Testing Tools and Configuration

### Core Testing Stack

- **Test Runner**: Vitest (fast, Vite-integrated)
- **Testing Library**: React Testing Library (user-centric testing)
- **Assertions**: Vitest built-in matchers + jest-dom
- **Mocking**: Vitest mocks + manual mocks for complex dependencies

### Test Environment Setup

```typescript
// src/test/setup.ts - Global test configuration
import { beforeEach, vi } from "vitest";
import "@testing-library/jest-dom";

// Global mocks for Chrome APIs
global.chrome = {
  storage: { local: mockChromeStorage },
  tabs: { query: vi.fn(), sendMessage: vi.fn() },
};
```

## Component Testing Guidelines

### 1. Component Test Structure

```typescript
describe('ComponentName', () => {
  // Test component rendering
  it('should render with default props', () => {
    render(<Component />);
    expect(screen.getByRole('...')).toBeInTheDocument();
  });

  // Test user interactions
  it('should handle user click', async () => {
    const user = userEvent.setup();
    render(<Component onAction={mockFn} />);
    await user.click(screen.getByRole('button'));
    expect(mockFn).toHaveBeenCalled();
  });

  // Test error states
  it('should display error message when prop invalid', () => {
    render(<Component error="Test error" />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
});
```

### 2. Testing Principles for Components

- **User-centric**: Test what users see and do, not implementation details
- **Accessibility**: Use semantic queries (getByRole, getByLabelText)
- **Async handling**: Properly await async operations and state updates
- **Mock external dependencies**: API calls, Chrome APIs, complex utilities

## Hook Testing Guidelines

### 1. Hook Test Pattern

```typescript
describe("useCustomHook", () => {
  it("should initialize with correct default state", () => {
    const { result } = renderHook(() => useCustomHook());
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
  });

  it("should handle async operations", async () => {
    const { result } = renderHook(() => useCustomHook());

    await act(async () => {
      await result.current.fetchData();
    });

    expect(result.current.data).toBeDefined();
  });
});
```

### 2. Hook Testing Best Practices

- **State transitions**: Test all state changes and their triggers
- **Side effects**: Mock and verify external calls (APIs, storage)
- **Error handling**: Test error scenarios and recovery
- **Dependencies**: Mock complex dependencies for isolation

## Business Logic Testing

### 1. Class-based Testing

```typescript
describe("BusinessLogicClass", () => {
  let instance: BusinessLogicClass;

  beforeEach(() => {
    instance = new BusinessLogicClass(mockConfig);
  });

  it("should process input correctly", () => {
    const result = instance.processInput(testInput);
    expect(result).toEqual(expectedOutput);
  });

  it("should handle errors gracefully", () => {
    expect(() => instance.processInput(invalidInput)).toThrow(
      "Expected error message",
    );
  });
});
```

### 2. API Integration Testing

```typescript
describe("OpenAIClient", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("should make correct API calls", async () => {
    mockFetch.mockResolvedValue(mockResponse);

    await client.sendMessage(messages, callbacks);

    expect(fetch).toHaveBeenCalledWith(expectedUrl, expectedOptions);
  });
});
```

## Mocking Strategies

### 1. Chrome API Mocking

```typescript
// src/test/mocks/chrome.ts
export const mockChromeStorage = {
  local: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
  },
};

export const mockChromeTabs = {
  query: vi.fn().mockResolvedValue([{ id: 123 }]),
  sendMessage: vi.fn().mockResolvedValue({ text: "mock content" }),
};
```

### 2. API Response Mocking

```typescript
// Create realistic mock responses
const createMockStreamResponse = (chunks: string[]) => ({
  ok: true,
  body: {
    getReader: () => createMockReader(chunks),
  },
});

// Use in tests
global.fetch = vi
  .fn()
  .mockResolvedValue(createMockStreamResponse(['data: {"content":"test"}']));
```

### 3. Module Mocking

```typescript
// Mock complex dependencies at module level
vi.mock("../external-dependency", () => ({
  ComplexService: vi.fn().mockImplementation(() => ({
    method: vi.fn().mockResolvedValue("mock result"),
  })),
}));
```

## Error Scenario Testing

### 1. Network Errors

```typescript
it("should handle network failures", async () => {
  global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

  const { result } = renderHook(() => useApi());

  await act(async () => {
    await result.current.sendMessage(mockRequest);
  });

  expect(result.current.error).toContain("Network error");
});
```

### 2. Malformed Data

```typescript
it("should handle invalid JSON responses", async () => {
  const invalidJsonChunks = ["data: {invalid json}"];
  global.fetch = vi
    .fn()
    .mockResolvedValue(createMockResponse(invalidJsonChunks));

  await expect(streamProcessor.processStream(response)).rejects.toThrow(
    StreamError,
  );
});
```

### 3. Chrome Extension Errors

```typescript
it("should handle missing tab permissions", async () => {
  chrome.tabs.query = vi.fn().mockResolvedValue([]);

  const results = await toolExecutor.execute(toolCalls);

  expect(results[0].content).toContain("No active tab found");
});
```

## Test Data Management

### 1. Test Fixtures

```typescript
// src/test/fixtures/messages.ts
export const mockConversation = [
  { id: "1", content: "Hello", sender: "user", timestamp: 123456 },
  { id: "2", content: "Hi there!", sender: "ai", timestamp: 123457 },
];

export const mockImageData = {
  dataUrl: "data:image/png;base64,mock-data",
  timestamp: 123456,
};
```

### 2. Factory Functions

```typescript
// Create test data dynamically
const createMockMessage = (overrides = {}) => ({
  id: "test-id",
  content: "Test message",
  sender: "user",
  timestamp: Date.now(),
  ...overrides,
});
```

## Performance Testing Guidelines

### 1. Large Data Testing

```typescript
it("should handle large conversation history", () => {
  const largeHistory = Array(1000)
    .fill(null)
    .map((_, i) =>
      createMockMessage({ id: `msg-${i}`, content: `Message ${i}` }),
    );

  const messages = messageBuilder.buildMessages("New message", largeHistory);

  // Verify performance and memory usage
  expect(messages.length).toBeLessThanOrEqual(expectedLimit);
});
```

### 2. Streaming Performance

```typescript
it("should process large streams efficiently", async () => {
  const largeStreamChunks = createLargeStreamData();

  const startTime = performance.now();
  await streamProcessor.processStream(response, callbacks);
  const duration = performance.now() - startTime;

  expect(duration).toBeLessThan(acceptableThreshold);
});
```

## Continuous Integration Testing

### 1. Test Execution

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Run tests in watch mode
pnpm test --watch
```

### 2. Coverage Requirements

- **Unit Tests**: 90%+ coverage for business logic
- **Integration Tests**: Cover all critical user paths
- **Component Tests**: Cover all user interactions

### 3. Test Quality Metrics

- **Speed**: Unit tests < 10ms, integration tests < 100ms
- **Reliability**: No flaky tests, deterministic outcomes
- **Maintainability**: Clear test names, minimal setup complexity

## Test Maintenance Guidelines

### 1. Test Naming Conventions

```typescript
// Pattern: should [expected behavior] when [condition]
it("should update loading state when API request starts", () => {});
it("should display error message when network request fails", () => {});
it("should reset form when user clicks reset button", () => {});
```

### 2. Test Organization

- **Group related tests**: Use describe blocks for logical grouping
- **Setup/teardown**: Use beforeEach/afterEach for common setup
- **Clear assertions**: One logical concept per test

### 3. Refactoring Tests

- **Update tests when refactoring code**: Keep tests aligned with implementation
- **Remove obsolete tests**: Clean up tests for removed features
- **Improve test quality**: Regularly review and improve test clarity

## Debugging Test Issues

### 1. Common Issues and Solutions

- **Async timing**: Use proper async/await and act() wrappers
- **Mock persistence**: Clear mocks between tests
- **DOM cleanup**: Ensure components are properly unmounted

### 2. Debug Tools

```typescript
// Debug component state
screen.debug(); // Print current DOM state

// Debug hook state
console.log(result.current); // Log current hook state

// Debug API calls
console.log(fetch.mock.calls); // See all fetch calls made
```

### 3. Test Environment Debugging

- **Isolate failing tests**: Run individual tests to identify issues
- **Check mock setup**: Verify mocks are configured correctly
- **Review error messages**: Read full error traces for context
