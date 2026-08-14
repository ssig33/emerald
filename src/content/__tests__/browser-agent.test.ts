import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  handleBrowserAgentCommand,
  resetElementRegistry,
} from "../browser-agent";

const setBody = (html: string) => {
  document.body.innerHTML = html;
  resetElementRegistry();
};

/** Runs a command and fails loudly when it did not succeed. */
const run = (command: Parameters<typeof handleBrowserAgentCommand>[0]) => {
  const response = handleBrowserAgentCommand(command);
  if (!response.ok) {
    throw new Error(`Command failed: ${response.error}`);
  }
  return response.result;
};

/** Index of the element whose descriptor line contains the given text. */
const indexOf = (listing: string, text: string): number => {
  const line = listing
    .split("\n")
    .find((candidate) => candidate.includes(text));
  if (!line) throw new Error(`No element line contains "${text}":\n${listing}`);
  return Number(line.match(/^\[(\d+)\]/)![1]);
};

describe("browser agent commands", () => {
  beforeEach(() => {
    document.title = "Test Page";
    setBody("");
  });

  describe("readPage", () => {
    it("returns the page metadata and an indented outline", () => {
      setBody(`
        <div id="main">
          <h1>Welcome</h1>
          <p>Some body text</p>
        </div>
      `);

      const result = run({ name: "readPage", selector: null, maxLength: null });

      expect(result).toContain("Title: Test Page");
      expect(result).toContain("URL: http://localhost:3000/");
      expect(result).toContain('<div id="main">');
      expect(result).toContain('<h1> "Welcome"');
      expect(result).toContain('<p> "Some body text"');
    });

    it("keeps useful attributes on the outline lines", () => {
      setBody(
        '<a href="/about" class="nav-link" aria-label="About us">About</a>',
      );

      const result = run({ name: "readPage", selector: null, maxLength: null });

      expect(result).toContain('href="/about"');
      expect(result).toContain('aria-label="About us"');
      expect(result).toContain('class="nav-link"');
    });

    it("skips script and style elements", () => {
      setBody(
        "<div><script>var secret = 1;</script><style>.a{color:red}</style><span>visible</span></div>",
      );

      const result = run({ name: "readPage", selector: null, maxLength: null });

      expect(result).not.toContain("secret");
      expect(result).not.toContain("color:red");
      expect(result).toContain('<span> "visible"');
    });

    it("skips elements hidden with display none", () => {
      setBody(
        '<div><span style="display: none">hidden text</span><span>shown</span></div>',
      );

      const result = run({ name: "readPage", selector: null, maxLength: null });

      expect(result).not.toContain("hidden text");
      expect(result).toContain("shown");
    });

    it("limits the outline to the requested subtree", () => {
      setBody(
        '<div id="a"><p>inside a</p></div><div id="b"><p>inside b</p></div>',
      );

      const result = run({ name: "readPage", selector: "#b", maxLength: null });

      expect(result).toContain("inside b");
      expect(result).not.toContain("inside a");
    });

    it("truncates long outlines and says so", () => {
      setBody(
        Array.from(
          { length: 50 },
          (_, i) => `<p>paragraph number ${i}</p>`,
        ).join(""),
      );

      const result = run({ name: "readPage", selector: null, maxLength: 120 });

      expect(result).toContain("outline truncated");
    });

    it("reports an unmatched selector as an error", () => {
      const response = handleBrowserAgentCommand({
        name: "readPage",
        selector: "#missing",
        maxLength: null,
      });

      expect(response).toEqual({
        ok: false,
        error: "No element matches selector: #missing",
      });
    });
  });

  describe("listElements", () => {
    it("indexes links, buttons and form controls", () => {
      setBody(`
        <a href="/home">Home</a>
        <button id="save">Save</button>
        <input name="q" type="text" placeholder="Search" />
        <select name="size"><option value="s">Small</option></select>
        <textarea name="note"></textarea>
        <p>not interactive</p>
      `);

      const result = run({
        name: "listElements",
        filter: null,
        maxElements: null,
      });

      expect(result).toContain("5 interactive element(s)");
      expect(result).toContain('<a href="/home"> "Home"');
      expect(result).toContain('<button id="save"> "Save"');
      expect(result).toContain('placeholder="Search"');
      expect(result).toContain("<textarea");
      expect(result).not.toContain("not interactive");
    });

    it("exposes a usable selector for every element", () => {
      setBody('<div><button id="save">Save</button></div>');

      const result = run({
        name: "listElements",
        filter: null,
        maxElements: null,
      });

      expect(result).toContain('selector="#save"');
    });

    it("builds a positional selector when there is no id", () => {
      setBody("<div><button>One</button><button>Two</button></div>");

      const result = run({
        name: "listElements",
        filter: null,
        maxElements: null,
      });

      const selector = result
        .split("\n")
        .find((line) => line.includes('"Two"'))!
        .match(/selector="([^"]+)"/)![1];

      expect(document.querySelectorAll(selector)).toHaveLength(1);
      expect(document.querySelector(selector)!.textContent).toBe("Two");
    });

    it("keeps only the elements matching the filter", () => {
      setBody(`
        <button>Save changes</button>
        <button>Delete account</button>
      `);

      const result = run({
        name: "listElements",
        filter: "delete",
        maxElements: null,
      });

      expect(result).toContain("Delete account");
      expect(result).not.toContain("Save changes");
    });

    it("reports when nothing is interactive", () => {
      setBody("<p>just text</p>");

      const result = run({
        name: "listElements",
        filter: null,
        maxElements: null,
      });

      expect(result).toBe("No interactive elements matched.");
    });

    it("caps the listing and mentions what was omitted", () => {
      setBody(
        Array.from(
          { length: 5 },
          (_, i) => `<button>Button ${i}</button>`,
        ).join(""),
      );

      const result = run({
        name: "listElements",
        filter: null,
        maxElements: 2,
      });

      expect(result).toContain("3 more element(s) omitted");
    });
  });

  describe("click", () => {
    it("clicks the element referenced by index", () => {
      setBody('<button id="save">Save</button>');
      const clicked = vi.fn();
      document.getElementById("save")!.addEventListener("click", clicked);

      const listing = run({
        name: "listElements",
        filter: null,
        maxElements: null,
      });
      const result = run({
        name: "click",
        index: indexOf(listing, "Save"),
        selector: null,
      });

      expect(clicked).toHaveBeenCalledTimes(1);
      expect(result).toBe('Clicked <button> "Save".');
    });

    it("clicks the element referenced by selector", () => {
      setBody('<button class="primary">Go</button>');
      const clicked = vi.fn();
      document.querySelector(".primary")!.addEventListener("click", clicked);

      run({ name: "click", index: null, selector: ".primary" });

      expect(clicked).toHaveBeenCalledTimes(1);
    });

    it("asks for a fresh listing when the index is unknown", () => {
      setBody("<button>Save</button>");

      const response = handleBrowserAgentCommand({
        name: "click",
        index: 42,
        selector: null,
      });

      expect(response.ok).toBe(false);
      expect(response.ok === false && response.error).toContain(
        "No element at index 42",
      );
    });

    it("reports elements that left the page", () => {
      setBody('<button id="save">Save</button>');
      run({ name: "listElements", filter: null, maxElements: null });
      document.body.innerHTML = "";

      const response = handleBrowserAgentCommand({
        name: "click",
        index: 0,
        selector: null,
      });

      expect(response.ok).toBe(false);
      expect(response.ok === false && response.error).toContain(
        "no longer attached",
      );
    });

    it("requires either an index or a selector", () => {
      const response = handleBrowserAgentCommand({
        name: "click",
        index: null,
        selector: null,
      });

      expect(response).toEqual({
        ok: false,
        error: "Either index or selector must be provided.",
      });
    });
  });

  describe("fill", () => {
    it("fills a text input and fires input events", () => {
      setBody('<input id="q" name="q" type="text" />');
      const input = document.getElementById("q") as HTMLInputElement;
      const onInput = vi.fn();
      input.addEventListener("input", onInput);

      const result = run({
        name: "fill",
        index: null,
        selector: "#q",
        value: "emerald",
        submit: null,
      });

      expect(input.value).toBe("emerald");
      expect(onInput).toHaveBeenCalledTimes(1);
      expect(result).toContain('with "emerald"');
    });

    it("fills a textarea", () => {
      setBody('<textarea id="note"></textarea>');

      run({
        name: "fill",
        index: null,
        selector: "#note",
        value: "hello",
        submit: null,
      });

      expect(
        (document.getElementById("note") as HTMLTextAreaElement).value,
      ).toBe("hello");
    });

    it("selects an option by its visible text", () => {
      setBody(
        '<select id="size"><option value="s">Small</option><option value="l">Large</option></select>',
      );

      const result = run({
        name: "fill",
        index: null,
        selector: "#size",
        value: "Large",
        submit: null,
      });

      expect((document.getElementById("size") as HTMLSelectElement).value).toBe(
        "l",
      );
      expect(result).toContain("Large");
    });

    it("lists the options when none matches", () => {
      setBody('<select id="size"><option value="s">Small</option></select>');

      const response = handleBrowserAgentCommand({
        name: "fill",
        index: null,
        selector: "#size",
        value: "Huge",
        submit: null,
      });

      expect(response.ok).toBe(false);
      expect(response.ok === false && response.error).toContain(
        'Available: "Small"',
      );
    });

    it("checks and unchecks a checkbox", () => {
      setBody('<input id="agree" type="checkbox" />');
      const checkbox = document.getElementById("agree") as HTMLInputElement;

      run({
        name: "fill",
        index: null,
        selector: "#agree",
        value: "true",
        submit: null,
      });
      expect(checkbox.checked).toBe(true);

      run({
        name: "fill",
        index: null,
        selector: "#agree",
        value: "false",
        submit: null,
      });
      expect(checkbox.checked).toBe(false);
    });

    it("fills a contenteditable element", () => {
      setBody('<div id="editor" contenteditable="true"></div>');
      const editor = document.getElementById("editor") as HTMLElement;
      // jsdom does not derive isContentEditable from the attribute.
      Object.defineProperty(editor, "isContentEditable", { value: true });

      run({
        name: "fill",
        index: null,
        selector: "#editor",
        value: "typed text",
        submit: null,
      });

      expect(editor.textContent).toBe("typed text");
    });

    it("submits the owning form when asked to", () => {
      setBody('<form id="f"><input id="q" name="q" /></form>');
      const form = document.getElementById("f") as HTMLFormElement;
      const onSubmit = vi.fn((event: Event) => event.preventDefault());
      form.addEventListener("submit", onSubmit);

      const result = run({
        name: "fill",
        index: null,
        selector: "#q",
        value: "emerald",
        submit: true,
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(result).toContain("Submitted the form.");
    });

    it("presses Enter when the control has no form", () => {
      setBody('<input id="q" name="q" />');
      const input = document.getElementById("q") as HTMLInputElement;
      const onKeyDown = vi.fn();
      input.addEventListener("keydown", onKeyDown);

      const result = run({
        name: "fill",
        index: null,
        selector: "#q",
        value: "emerald",
        submit: true,
      });

      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(result).toContain("Pressed Enter");
    });

    it("refuses elements that are not form controls", () => {
      setBody("<button>Save</button>");

      const response = handleBrowserAgentCommand({
        name: "fill",
        index: null,
        selector: "button",
        value: "x",
        submit: null,
      });

      expect(response).toEqual({
        ok: false,
        error: "<button> is not a fillable form control.",
      });
    });
  });

  describe("scroll", () => {
    it("scrolls the page to the bottom", () => {
      const scrollTo = vi.fn();
      window.scrollTo = scrollTo as unknown as typeof window.scrollTo;

      const result = run({
        name: "scroll",
        direction: "bottom",
        index: null,
        selector: null,
      });

      expect(scrollTo).toHaveBeenCalled();
      expect(result).toContain("bottom");
    });

    it("brings a single element into view", () => {
      setBody('<button id="save">Save</button>');

      const result = run({
        name: "scroll",
        direction: "element",
        index: null,
        selector: "#save",
      });

      expect(result).toBe('Scrolled <button> "Save" into view.');
    });
  });
});
