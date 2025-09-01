# Development Workflow and Contributing Guide

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **pnpm**: Package manager (install via `npm install -g pnpm`)
- **Chrome/Chromium**: For extension testing
- **Git**: Version control

### Initial Setup

```bash
# Clone the repository
git clone [repository-url]
cd emerald

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test
```

### Development Environment

```bash
# Development commands
pnpm dev          # Start development server with hot reload
pnpm build        # Build production version
pnpm test         # Run test suite
pnpm test --watch # Run tests in watch mode
pnpm test --coverage # Run tests with coverage report
```

## Development Process

### 1. Feature Development Workflow

#### Planning Phase

1. **Understand Requirements**: Review feature specifications and acceptance criteria
2. **Architecture Design**: Plan how the feature fits into existing architecture
3. **Break Down Tasks**: Divide feature into small, testable components
4. **Create GitHub Issue**: Document the feature with clear description and tasks

#### Implementation Phase

1. **Create Feature Branch**:

   ```bash
   git checkout -b feature/description-of-feature
   ```

2. **Test-Driven Development**:
   - Write failing tests first
   - Implement minimal code to pass tests
   - Refactor while keeping tests green

3. **Follow Architecture Patterns**:
   - Maintain separation of concerns
   - Use existing patterns and conventions
   - Keep components focused and reusable

4. **Regular Commits**:
   ```bash
   git add .
   git commit -m "feat: add component for feature X"
   ```

#### Review Phase

1. **Self-Review**: Check code quality, test coverage, and documentation
2. **Create Pull Request**: Include clear description and testing instructions
3. **Address Feedback**: Respond to review comments promptly
4. **Merge**: Squash and merge after approval

### 2. Bug Fix Workflow

#### Investigation Phase

1. **Reproduce the Bug**: Create minimal reproduction steps
2. **Identify Root Cause**: Use debugging tools and logging
3. **Plan Solution**: Design fix that addresses root cause, not just symptoms

#### Fix Phase

1. **Create Bug Fix Branch**:

   ```bash
   git checkout -b fix/bug-description
   ```

2. **Write Regression Test**: Ensure bug won't reoccur
3. **Implement Fix**: Make minimal changes to resolve issue
4. **Verify Fix**: Test manually and ensure all tests pass

## Code Quality Standards

### 1. TypeScript Guidelines

#### Type Safety

```typescript
// ✅ Good: Use specific types
interface UserMessage {
  id: string;
  content: string;
  sender: "user";
  timestamp: number;
}

// ❌ Avoid: Generic types when specific ones are available
const message: any = {
  /* ... */
};
```

#### Interface Design

```typescript
// ✅ Good: Clear, focused interfaces
interface StreamCallbacks {
  onContent?: (content: string) => void;
  onError?: (error: Error) => void;
}

// ❌ Avoid: Kitchen-sink interfaces
interface EverythingInterface {
  // 20+ unrelated properties
}
```

### 2. React Guidelines

#### Component Design

```typescript
// ✅ Good: Focused, testable component
interface ChatMessageProps {
  message: Message;
  onEdit?: (id: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onEdit }) => {
  // Minimal, focused implementation
};

// ❌ Avoid: Components with too many responsibilities
const MegaComponent = () => {
  // Handles API calls, state management, UI, and business logic
};
```

#### Hook Usage

```typescript
// ✅ Good: Custom hooks for reusable stateful logic
const useApiCall = (endpoint: string) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  // Hook implementation
  return { data, loading, refetch };
};

// ❌ Avoid: Complex logic directly in components
const Component = () => {
  // 50 lines of stateful logic mixed with JSX
};
```

### 3. Architecture Guidelines

#### Dependency Direction

```
UI Layer → Hook Layer → Business Logic Layer → External Services
```

#### Module Organization

- **Single Responsibility**: Each module has one clear purpose
- **High Cohesion**: Related functionality grouped together
- **Low Coupling**: Minimal dependencies between modules

#### Error Handling

```typescript
// ✅ Good: Specific error types with context
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ❌ Avoid: Generic error handling
throw new Error("Something went wrong");
```

## Testing Guidelines

### 1. Test Requirements

- **All new features**: Must include comprehensive tests
- **Bug fixes**: Must include regression tests
- **Refactoring**: Maintain or improve test coverage

### 2. Test Quality Standards

```typescript
// ✅ Good: Clear, descriptive test
it("should update loading state when API request starts", async () => {
  const { result } = renderHook(() => useApi());

  act(() => {
    result.current.sendMessage(mockRequest);
  });

  expect(result.current.loading).toBe(true);
});

// ❌ Avoid: Vague or unclear tests
it("should work", () => {
  // Unclear what "work" means
  expect(true).toBe(true);
});
```

### 3. Coverage Requirements

- **Unit Tests**: 90%+ for business logic
- **Integration Tests**: All critical user workflows
- **Component Tests**: All user interactions

## Code Review Process

### 1. Review Checklist

#### Architecture and Design

