/**
 * Function tools that let the model drive the tab the side panel is attached
 * to. They run without asking the user for confirmation; every call is echoed
 * into the chat log so the operation stays visible.
 */
import { FunctionTool } from "../../types/openai";
import { ScrollDirection } from "../browser-agent/types";
import {
  getActiveTab,
  navigateTab,
  sendBrowserCommand,
  sendNavigatingCommand,
} from "../browser-agent/bridge";

const SCROLL_DIRECTIONS: ScrollDirection[] = [
  "top",
  "bottom",
  "up",
  "down",
  "element",
];

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
      "Click an element in the active tab, identified either by its index from browser_list_elements or by a CSS selector. The element is scrolled into view first. Reports where the page ended up, so a click that navigates is easy to follow.",
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
          description: "CSS selector of the element, used when index is null.",
        },
      },
      required: ["index", "selector"],
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
      'Scroll the active tab. Use "down" or "up" to move by one viewport (which also triggers lazy loading), "top" or "bottom" to jump, or "element" together with an index or selector to bring one element into view.',
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

export async function executeBrowserTool(
  name: string,
  args: Arguments,
): Promise<string> {
  const tab = await getActiveTab();

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
        index: optionalNumber(args, "index"),
        selector: optionalString(args, "selector"),
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
