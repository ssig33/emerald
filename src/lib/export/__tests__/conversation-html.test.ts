import { describe, it, expect } from "vitest";
import { buildConversationHtml } from "../conversation-html";
import { Message } from "../../../types";

const baseMessage = (overrides: Partial<Message>): Message => ({
  id: "m1",
  content: "",
  sender: "user",
  timestamp: 0,
  ...overrides,
});

describe("buildConversationHtml", () => {
  it("renders user and assistant messages with markdown", () => {
    const html = buildConversationHtml([
      baseMessage({ content: "Hello", sender: "user" }),
      baseMessage({ id: "m2", content: "# Hi there", sender: "ai" }),
    ]);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Hello");
    expect(html).toContain("<h1>Hi there</h1>");
    expect(html).toContain('class="message user"');
    expect(html).toContain('class="message ai"');
  });

  it("hides tool interactions inside collapsible details", () => {
    const html = buildConversationHtml([
      baseMessage({
        id: "m3",
        sender: "ai",
        content: "done",
        toolInteractions: [
          {
            name: "web_search",
            arguments: '{"query":"x"}',
            result: "result text",
          },
        ],
      }),
    ]);

    expect(html).toContain("<details");
    expect(html).toContain("Tool call: web_search");
    expect(html).toContain("result text");
  });

  it("includes page context as a collapsible block", () => {
    const html = buildConversationHtml([
      baseMessage({
        content: "look at this",
        pageContent: {
          title: "Example",
          url: "https://example.com",
          markdown: "# Page body",
          html: "<p>Page body</p>",
          contentType: "markdown",
        },
      }),
    ]);

    expect(html).toContain("Page context: Example");
    expect(html).toContain("https://example.com");
    expect(html).toContain("# Page body");
  });

  it("escapes HTML in raw context to avoid breaking the document", () => {
    const html = buildConversationHtml([
      baseMessage({
        sender: "ai",
        content: "ok",
        toolInteractions: [
          { name: "t", arguments: "{}", result: "<script>alert(1)</script>" },
        ],
      }),
    ]);

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