- [ ] Follows established patterns and conventions
- [ ] Maintains separation of concerns
- [ ] Has appropriate abstraction level
- [ ] Doesn't introduce unnecessary complexity

#### Code Quality

- [ ] TypeScript types are specific and accurate
- [ ] Functions are focused and testable
- [ ] Error handling is comprehensive
- [ ] Performance implications considered

#### Testing

- [ ] Adequate test coverage
- [ ] Tests are clear and maintainable
- [ ] Edge cases and error scenarios covered
- [ ] No flaky or unreliable tests

#### Documentation

- [ ] Code is self-documenting
- [ ] Complex logic is explained
- [ ] API changes are documented
- [ ] Breaking changes noted

### 2. Review Guidelines

#### For Reviewers

- **Be Constructive**: Focus on improvement, not criticism
- **Explain Reasoning**: Help reviewer understand the "why"
- **Suggest Alternatives**: Provide specific improvement suggestions
- **Approve Thoughtfully**: Ensure code meets quality standards

#### For Authors

- **Provide Context**: Explain design decisions in PR description
- **Keep PRs Focused**: One feature or fix per PR
- **Respond Promptly**: Address feedback quickly
- **Ask Questions**: Seek clarification when feedback is unclear

## Chrome Extension Development

### 1. Extension Structure

```
dist/                   # Built extension files
├── manifest.json      # Extension configuration
├── popup.html         # Extension popup
├── background.js      # Service worker
└── content.js         # Content script
```

### 2. Development Workflow

```bash
# Build extension for development
pnpm build

# Load extension in Chrome
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist` folder
```

### 3. Testing Extension Features

- **Popup Interface**: Test UI interactions and state management
- **Content Script**: Test page interaction and data extraction
- **Background Script**: Test API calls and data persistence
- **Permissions**: Verify required permissions work correctly

## Release Process

### 1. Version Management

```bash
# Update version in package.json
npm version patch|minor|major

# Tag release
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

### 2. Pre-Release Checklist

- [ ] All tests pass
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] No breaking changes (or properly documented)

### 3. Release Steps

1. **Create Release Branch**: `git checkout -b release/v1.2.3`
2. **Update Version**: Update package.json and manifest.json
3. **Build Production**: `pnpm build`
4. **Test Build**: Manual testing of production build
5. **Create PR**: Merge to main branch
6. **Tag Release**: Create git tag
7. **Package Extension**: Create .zip for Chrome Web Store

## Troubleshooting

### 1. Common Development Issues

#### Build Issues

```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Clean build
rm -rf dist
pnpm build
```

#### Test Issues

```bash
# Run tests with verbose output
pnpm test --reporter=verbose

# Run specific test file
pnpm test src/path/to/test.ts

# Debug test with console output
pnpm test --no-coverage
```

#### Extension Loading Issues

- **Reload Extension**: Go to chrome://extensions/ and click reload
- **Check Manifest**: Verify manifest.json syntax and permissions
- **Check Console**: Look for errors in extension popup and background consoles

### 2. Debugging Tools

#### Chrome DevTools

- **Extension Popup**: Right-click popup → Inspect
- **Background Script**: chrome://extensions/ → Inspect views: background
- **Content Script**: Use regular page DevTools

#### Development Logging

```typescript
// Use conditional logging for development
const isDev = process.env.NODE_ENV === "development";
if (isDev) console.log("Debug info:", data);
```

## Contributing Guidelines

### 1. Before Contributing

- Read this documentation thoroughly
- Understand the architecture and patterns
- Set up development environment
- Run tests to ensure everything works

### 2. Contribution Types

- **Bug Reports**: Use issue template, include reproduction steps
- **Feature Requests**: Provide clear use cases and requirements
- **Code Contributions**: Follow development workflow
- **Documentation**: Improve clarity and completeness

### 3. Community Standards

- **Be Respectful**: Treat all community members with respect
- **Be Collaborative**: Work together to improve the project
- **Be Patient**: Allow time for reviews and responses
- **Be Learning-Oriented**: Help others learn and grow

### 4. Getting Help

- **Architecture Questions**: Refer to architecture documentation
- **Code Issues**: Use GitHub issues or discussions
- **Development Setup**: Check troubleshooting section first
- **Testing**: Refer to testing strategy documentation

## Performance Guidelines

### 1. Chrome Extension Performance

- **Minimize Background Processing**: Use event-driven patterns
- **Efficient Storage**: Use appropriate storage APIs and data structures
- **Memory Management**: Clean up resources and avoid memory leaks
- **Lazy Loading**: Load features only when needed

### 2. React Performance

- **Component Optimization**: Use React.memo for expensive components
- **State Management**: Keep state local when possible
- **Re-render Prevention**: Optimize deps arrays and callbacks
- **Bundle Size**: Monitor and optimize bundle size

### 3. API Performance

- **Streaming**: Process data as it arrives
- **Caching**: Cache appropriate data to reduce API calls
- **Error Recovery**: Implement efficient retry strategies
- **Request Optimization**: Minimize payload sizes and request frequency
