# Emerald Chrome Extension Documentation

## Overview

Emerald is a Chrome extension that provides an AI assistant interface for web browsing. Users can interact with AI models while browsing, capture screenshots, and extract page content for contextual conversations.

## Documentation Structure

- **[Architecture Overview](./architecture/overview.md)** - High-level system design and component relationships
- **[API Communication](./architecture/api-communication.md)** - OpenAI API integration architecture
- **[Testing Strategy](./testing/strategy.md)** - Testing approach and guidelines
- **[Development Workflow](./development/workflow.md)** - Setup, build, and contribution guidelines

## Quick Start for Developers

1. **Setup**: `pnpm install`
2. **Development**: `pnpm dev`
3. **Build**: `pnpm build`
4. **Test**: `pnpm test`

## Key Technologies

- **Frontend**: React 19, TypeScript, Material-UI
- **State Management**: Zustand
- **Testing**: Vitest, Testing Library
- **Build**: Vite with Chrome Extension plugin
- **AI Integration**: OpenAI API with streaming support

## Project Structure

```
src/
├── components/          # React UI components
├── hooks/              # Custom React hooks
├── lib/                # Business logic and utilities
│   ├── openai/         # OpenAI API integration
│   ├── tools/          # Chrome extension tools
│   └── message-builder.ts
├── types/              # TypeScript type definitions
├── content/            # Content script functionality
├── background/         # Background script
└── test/              # Test utilities and mocks
```

## Core Principles

1. **Modular Architecture**: Clear separation of concerns
2. **Type Safety**: Comprehensive TypeScript coverage
3. **Test-Driven Development**: High test coverage with isolated unit tests
4. **Performance**: Optimized streaming and memory usage
5. **Maintainability**: Self-documenting code with minimal complexity
