/**
 * Contract between the side panel (where the agent runs) and the content
 * script (which owns the DOM of the page being driven).
 */

/** Message action used for every browser agent command. */
export const BROWSER_AGENT_ACTION = "browserAgent";

export type ScrollDirection = "top" | "bottom" | "up" | "down" | "element";

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

export interface ClickCommand {
  name: "click";
  /** Index from the most recent listElements snapshot. */
  index: number | null;
  /** CSS selector, used when no index is given. */
  selector: string | null;
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

export type BrowserAgentCommand =
  | ReadPageCommand
  | ListElementsCommand
  | ClickCommand
  | FillCommand
  | ScrollCommand;

export interface BrowserAgentRequest {
  action: typeof BROWSER_AGENT_ACTION;
  command: BrowserAgentCommand;
}

/**
 * Commands answer with plain text: the content script already formats the DOM
 * into the shape the model reads, so nothing has to be re-serialized later.
 */
export type BrowserAgentResponse =
  { ok: true; result: string } | { ok: false; error: string };
