# Browser Agent

The browser agent lets the model operate the tab the side panel is attached to:
read its DOM, look at the page, discover what can be clicked, fill forms and
navigate. The tools run without asking the user for confirmation, and every call
is written into the chat log so the operation stays visible.

## No headless browser

Emerald already runs inside the browser it drives, so there is no Playwright or
Puppeteer dependency and no second browser process. The commands execute in the
content script of the page under control, which is faster than a remote driver
and works on pages the user is already signed in to.

The consequence is that the agent can only act on pages a content script can
reach. Browser-internal pages (`chrome://`, `about:`, the extension gallery)
have no content script, and the tools report that instead of failing silently.

## Layers

```
Side panel                          Page
──────────                          ────
ToolExecutor
  └─ browser-tools.ts   command    content.ts
       ├─ bridge.ts  ───────────▶    └─ browser-agent.ts
       │             ◀───────────         (DOM access)
       │                text
       └─ screenshot.ts ── chrome.tabs.captureVisibleTab
```

- `src/lib/tools/browser-tools.ts` declares the tools and turns model arguments
  into commands.
- `src/lib/browser-agent/types.ts` is the command contract shared by both sides.
- `src/lib/browser-agent/bridge.ts` finds the active tab, relays commands and
  waits for navigations.
- `src/lib/browser-agent/screenshot.ts` photographs the tab and scales the
  result into the coordinate space the page is clicked in.
- `src/content/browser-agent.ts` executes the commands against the real DOM.

Commands answer with plain text, already formatted for the model, so nothing has
to be re-serialized on the way back. The one exception is the screenshot, which
also carries an image.

## Tools

| Tool                     | Purpose                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `browser_read_page`      | Title, URL and an indented outline of the visible DOM        |
| `browser_screenshot`     | Picture of the viewport, optionally with a coordinate grid   |
| `browser_list_elements`  | Indexed list of links, buttons and form controls             |
| `browser_click`          | Click by index, CSS selector or viewport coordinates         |
| `browser_hover`          | Move the pointer somewhere without clicking                  |
| `browser_describe_point` | Name the elements under a coordinate, without touching them  |
| `browser_fill`           | Fill inputs, textareas, selects, checkboxes, contenteditable |
| `browser_press_key`      | Send one key press, e.g. Enter, Escape, Tab, ArrowDown       |
| `browser_navigate`       | Open a URL and wait for the load to finish                   |
| `browser_scroll`         | Move by viewport, jump to top or bottom, reveal an element   |

The usual loop is read the page, list the elements, act on an index, then list
again because the page changed. When the markup says little — a canvas, a chart,
a custom widget — the loop becomes screenshot, aim, click at the coordinates,
screenshot again.

## Element indices

`browser_list_elements` rebuilds a registry of the visible interactive elements
and hands out an index per element. `browser_click`, `browser_hover`,
`browser_fill`, `browser_press_key` and `browser_scroll` accept that index,
which spares the model from inventing CSS selectors for markup it cannot see.

The registry lives in the content script, so a page load discards it. An index
that no longer resolves, or that points at a detached element, produces an error
telling the model to list the elements again. Every element line also carries a
CSS selector, which the tools accept as an alternative to the index and which
survives a reload.

## Looking at the page

`browser_screenshot` photographs the visible area with
`chrome.tabs.captureVisibleTab`. The image travels back to the model as an
`input_image`: a function call output is text only, so the picture is appended
as a user message right after the outputs of the round that produced it. The
chat log keeps a small copy of it under the tool actions chip.

A capture comes back in device pixels, which is not the space the page is
clicked in. The image is therefore scaled to the CSS size of the viewport, so
one image pixel is one CSS pixel and a position read off the picture is already
a valid click coordinate. `grid: true` paints a labelled ruler every 100 CSS
pixels over the image to make those positions readable without counting.

Only the visible area is captured; the rest of the page needs a scroll and
another shot. Browser-internal pages cannot be photographed at all, and the tool
says so rather than returning a blank image.

## Clicking what you can see

`browser_click`, `browser_hover` and `browser_describe_point` accept x/y
viewport coordinates in CSS pixels as an alternative to an index or a selector.
The content script resolves them with `document.elementFromPoint`, so a click
lands on whatever a real pointer would hit at that spot, overlays included.

Coordinates are relative to the viewport, so they expire as soon as the page
scrolls: take the screenshot, act on it, take another one. A click aimed at a
coordinate does not scroll its target into view first, for the same reason.
`browser_describe_point` answers with the stack of elements under the point,
their boxes and their selectors, which is the cheap way to confirm an aim before
committing to it.

Events are dispatched with their coordinates attached (`pointerdown`,
`mousedown`, `mouseup`, `click`), so handlers that read `clientX` / `clientY` —
canvases, maps, drag pickers — see the position the model aimed at.

## Reading the DOM

Raw HTML is mostly noise. `browser_read_page` walks the document and emits one
line per element, indented by depth:

```
<div id="main" class="container">
  <h1> "Example Domain"
  <p> "This domain is for use in documents."
  <a href="/more" class="link"> "More information..."
```

Elements that carry no meaning (`script`, `style`, `svg`, `meta`, …) and
elements hidden by CSS are skipped, attribute values are shortened, and only the
element's own text is printed, not its descendants'. The output is capped
(12000 characters by default) and says so when it is cut short.

## Navigation

A click or a form submit can destroy the content script before it answers. The
command is therefore answered synchronously, and if the response is lost anyway
the bridge treats the disconnect as a navigation rather than an error. Either
way it waits for the tab to finish loading and appends where the page ended up:

```
Clicked <button> "Log in".
Navigated to https://example.com/dashboard (Dashboard).
```

## Logging

`OpenAIClient` reports every executed call through `onToolActivity`, which the
side panel appends to the streaming message. `ToolActivityLog` renders them
under a collapsible chip inside the assistant bubble, so an autonomous run can
be audited after the fact — including the arguments, the returned text and, for
a screenshot, a thumbnail of the picture the model was shown.

## Permissions

Driving the page needs `tabs` (to find the active tab and follow its loading
state) and `host_permissions: <all_urls>` (to message the content script on any
page, and to photograph it). Both are declared in `src/manifest.json` for Chrome
and Firefox.
