/**
 * Function tools that let the model drive the tab the side panel is attached
 * to. They run without asking the user for confirmation; every call is echoed
 * into the chat log so the operation stays visible.
 */
import { FunctionTool } from "../../types/openai";
import { ScrollDirection } from "../browser-agent/types";
import {
  TabState,
  getActiveTab,
  navigateTab,
  sendBrowserCommand,
  sendNavigatingCommand,
} from "../browser-agent/bridge";
import {
  DEFAULT_MAX_WIDTH,
  captureScreenshot,
  describeScreenshot,
} from "../browser-agent/screenshot";

const SCROLL_DIRECTIONS: ScrollDirection[] = [
  "top",
  "bottom",
  "up",
  "down",
  "element",
];

/** A picture produced by a tool, on its way to the model and to the chat log. */
export interface ToolImage {
  dataUrl: string;
  thumbnailDataUrl: string;
  /** Caption sent alongside the image. */
  description: string;
}

export interface BrowserToolResult {
  text: string;
  image?: ToolImage;
}

export const BROWSER_TOOLS: FunctionTool[] = [
  {
    type: "function",
    name: "browser_read_page",
    description:
      "Read the DOM of the page currently open in the active tab. Returns the title, the URL and an indented outline of the visible elements: one line per element with its tag, its useful attributes (id, name, type, href, aria-label, class, …) and its own text. Use this to understand what is on the page before acting on it.",
    parameters: {
      type: "object",
      properties: {
        selector: {
          type: ["string", "null"],
          description:
            "CSS selector to limit the outline to one subtree. Null reads the whole document body.",
        },
        max_length: {
          type: ["integer", "null"],
          description:
            "Maximum number of characters of outline to return. Null uses the default of 12000.",
        },
      },
      required: ["selector", "max_length"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "browser_screenshot",
    description:
      "Take a screenshot of the visible area of the active tab and look at it. Use this whenever the layout matters, when the DOM outline is hard to make sense of (canvas, custom widgets, dense apps), or to check what actually happened after an action. The image covers the viewport and is scaled so that one image pixel is one CSS pixel, so any x/y read off it can be passed straight to browser_click, browser_hover or browser_describe_point. Only the visible part is captured: scroll and take another one to see the rest.",
    parameters: {
      type: "object",
      properties: {
        grid: {
          type: ["boolean", "null"],
          description:
            "Draw a labelled coordinate grid every 100 CSS pixels over the image. Turn it on when you intend to click by coordinates. Null means no grid.",
        },
        max_width: {
          type: ["integer", "null"],
          description:
            "Widest image to return, in pixels. Null uses the default of 1280, which matches most viewports one to one.",
        },
      },
      required: ["grid", "max_width"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "browser_list_elements",
    description:
      "List the interactive elements of the active tab: links, buttons, inputs, textareas, selects and ARIA widgets. Each line carries an index, the tag, its attributes, a label and a CSS selector. The indices stay valid until the page changes, and browser_click / browser_fill / browser_scroll accept them. Call this before clicking or filling anything.",
    parameters: {
      type: "object",
      properties: {
        filter: {
          type: ["string", "null"],
          description:
            'Case-insensitive substring an element line must contain, e.g. "login". Null lists everything.',
        },
        max_elements: {
          type: ["integer", "null"],
          description:
            "Maximum number of elements to return. Null uses the default of 150.",
        },
      },
      required: ["filter", "max_elements"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "browser_click",
    description:
      "Click an element in the active tab, identified by its index from browser_list_elements, by a CSS selector, or by x/y viewport coordinates read off a browser_screenshot. Index and selector scroll the element into view first; coordinates click exactly where they point, so do not scroll between the screenshot and the click. Reports where the page ended up, so a click that navigates is easy to follow.",
    parameters: {
      type: "object",
      properties: {
        index: {
          type: ["integer", "null"],
          description:
            "Index from the most recent browser_list_elements call. Preferred when the element is listed.",
        },
        selector: {
          type: ["string", "null"],
          description: "CSS selector of the element, used when index is null.",
        },
        x: {
          type: ["integer", "null"],
          description:
            "Horizontal viewport coordinate in CSS pixels, used when index and selector are null. Requires y.",
        },
        y: {
          type: ["integer", "null"],
          description: "Vertical viewport coordinate in CSS pixels.",
        },
      },
      required: ["index", "selector", "x", "y"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "browser_hover",
    description:
      "Move the pointer over an element or over x/y viewport coordinates in the active tab, without clicking. Use this to open menus, tooltips and other things that only appear on hover, then take a screenshot to see what came up.",
    parameters: {
      type: "object",
      properties: {
        index: {
          type: ["integer", "null"],
          description: "Index from the most recent browser_list_elements call.",
        },
        selector: {
          type: ["string", "null"],
          description: "CSS selector of the element, used when index is null.",
        },
        x: {
          type: ["integer", "null"],
          description:
            "Horizontal viewport coordinate in CSS pixels, used when index and selector are null. Requires y.",
        },
        y: {
          type: ["integer", "null"],
          description: "Vertical viewport coordinate in CSS pixels.",
        },
      },
      required: ["index", "selector", "x", "y"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "browser_describe_point",
    description:
      "Name what sits under a pair of viewport coordinates, without touching it. Answers with the stack of elements under the point, their labels, their boxes and their CSS selectors. Use it to confirm that a spot picked from a screenshot really is the control you mean before clicking it.",
    parameters: {
      type: "object",
      properties: {
        x: {
          type: "integer",
          description: "Horizontal viewport coordinate in CSS pixels.",
        },
        y: {
          type: "integer",
          description: "Vertical viewport coordinate in CSS pixels.",
        },
      },
      required: ["x", "y"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "browser_fill",
    description:
      'Fill a form control in the active tab. Works on text inputs, textareas and contenteditable elements (the value is typed in), on selects (the value matches an option by value or by visible text) and on checkboxes and radios ("true" checks, "false" unchecks). Set submit to true to submit the owning form afterwards.',
    parameters: {
      type: "object",
      properties: {
        index: {
          type: ["integer", "null"],
          description:
            "Index from the most recent browser_list_elements call. Preferred over selector.",
        },
        selector: {
          type: ["string", "null"],
          description:
            "CSS selector of the form control, used when index is null.",
        },
        value: {
          type: "string",
          description: "Value to put into the control.",
        },
        submit: {
          type: ["boolean", "null"],
          description:
            "Submit the owning form after filling (falls back to pressing Enter). Null means no submit.",
        },
      },
      required: ["index", "selector", "value", "submit"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "browser_press_key",
    description:
      'Send a single key press to the active tab: "Enter" to confirm, "Escape" to dismiss an overlay, "Tab" to move on, "ArrowDown" to walk an autocomplete list. Without an index or a selector the key goes to whatever holds the focus. Use browser_fill to enter text.',
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description:
            'KeyboardEvent key value, e.g. "Enter", "Escape", "Tab", "ArrowDown" or a single character.',
        },
        index: {
          type: ["integer", "null"],
          description:
            "Index of the element to send the key to. Null uses the focused element.",
        },
        selector: {
          type: ["string", "null"],
          description: "CSS selector of that element, used when index is null.",
        },
      },
      required: ["key", "index", "selector"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "browser_navigate",
    description:
      "Open a URL in the active tab and wait for it to finish loading. Use this to start a task on a known page, then read it with browser_read_page.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Absolute URL to open, including the scheme.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "browser_scroll",
    description:
      'Scroll the active tab. Use "down" or "up" to move by one viewport (which also triggers lazy loading), "top" or "bottom" to jump, or "element" together with an index or selector to bring one element into view. Scrolling invalidates the coordinates of the last screenshot, so take a new one afterwards.',
    parameters: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: SCROLL_DIRECTIONS,
          description: "Where to scroll.",
        },
        index: {
          type: ["integer", "null"],
          description: 'Element index, required when direction is "element".',
        },
        selector: {
          type: ["string", "null"],
          description:
            'CSS selector, an alternative to index when direction is "element".',
        },
      },
      required: ["direction", "index", "selector"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const BROWSER_TOOL_NAMES = new Set(BROWSER_TOOLS.map((tool) => tool.name));

export function isBrowserToolName(name: string): boolean {
  return BROWSER_TOOL_NAMES.has(name);
}

type Arguments = Record<string, unknown>;

function optionalString(args: Arguments, key: string): string | null {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requiredString(args: Arguments, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new Error(`Missing required "${key}" argument.`);
  }
  return value;
}

function optionalNumber(args: Arguments, key: string): number | null {
  const value = args[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // Models occasionally send an index as a string; accept it rather than fail.
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !isNaN(Number(value))
  ) {
    return Number(value);
  }
  return null;
}

function requiredNumber(args: Arguments, key: string): number {
  const value = optionalNumber(args, key);
  if (value === null) {
    throw new Error(`Missing required "${key}" argument.`);
  }
  return value;
}

function optionalBoolean(args: Arguments, key: string): boolean | null {
  const value = args[key];
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function scrollDirection(args: Arguments): ScrollDirection {
  const value = args.direction;
  if (
    typeof value === "string" &&
    (SCROLL_DIRECTIONS as string[]).includes(value)
  ) {
    return value as ScrollDirection;
  }
  throw new Error(
    `"direction" must be one of: ${SCROLL_DIRECTIONS.join(", ")}.`,
  );
}

/** Index, selector and coordinates, in the shape the content script expects. */
function elementTarget(args: Arguments) {
  return {
    index: optionalNumber(args, "index"),
    selector: optionalString(args, "selector"),
    x: optionalNumber(args, "x"),
    y: optionalNumber(args, "y"),
  };
}

export async function executeBrowserTool(
  name: string,
  args: Arguments,
): Promise<BrowserToolResult> {
  const tab = await getActiveTab();

  // The only tool that answers with a picture rather than with text.
  if (name === "browser_screenshot") {
    const shot = await captureScreenshot(tab.id, tab.windowId, {
      grid: optionalBoolean(args, "grid") ?? false,
      maxWidth: optionalNumber(args, "max_width") ?? DEFAULT_MAX_WIDTH,
    });
    const description = describeScreenshot(shot);

    return {
      text: description,
      image: {
        dataUrl: shot.dataUrl,
        thumbnailDataUrl: shot.thumbnailDataUrl,
        description,
      },
    };
  }

  return { text: await executeTextTool(name, args, tab) };
}

async function executeTextTool(
  name: string,
  args: Arguments,
  tab: TabState,
): Promise<string> {
  switch (name) {
    case "browser_read_page":
      return sendBrowserCommand(tab.id, {
        name: "readPage",
        selector: optionalString(args, "selector"),
        maxLength: optionalNumber(args, "max_length"),
      });

    case "browser_list_elements":
      return sendBrowserCommand(tab.id, {
        name: "listElements",
        filter: optionalString(args, "filter"),
        maxElements: optionalNumber(args, "max_elements"),
      });

    case "browser_click":
      return sendNavigatingCommand(tab.id, {
        name: "click",
        ...elementTarget(args),
      });

    case "browser_hover":
      return sendBrowserCommand(tab.id, {
        name: "hover",
        ...elementTarget(args),
      });

    case "browser_describe_point":
      return sendBrowserCommand(tab.id, {
        name: "describePoint",
        x: requiredNumber(args, "x"),
        y: requiredNumber(args, "y"),
      });

    case "browser_fill": {
      const submit = optionalBoolean(args, "submit");
      const command = {
        name: "fill" as const,
        index: optionalNumber(args, "index"),
        selector: optionalString(args, "selector"),
        value: requiredString(args, "value"),
        submit,
      };
      // Only a submit can navigate away; a plain fill answers immediately.
      return submit
        ? sendNavigatingCommand(tab.id, command)
        : sendBrowserCommand(tab.id, command);
    }

    case "browser_press_key":
      // A key press can confirm a form and take the page with it.
      return sendNavigatingCommand(tab.id, {
        name: "pressKey",
        key: requiredString(args, "key"),
        index: optionalNumber(args, "index"),
        selector: optionalString(args, "selector"),
      });

    case "browser_navigate": {
      const url = requiredString(args, "url");
      const state = await navigateTab(tab.id, url);
      return `Opened ${state.url} (${state.title}).`;
    }

    case "browser_scroll":
      return sendBrowserCommand(tab.id, {
        name: "scroll",
        direction: scrollDirection(args),
        index: optionalNumber(args, "index"),
        selector: optionalString(args, "selector"),
      });

    default:
      throw new Error(`Unknown browser tool: ${name}`);
  }
}
