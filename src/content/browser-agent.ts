/**
 * Page-side half of the browser agent.
 *
 * Everything here runs inside the content script, so it has direct access to
 * the document of the tab the agent is driving. Commands arrive from the side
 * panel and are answered with text that the model reads directly.
 */
import {
  BrowserAgentCommand,
  BrowserAgentResponse,
  ScrollDirection,
} from "../lib/browser-agent/types";

/** Elements that carry no meaning for an agent reading the page. */
const SKIPPED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "LINK",
  "META",
  "HEAD",
  "SVG",
  "PATH",
  "CANVAS",
  "BR",
]);

/** Attributes worth showing in the outline, in the order they are printed. */
const KEPT_ATTRIBUTES = [
  "id",
  "name",
  "type",
  "role",
  "href",
  "value",
  "placeholder",
  "aria-label",
  "alt",
  "title",
  "for",
  "data-testid",
  "class",
];

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "label",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='tab']",
  "[role='menuitem']",
  "[role='option']",
  "[role='switch']",
  "[role='combobox']",
  "[contenteditable='true']",
  "[onclick]",
].join(",");

const DEFAULT_OUTLINE_LENGTH = 12000;
const DEFAULT_MAX_ELEMENTS = 150;
const MAX_ATTRIBUTE_LENGTH = 80;
const MAX_LABEL_LENGTH = 100;
const MAX_SELECTOR_DEPTH = 6;

/**
 * Elements from the most recent `listElements` call, addressable by index.
 * A fresh page load throws the whole content script away, so a stale index can
 * only survive within a single document.
 */
let elementRegistry: Element[] = [];

export function resetElementRegistry(): void {
  elementRegistry = [];
}

/**
 * Layout is only meaningful in a real browser: test environments report a zero
 * rect for every node, so size is checked only when the document has layout.
 */
function hasLayout(): boolean {
  const rect = document.body?.getBoundingClientRect();
  return !!rect && (rect.width > 0 || rect.height > 0);
}

function isVisible(element: Element, layout: boolean): boolean {
  if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
    return false;
  }
  if (element.hasAttribute("hidden")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;

  if (layout) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
  }

  return true;
}

function collapse(text: string, maxLength: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > maxLength
    ? `${collapsed.slice(0, maxLength)}…`
    : collapsed;
}

/** Short human-readable label, mirroring what a user would see on screen. */
function labelOf(element: Element): string {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return collapse(ariaLabel, MAX_LABEL_LENGTH);

  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") {
      return collapse(element.value || element.name || "", MAX_LABEL_LENGTH);
    }
    return collapse(
      element.placeholder || element.value || element.name || "",
      MAX_LABEL_LENGTH,
    );
  }

  if (element instanceof HTMLTextAreaElement) {
    return collapse(
      element.placeholder || element.name || "",
      MAX_LABEL_LENGTH,
    );
  }

  if (element instanceof HTMLSelectElement) {
    const selected = element.selectedOptions[0];
    return collapse(
      selected ? selected.textContent || "" : element.name,
      MAX_LABEL_LENGTH,
    );
  }

  const text = element.textContent || "";
  if (text.trim()) return collapse(text, MAX_LABEL_LENGTH);

  return collapse(
    element.getAttribute("title") || element.getAttribute("alt") || "",
    MAX_LABEL_LENGTH,
  );
}

function escapeIdent(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/([^\w-])/g, "\\$1");
}

function isUniqueSelector(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/** Best-effort CSS selector the agent can reuse after the page changes. */
export function cssSelectorFor(element: Element): string {
  const id = element.getAttribute("id");
  if (id) {
    const candidate = `#${escapeIdent(id)}`;
    if (isUniqueSelector(candidate)) return candidate;
  }

  const testId = element.getAttribute("data-testid");
  if (testId) {
    const candidate = `[data-testid="${testId}"]`;
    if (isUniqueSelector(candidate)) return candidate;
  }

  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;

    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const sameTag = Array.from(parent.children).filter(
      (child) => child.tagName === current!.tagName,
    );
    parts.unshift(
      sameTag.length > 1
        ? `${tag}:nth-of-type(${sameTag.indexOf(current) + 1})`
        : tag,
    );

    const candidate = parts.join(" > ");
    if (isUniqueSelector(candidate)) return candidate;

    const parentId = parent.getAttribute("id");
    if (parentId) {
      const scoped = `#${escapeIdent(parentId)} > ${candidate}`;
      if (isUniqueSelector(scoped)) return scoped;
    }

    current = parent;
    depth += 1;
    if (depth >= MAX_SELECTOR_DEPTH) break;
  }

  return parts.join(" > ");
}

