# Emerald

AI assistant browser extension built on the OpenAI Responses API. Supports Chrome and Firefox.

## Features

- Chat with GPT-5.6 Sol (`gpt-5.6-sol`), Terra (`gpt-5.6-terra`) or Luna (`gpt-5.6-luna`), switchable from the chat UI
- Reasoning effort selectable from the chat UI (`none`, `low`, `medium`, `high`, `xhigh`, `max`)
- Web search through OpenAI's built-in `web_search` tool
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

Set your OpenAI API key in the extension settings. The model and the reasoning
effort are picked above the chat input; both are stored in extension storage, so
they persist across restarts and apply to every conversation.

## License

GPL-3.0
