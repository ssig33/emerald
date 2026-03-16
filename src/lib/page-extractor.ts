import Defuddle from "defuddle";
import TurndownService from "turndown";
import { PageContent } from "../types";

export async function extractPageContent(): Promise<PageContent> {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tabs[0]?.id) {
    throw new Error("No active tab found");
  }

  const result = await chrome.tabs.sendMessage(tabs[0].id, {
    action: "extractHtml",
  });
  const info = await chrome.tabs.sendMessage(tabs[0].id, {
    action: "getPageInfo",
  });

  if (!result || typeof result.text !== "string") {
    throw new Error("Failed to extract text from page");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(result.text, "text/html");

  const defuddle = new Defuddle(doc, { markdown: true, url: info.url });
  const parseResult = defuddle.parse();

  const contentHTML = parseResult.content;
  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(contentHTML);

  return {
    title: info.title || "",
    url: info.url || "",
    markdown,
    html: result.text,
    contentType: "markdown",
  };
}
