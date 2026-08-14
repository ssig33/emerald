# Browser Agent

The browser agent lets the model operate the tab the side panel is attached to:
read its DOM, discover what can be clicked, fill forms and navigate. The tools
run without asking the user for confirmation, and every call is written into the
chat log so the operation stays visible.

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
       └─ bridge.ts  ───────────▶    └─ browser-agent.ts
                     ◀───────────         (DOM access)
                        text
```

- `src/lib/tools/browser-tools.ts` declares the tools and turns model arguments
  into commands.
- `src/lib/browser-agent/types.ts` is the command contract shared by both sides.
- `src/lib/browser-agent/bridge.ts` finds the active tab, relays commands and
  waits for navigations.
- `src/content/browser-agent.ts` executes the commands against the real DOM.

Commands answer with plain text, already formatted for the model, so nothing has
to be re-serialized on the way back.

## Tools

| Tool                    | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `browser_read_page`     | Title, URL and an indented outline of the visible DOM        |
| `browser_list_elements` | Indexed list of links, buttons and form controls             |
| `browser_click`         | Click by index or CSS selector                               |
| `browser_fill`          | Fill inputs, textareas, selects, checkboxes, contenteditable |
| `browser_navigate`      | Open a URL and wait for the load to finish                   |
| `browser_scroll`        | Move by viewport, jump to top or bottom, reveal an element   |

The usual loop is read the page, list the elements, act on an index, then list
again because the page changed.

## Element indices

`browser_list_elements` rebuilds a registry of the visible interactive elements
and hands out an index per element. `browser_click`, `browser_fill` and
`browser_scroll` accept that index, which spares the model from inventing CSS
selectors for markup it cannot see.

The registry lives in the content script, so a page load discards it. An index
that no longer resolves, or that points at a detached element, produces an error
telling the model to list the elements again. Every element line also carries a
CSS selector, which the tools accept as an alternative to the index and which
survives a reload.

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
be audited after the fact — including the arguments and the returned text.

## Permissions

Driving the page needs `tabs` (to find the active tab and follow its loading
state) and `host_permissions: <all_urls>` (to message the content script on any
page). Both are declared in `src/manifest.json` for Chrome and Firefox.
