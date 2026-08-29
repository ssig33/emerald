/**
 * Contract between the side panel (where the agent runs) and the content
 * script (which owns the DOM of the page being driven).
 */

/** Message action used for every browser agent command. */
export const BROWSER_AGENT_ACTION = "browserAgent";

export type ScrollDirection = "top" | "bottom" | "up" | "down" | "element";

/**
 * How a command points at an element: an index from the last snapshot, a CSS
 * selector, or a viewport coordinate read off a screenshot.
 */
export interface ElementTarget {
  /** Index from the most recent listElements snapshot. */
  index: number | null;
  /** CSS selector, used when no index is given. */
  selector: string | null;
  /** Horizontal viewport coordinate in CSS pixels. */
  x: number | null;
  /** Vertical viewport coordinate in CSS pixels. */
  y: number | null;
}

export interface ReadPageCommand {
  name: "readPage";
  /** Limit the outline to a subtree. Whole document when null. */
  selector: string | null;
  /** Maximum number of characters in the outline. */
  maxLength: number | null;
}

export interface ListElementsCommand {
  name: "listElements";
  /** Case-insensitive substring the element label or selector must contain. */
  filter: string | null;
  maxElements: number | null;
}

export interface ClickCommand extends ElementTarget {
  name: "click";
}

export interface HoverCommand extends ElementTarget {
  name: "hover";
}

export interface FillCommand {
  name: "fill";
  index: number | null;
  selector: string | null;
  value: string;
  /** Submit the owning form (or press Enter) after filling. */
  submit: boolean | null;
}

export interface ScrollCommand {
  name: "scroll";
  direction: ScrollDirection;
  index: number | null;
  selector: string | null;
}

export interface PressKeyCommand {
  name: "pressKey";
  /** KeyboardEvent key value, e.g. "Enter", "Escape", "ArrowDown", "a". */
  key: string;
  index: number | null;
  selector: string | null;
}

/** Describes what sits under a viewport coordinate, without acting on it. */
export interface DescribePointCommand {
  name: "describePoint";
  x: number;
  y: number;
}

/** Geometry the screenshot needs to map image pixels back to CSS pixels. */
export interface ViewportInfoCommand {
  name: "viewportInfo";
}

export type BrowserAgentCommand =
  | ReadPageCommand
  | ListElementsCommand
  | ClickCommand
  | HoverCommand
  | FillCommand
  | ScrollCommand
  | PressKeyCommand
  | DescribePointCommand
  | ViewportInfoCommand;

export interface BrowserAgentRequest {
  action: typeof BROWSER_AGENT_ACTION;
  command: BrowserAgentCommand;
}

/** Answer of the viewportInfo command, serialized as JSON in `result`. */
export interface ViewportInfo {
  /** Viewport size in CSS pixels: the coordinate space clicks use. */
  width: number;
  height: number;
  /** Device pixels per CSS pixel, i.e. how much bigger a capture comes back. */
  devicePixelRatio: number;
  scrollX: number;
  scrollY: number;
  pageWidth: number;
  pageHeight: number;
  title: string;
  url: string;
}

/**
 * Commands answer with plain text: the content script already formats the DOM
 * into the shape the model reads, so nothing has to be re-serialized later.
 */
export type BrowserAgentResponse =
  { ok: true; result: string } | { ok: false; error: string };
