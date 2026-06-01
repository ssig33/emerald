# Emerald

AI assistant browser extension with OpenAI integration. Supports Chrome and Firefox.

## Features

- Chat with OpenAI GPT models
- Screen capture and image analysis
- Page context integration
- Conversation history
- Side panel interface

## Installation

1. Clone this repository
2. Install dependencies: `pnpm install`
3. Build the extension: `pnpm run build` (builds both targets; or `pnpm run build:chrome` / `pnpm run build:firefox`)

### Chrome

Load the `dist/chrome` folder from `chrome://extensions` (Developer mode).

### Firefox

Load `dist/firefox/manifest.json` as a temporary add-on from `about:debugging#/runtime/this-firefox`.

## Configuration

Set your OpenAI API key in the extension settings.

## License

GPL-3.0