function attributeSummary(element: Element): string {
  const parts: string[] = [];

  for (const name of KEPT_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value === null || value === "") continue;
    parts.push(`${name}="${collapse(value, MAX_ATTRIBUTE_LENGTH)}"`);
  }

  if (element instanceof HTMLInputElement && element.checked) {
    parts.push("checked");
  }
  if (
    element instanceof HTMLElement &&
    (element as HTMLInputElement).disabled === true
  ) {
    parts.push("disabled");
  }

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

/**
 * Renders the document as an indented outline: one line per element, with its
 * own text (not its descendants') appended. Far cheaper to read than raw HTML
 * while keeping structure, attributes and text.
 */
export function outlinePage(
  root: Element,
  maxLength: number,
): { text: string; truncated: boolean } {
  const layout = hasLayout();
  const lines: string[] = [];
  let length = 0;
  let truncated = false;

  const walk = (element: Element, depth: number): void => {
    if (truncated) return;
    if (SKIPPED_TAGS.has(element.tagName)) return;
    if (!isVisible(element, layout)) return;

    const indent = "  ".repeat(depth);
    const ownText = collapse(
      Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || "")
        .join(" "),
      MAX_LABEL_LENGTH * 3,
    );

    const line =
      `${indent}<${element.tagName.toLowerCase()}${attributeSummary(element)}>` +
      (ownText ? ` "${ownText}"` : "");

    if (length + line.length > maxLength) {
      truncated = true;
      return;
    }

    lines.push(line);
    length += line.length + 1;

    for (const child of Array.from(element.children)) {
      walk(child, depth + 1);
    }
  };

  walk(root, 0);

  return { text: lines.join("\n"), truncated };
}

/** Rebuilds the index registry and renders one line per interactive element. */
export function listInteractiveElements(
  filter: string | null,
  maxElements: number,
): string {
  const layout = hasLayout();
  const needle = filter ? filter.toLowerCase() : null;

  elementRegistry = [];
  const lines: string[] = [];
  let skipped = 0;

  for (const element of Array.from(
    document.querySelectorAll(INTERACTIVE_SELECTOR),
  )) {
    if (!isVisible(element, layout)) continue;

    const index = elementRegistry.length;
    const label = labelOf(element);
    const selector = cssSelectorFor(element);
    const descriptor =
      `[${index}] <${element.tagName.toLowerCase()}${attributeSummary(element)}>` +
      (label ? ` "${label}"` : "") +
      ` selector=${JSON.stringify(selector)}`;

    if (needle && !descriptor.toLowerCase().includes(needle)) continue;

    elementRegistry.push(element);

    if (lines.length >= maxElements) {
      skipped += 1;
      continue;
    }
    lines.push(descriptor);
  }

  if (lines.length === 0) {
    return "No interactive elements matched.";
  }

  const header = `${lines.length} interactive element(s) on ${document.title || "(untitled)"} — ${window.location.href}`;
  const footer =
    skipped > 0
      ? `\n… ${skipped} more element(s) omitted; narrow the search with "filter".`
      : "";

  return `${header}\n${lines.join("\n")}${footer}`;
}

/** Resolves a command target, preferring the index from the last snapshot. */
function resolveTarget(
  index: number | null,
  selector: string | null,
): HTMLElement {
  if (index !== null && index !== undefined) {
    const element = elementRegistry[index];
    if (!element) {
      throw new Error(
        `No element at index ${index}. Call browser_list_elements again to refresh the indices.`,
      );
    }
    if (!element.isConnected) {
      throw new Error(
        `Element at index ${index} is no longer attached to the page. Call browser_list_elements again.`,
      );
    }
    return element as HTMLElement;
  }

  if (selector) {
    let element: Element | null;
    try {
      element = document.querySelector(selector);
    } catch {
      throw new Error(`Invalid CSS selector: ${selector}`);
    }
    if (!element) {
      throw new Error(`No element matches selector: ${selector}`);
    }
    return element as HTMLElement;
  }

  throw new Error("Either index or selector must be provided.");
}

function describeTarget(element: Element): string {
  const label = labelOf(element);
  return `<${element.tagName.toLowerCase()}>` + (label ? ` "${label}"` : "");
}

function clickElement(element: HTMLElement): string {
  element.scrollIntoView?.({ block: "center", inline: "nearest" });
  element.focus?.();
  element.click();
  return `Clicked ${describeTarget(element)}.`;
}

/**
 * Frameworks such as React track the value through the prototype setter, so
 * assigning `element.value` directly would leave their state out of sync.
 */
function setNativeValue(element: HTMLElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(element),
    "value",
  );
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    (element as HTMLInputElement).value = value;
  }
}

function dispatchInputEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillSelect(element: HTMLSelectElement, value: string): string {
  const options = Array.from(element.options);
  const match =
    options.find((option) => option.value === value) ??
    options.find(
      (option) =>
        (option.textContent || "").trim().toLowerCase() ===
        value.trim().toLowerCase(),
    ) ??
    options.find((option) =>
      (option.textContent || "").toLowerCase().includes(value.toLowerCase()),
    );

  if (!match) {
    const available = options
      .map((option) => `"${(option.textContent || "").trim()}"`)
      .join(", ");
    throw new Error(`No option matches "${value}". Available: ${available}`);
  }

  element.value = match.value;
  dispatchInputEvents(element);
  return `Selected "${(match.textContent || match.value).trim()}".`;
}

function fillCheckable(element: HTMLInputElement, value: string): string {
  const desired = !["false", "0", "no", "off", "unchecked", ""].includes(
    value.trim().toLowerCase(),
  );
  if (element.checked !== desired) {
    element.click();
  }
  return `${desired ? "Checked" : "Unchecked"} ${describeTarget(element)}.`;
}

function submitFrom(element: HTMLElement): string {
  const form = (element as HTMLInputElement).form;
  if (form) {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.submit();
    }
    return " Submitted the form.";
  }

  for (const type of ["keydown", "keypress", "keyup"] as const) {
    element.dispatchEvent(
      new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        bubbles: true,
      }),
    );
  }
  return " Pressed Enter (no owning form).";
}

function fillElement(
  element: HTMLElement,
  value: string,
  submit: boolean,
): string {
  element.scrollIntoView?.({ block: "center", inline: "nearest" });
  element.focus?.();

  let message: string;

  if (element instanceof HTMLSelectElement) {
    message = fillSelect(element, value);
  } else if (
    element instanceof HTMLInputElement &&
    (element.type === "checkbox" || element.type === "radio")
  ) {
    message = fillCheckable(element, value);
  } else if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    setNativeValue(element, value);
    dispatchInputEvents(element);
    message = `Filled ${describeTarget(element)} with "${collapse(value, MAX_LABEL_LENGTH)}".`;
  } else if (element.isContentEditable) {
    element.textContent = value;
    dispatchInputEvents(element);
    message = `Filled the contenteditable element with "${collapse(value, MAX_LABEL_LENGTH)}".`;
  } else {
    throw new Error(
      `<${element.tagName.toLowerCase()}> is not a fillable form control.`,
    );
  }

  return submit ? message + submitFrom(element) : message;
}

function scrollPage(
  direction: ScrollDirection,
  index: number | null,
  selector: string | null,
): string {
  if (direction === "element") {
    const element = resolveTarget(index, selector);
    element.scrollIntoView?.({ block: "center", inline: "nearest" });
    return `Scrolled ${describeTarget(element)} into view.`;
  }

  const viewport = window.innerHeight || 800;

  switch (direction) {
    case "top":
      window.scrollTo(0, 0);
      return "Scrolled to the top of the page.";
    case "bottom":
      window.scrollTo(0, document.body.scrollHeight);
      return "Scrolled to the bottom of the page.";
    case "up":
      window.scrollBy(0, -viewport * 0.9);
      return "Scrolled up one viewport.";
    case "down":
      window.scrollBy(0, viewport * 0.9);
      return "Scrolled down one viewport.";
  }
}

function runCommand(command: BrowserAgentCommand): string {
  switch (command.name) {
    case "readPage": {
      const root = command.selector
        ? document.querySelector(command.selector)
        : document.body || document.documentElement;
      if (!root) {
        throw new Error(`No element matches selector: ${command.selector}`);
      }

      const { text, truncated } = outlinePage(
        root,
        command.maxLength ?? DEFAULT_OUTLINE_LENGTH,
      );
      const header = `Title: ${document.title}\nURL: ${window.location.href}\n\n`;
      const footer = truncated
        ? '\n\n… outline truncated. Narrow it with "selector" or raise "max_length".'
        : "";
      return header + text + footer;
    }

    case "listElements":
      return listInteractiveElements(
        command.filter,
        command.maxElements ?? DEFAULT_MAX_ELEMENTS,
      );

    case "click":
      return clickElement(resolveTarget(command.index, command.selector));

    case "fill":
      return fillElement(
        resolveTarget(command.index, command.selector),
        command.value,
        command.submit ?? false,
      );

    case "scroll":
      return scrollPage(command.direction, command.index, command.selector);
  }
}

export function handleBrowserAgentCommand(
  command: BrowserAgentCommand,
): BrowserAgentResponse {
  try {
    return { ok: true, result: runCommand(command) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Browser command failed",
    };
  }
}
