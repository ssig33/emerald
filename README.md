# Emerald

AI assistant browser extension built on the OpenAI Responses API. Supports Chrome and Firefox.

## Features

- Chat with GPT-5.6 Sol (`gpt-5.6-sol`), Terra (`gpt-5.6-terra`) or Luna (`gpt-5.6-luna`), switchable from the chat UI
- Reasoning effort selectable from the chat UI (`none`, `low`, `medium`, `high`, `xhigh`, `max`)
- Web search through OpenAI's built-in `web_search` tool
- Browser agent: the assistant reads the DOM of the active tab, takes screenshots
  and looks at them, lists what it can click, fills forms, clicks by coordinates
  and navigates on its own, and logs every action in the chat
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
effort are picked above the chat input, behind a summary button that expands the
pickers when you need them. The selection and the expanded state are stored in
extension storage, so they persist across restarts and apply to every
conversation.

## Browser agent

The assistant can drive the tab the side panel is open on. It reads the page
structure, lists the links, buttons and form controls it can act on, then clicks,
types and navigates. There is no headless browser involved: the extension already
runs in the browser, so the commands execute in the content script of the page.

It can also look at the page: `browser_screenshot` photographs the viewport and
hands the image to the model, optionally with a coordinate grid drawn on top.
The picture is scaled so that one image pixel is one CSS pixel, so anything the
model spots on it can be clicked, hovered or inspected straight away by its x/y
coordinates — useful for canvases, charts and widgets whose markup says nothing.

These tools fire without asking for confirmation, so the assistant can work
through a task on its own. Every call is written into the chat log — expand the
"tool actions" chip under an answer to see what ran and what it returned.

Pages without a content script (`chrome://`, `about:`, the extension gallery)
cannot be driven. See [docs/architecture/browser-agent.md](./docs/architecture/browser-agent.md).

## License

GPL-3.0
