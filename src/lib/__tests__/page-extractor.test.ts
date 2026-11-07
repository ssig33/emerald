import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { extractPageContent } from "../page-extractor";

const PAGE_HTML =
  "<html><head><title>Doc</title></head><body><article><h1>Heading</h1><p>Body text of the article.</p></article></body></html>";

const queryTabs = () => chrome.tabs.query as unknown as Mock;
const sendTabMessage = () => chrome.tabs.sendMessage as unknown as Mock;

function stubPage(
  url: string,
  extractResponse: unknown = { text: PAGE_HTML },
): void {
  queryTabs().mockResolvedValue([{ id: 7, url }]);
  sendTabMessage().mockImplementation(
    async (_tabId: number, message: { action: string }) => {
      if (message.action === "extractHtml") return extractResponse;
      if (message.action === "getPageInfo") return { url, title: "Doc" };
      throw new Error(`unexpected action ${message.action}`);
    },
  );
}

describe("extractPageContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns markdown content by default", async () => {
    stubPage("https://example.com/post");

    const content = await extractPageContent();

    expect(content.title).toBe("Doc");
    expect(content.url).toBe("https://example.com/post");
    expect(content.html).toBe(PAGE_HTML);
    expect(content.markdown).toContain("Body text of the article.");
    expect(content.contentType).toBe("markdown");
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      action: "extractHtml",
    });
  });

  it("defaults to html for hosts listed as HTML-first", async () => {
    stubPage("https://app.hey.com/topics/1");

    const content = await extractPageContent();

    expect(content.contentType).toBe("html");
  });

  it("throws when there is no active tab", async () => {
    queryTabs().mockResolvedValue([]);

    await expect(extractPageContent()).rejects.toThrow("No active tab found");
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("throws the content script's error message", async () => {
    stubPage("https://example.com/post", { error: "Extraction blew up" });

    await expect(extractPageContent()).rejects.toThrow("Extraction blew up");
  });

  it("throws when the content script returns no text", async () => {
    stubPage("https://example.com/post", null);

    await expect(extractPageContent()).rejects.toThrow(
      "Failed to extract text from page",
    );
  });
});
