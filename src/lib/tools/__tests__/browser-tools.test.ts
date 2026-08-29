import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BROWSER_TOOLS,
  executeBrowserTool,
  isBrowserToolName,
} from "../browser-tools";
import { BROWSER_AGENT_ACTION } from "../../browser-agent/types";

const activeTab = {
  id: 7,
  url: "https://example.com",
  title: "Example",
  status: "complete",
};

const sendMessage = () =>
  chrome.tabs.sendMessage as unknown as ReturnType<typeof vi.fn>;

/** Last command object handed to the content script. */
const lastCommand = () => sendMessage().mock.calls.at(-1)![1].command;

/** Runs a tool and returns the text it answers with. */
const runTool = async (
  name: string,
  args: Record<string, unknown>,
): Promise<string> => (await executeBrowserTool(name, args)).text;

describe("browser tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (chrome.tabs.query as any).mockResolvedValue([activeTab]);
    (chrome.tabs.get as any).mockResolvedValue(activeTab);
    (chrome.tabs.update as any).mockResolvedValue(activeTab);
    sendMessage().mockResolvedValue({ ok: true, result: "done" });
  });

  describe("definitions", () => {
    it("declares every browser tool in strict Responses API format", () => {
      expect(BROWSER_TOOLS.map((tool) => tool.name)).toEqual([
        "browser_read_page",
        "browser_screenshot",
        "browser_list_elements",
        "browser_click",
        "browser_hover",
        "browser_describe_point",
        "browser_fill",
        "browser_press_key",
        "browser_navigate",
        "browser_scroll",
      ]);

      for (const tool of BROWSER_TOOLS) {
        expect(tool.type).toBe("function");
        expect(tool.strict).toBe(true);
        expect(tool.parameters.additionalProperties).toBe(false);
        // Strict mode requires every declared property to be required.
        expect(tool.parameters.required.sort()).toEqual(
          Object.keys(tool.parameters.properties).sort(),
        );
      }
    });

    it("recognises its own tool names only", () => {
      expect(isBrowserToolName("browser_click")).toBe(true);
      expect(isBrowserToolName("get_current_time")).toBe(false);
    });
  });

  describe("execution", () => {
    it("sends a readPage command to the active tab", async () => {
      const result = await runTool("browser_read_page", {
        selector: "#main",
        max_length: 500,
      });

      expect(sendMessage()).toHaveBeenCalledWith(7, {
        action: BROWSER_AGENT_ACTION,
        command: { name: "readPage", selector: "#main", maxLength: 500 },
      });
      expect(result).toBe("done");
    });

    it("passes nulls through for omitted optional arguments", async () => {
      await runTool("browser_list_elements", {
        filter: null,
        max_elements: null,
      });

      expect(lastCommand()).toEqual({
        name: "listElements",
        filter: null,
        maxElements: null,
      });
    });

    it("accepts an index that arrives as a string", async () => {
      await runTool("browser_click", { index: "3", selector: null });

      expect(lastCommand()).toEqual({
        name: "click",
        index: 3,
        selector: null,
        x: null,
        y: null,
      });
    });

    it("reports where a click left the page", async () => {
      (chrome.tabs.get as any).mockResolvedValue({
        ...activeTab,
        url: "https://example.com/next",
        title: "Next",
      });
      sendMessage().mockResolvedValue({ ok: true, result: "Clicked <a>." });

      const result = await runTool("browser_click", {
        index: 0,
        selector: null,
      });

      expect(result).toContain("Clicked <a>.");
      expect(result).toContain("Navigated to https://example.com/next (Next).");
    });

    it("treats a lost content script after a click as a navigation", async () => {
      sendMessage().mockRejectedValue(
        new Error(
          "Could not establish connection. Receiving end does not exist.",
        ),
      );
      (chrome.tabs.get as any).mockResolvedValue({
        ...activeTab,
        url: "https://example.com/next",
        title: "Next",
      });

      const result = await runTool("browser_click", {
        index: 0,
        selector: null,
      });

      expect(result).toContain("Navigated to https://example.com/next");
    });

    it("clicks at viewport coordinates", async () => {
      await runTool("browser_click", {
        index: null,
        selector: null,
        x: 120,
        y: 240,
      });

      expect(lastCommand()).toEqual({
        name: "click",
        index: null,
        selector: null,
        x: 120,
        y: 240,
      });
    });

    it("hovers without waiting for a navigation", async () => {
      await runTool("browser_hover", {
        index: null,
        selector: null,
        x: 10,
        y: 20,
      });

      expect(lastCommand()).toEqual({
        name: "hover",
        index: null,
        selector: null,
        x: 10,
        y: 20,
      });
      expect(chrome.tabs.get).not.toHaveBeenCalled();
    });

    it("describes a point", async () => {
      await runTool("browser_describe_point", { x: 5, y: 6 });

      expect(lastCommand()).toEqual({ name: "describePoint", x: 5, y: 6 });
    });

    it("refuses a point without coordinates", async () => {
      await expect(
        runTool("browser_describe_point", { x: null, y: null }),
      ).rejects.toThrow('Missing required "x" argument.');
    });

    it("sends a key press and follows the page it may load", async () => {
      await runTool("browser_press_key", {
        key: "Enter",
        index: null,
        selector: null,
      });

      expect(lastCommand()).toEqual({
        name: "pressKey",
        key: "Enter",
        index: null,
        selector: null,
      });
      expect(chrome.tabs.get).toHaveBeenCalledWith(7);
    });

    it("does not wait for a navigation on a plain fill", async () => {
      await runTool("browser_fill", {
        index: 2,
        selector: null,
        value: "emerald",
        submit: null,
      });

      expect(lastCommand()).toEqual({
        name: "fill",
        index: 2,
        selector: null,
        value: "emerald",
        submit: null,
      });
      expect(chrome.tabs.get).not.toHaveBeenCalled();
    });

    it("waits for the page after a submitting fill", async () => {
      await runTool("browser_fill", {
        index: 2,
        selector: null,
        value: "emerald",
        submit: true,
      });

      expect(chrome.tabs.get).toHaveBeenCalledWith(7);
    });

    it("opens a URL and waits for the load to finish", async () => {
      (chrome.tabs.get as any).mockResolvedValue({
        ...activeTab,
        url: "https://example.org/",
        title: "Other",
      });

      const result = await runTool("browser_navigate", {
        url: "https://example.org/",
      });

      expect(chrome.tabs.update).toHaveBeenCalledWith(7, {
        url: "https://example.org/",
      });
      expect(result).toBe("Opened https://example.org/ (Other).");
    });

    it("rejects an unknown scroll direction", async () => {
      await expect(
        runTool("browser_scroll", {
          direction: "sideways",
          index: null,
          selector: null,
        }),
      ).rejects.toThrow('"direction" must be one of');
    });

    it("surfaces the error reported by the content script", async () => {
      sendMessage().mockResolvedValue({
        ok: false,
        error: "No element at index 9",
      });

      await expect(
        runTool("browser_read_page", {
          selector: null,
          max_length: null,
        }),
      ).rejects.toThrow("No element at index 9");
    });

    it("explains a missing content script", async () => {
      sendMessage().mockResolvedValue(undefined);

      await expect(
        runTool("browser_read_page", {
          selector: null,
          max_length: null,
        }),
      ).rejects.toThrow("no content script is running in the active tab");
    });

    it("captures the tab and hands the picture back", async () => {
      sendMessage().mockResolvedValue({
        ok: true,
        result: JSON.stringify({
          width: 1280,
          height: 720,
          devicePixelRatio: 2,
          scrollX: 0,
          scrollY: 400,
          pageWidth: 1280,
          pageHeight: 4000,
          title: "Example",
          url: "https://example.com/",
        }),
      });

      const result = await executeBrowserTool("browser_screenshot", {
        grid: true,
        max_width: null,
      });

      expect(lastCommand()).toEqual({ name: "viewportInfo" });
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalled();
      expect(result.image?.dataUrl).toMatch(/^data:image\//);
      expect(result.image?.thumbnailDataUrl).toMatch(/^data:image\//);
      expect(result.text).toContain("Screenshot of https://example.com/");
      expect(result.text).toContain("Viewport 1280x720 CSS px");
      expect(result.text).toContain("scrolled to (0, 400)");
    });

    it("still captures when no content script answers", async () => {
      sendMessage().mockResolvedValue(undefined);

      const result = await executeBrowserTool("browser_screenshot", {
        grid: null,
        max_width: null,
      });

      expect(result.image?.dataUrl).toMatch(/^data:image\//);
      expect(result.text).toContain("viewport geometry is unknown");
    });

    it("reports a capture the browser refused", async () => {
      (chrome.tabs.captureVisibleTab as any).mockImplementation(
        (_windowId: number, _options: unknown, callback: () => void) => {
          (chrome.runtime as any).lastError = {
            message: "Cannot access contents of the page",
          };
          callback();
          (chrome.runtime as any).lastError = null;
        },
      );

      await expect(
        executeBrowserTool("browser_screenshot", {
          grid: null,
          max_width: null,
        }),
      ).rejects.toThrow("The tab could not be captured");
    });

    it("fails when there is no active tab", async () => {
      (chrome.tabs.query as any).mockResolvedValue([]);

      await expect(
        runTool("browser_read_page", {
          selector: null,
          max_length: null,
        }),
      ).rejects.toThrow("No active tab found.");
    });
  });
});
