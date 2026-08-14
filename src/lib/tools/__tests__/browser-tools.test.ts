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
        "browser_list_elements",
        "browser_click",
        "browser_fill",
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
      const result = await executeBrowserTool("browser_read_page", {
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
      await executeBrowserTool("browser_list_elements", {
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
      await executeBrowserTool("browser_click", { index: "3", selector: null });

      expect(lastCommand()).toEqual({
        name: "click",
        index: 3,
        selector: null,
      });
    });

    it("reports where a click left the page", async () => {
      (chrome.tabs.get as any).mockResolvedValue({
        ...activeTab,
        url: "https://example.com/next",
        title: "Next",
      });
      sendMessage().mockResolvedValue({ ok: true, result: "Clicked <a>." });

      const result = await executeBrowserTool("browser_click", {
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

      const result = await executeBrowserTool("browser_click", {
        index: 0,
        selector: null,
      });

      expect(result).toContain("Navigated to https://example.com/next");
    });

    it("does not wait for a navigation on a plain fill", async () => {
      await executeBrowserTool("browser_fill", {
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
      await executeBrowserTool("browser_fill", {
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

      const result = await executeBrowserTool("browser_navigate", {
        url: "https://example.org/",
      });

      expect(chrome.tabs.update).toHaveBeenCalledWith(7, {
        url: "https://example.org/",
      });
      expect(result).toBe("Opened https://example.org/ (Other).");
    });

    it("rejects an unknown scroll direction", async () => {
      await expect(
        executeBrowserTool("browser_scroll", {
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
        executeBrowserTool("browser_read_page", {
          selector: null,
          max_length: null,
        }),
      ).rejects.toThrow("No element at index 9");
    });

    it("explains a missing content script", async () => {
      sendMessage().mockResolvedValue(undefined);

      await expect(
        executeBrowserTool("browser_read_page", {
          selector: null,
          max_length: null,
        }),
      ).rejects.toThrow("no content script is running in the active tab");
    });

    it("fails when there is no active tab", async () => {
      (chrome.tabs.query as any).mockResolvedValue([]);

      await expect(
        executeBrowserTool("browser_read_page", {
          selector: null,
          max_length: null,
        }),
      ).rejects.toThrow("No active tab found.");
    });
  });
});
