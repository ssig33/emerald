import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "../../types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(content: string): string {
  if (!content.trim()) return "";
  return renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, content),
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function renderImages(message: Message): string {
  if (!message.images || message.images.length === 0) return "";
  return message.images
    .map(
      (image) =>
        `<img class="attachment" src="${escapeHtml(image.dataUrl)}" alt="attached image" />`,
    )
    .join("");
}

function renderContext(message: Message): string {
  const blocks: string[] = [];

  if (message.pageContent) {
    const page = message.pageContent;
    const text =
      page.contentType === "html" ? page.html : page.markdown || page.html;
    blocks.push(
      `<details class="context">` +
        `<summary>Page context: ${escapeHtml(page.title || page.url)}</summary>` +
        `<div class="context-meta"><a href="${escapeHtml(page.url)}">${escapeHtml(page.url)}</a></div>` +
        `<pre>${escapeHtml(text || "")}</pre>` +
        `</details>`,
    );
  }

  if (message.toolInteractions && message.toolInteractions.length > 0) {
    for (const interaction of message.toolInteractions) {
      blocks.push(
        `<details class="context">` +
          `<summary>Tool call: ${escapeHtml(interaction.name)}</summary>` +
          `<div class="context-label">arguments</div>` +
          `<pre>${escapeHtml(interaction.arguments || "{}")}</pre>` +
          `<div class="context-label">result</div>` +
          `<pre>${escapeHtml(interaction.result || "")}</pre>` +
          `</details>`,
      );
    }
  }

  return blocks.join("");
}

function renderMessage(message: Message): string {
  const roleClass = message.sender === "user" ? "user" : "ai";
  const roleLabel = message.sender === "user" ? "User" : "Assistant";

  return (
    `<section class="message ${roleClass}">` +
    `<header><span class="role">${roleLabel}</span>` +
    `<time>${escapeHtml(formatTime(message.timestamp))}</time></header>` +
    renderImages(message) +
    `<div class="body">${renderMarkdown(message.content)}</div>` +
    renderContext(message) +
    `</section>`
  );
}

const STYLES = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6;
  background: #f5f5f5;
  color: #1a1a1a;
}
.container { max-width: 820px; margin: 0 auto; padding: 24px 16px 64px; }
h1.title { font-size: 1.5rem; }
.meta { color: #666; font-size: 0.85rem; margin-bottom: 24px; }
.message { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.message.user { border-left: 4px solid #1976d2; }
.message.ai { border-left: 4px solid #50c878; }
.message header { display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 8px; }
.message .role { font-weight: 600; }
.message time { color: #888; font-size: 0.8rem; }
.body { word-wrap: break-word; overflow-wrap: anywhere; }
.body pre { background: #f0f0f0; padding: 12px; border-radius: 8px; overflow-x: auto; }
.body code { background: #f0f0f0; padding: 0.1em 0.3em; border-radius: 4px; }
.body pre code { background: none; padding: 0; }
.body img, img.attachment { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
.body table { border-collapse: collapse; }
.body th, .body td { border: 1px solid #ddd; padding: 4px 8px; }
details.context { margin-top: 12px; border: 1px solid #e0e0e0; border-radius: 8px;
  background: #fafafa; padding: 8px 12px; font-size: 0.85rem; }
details.context summary { cursor: pointer; color: #555; font-weight: 500; }
details.context pre { white-space: pre-wrap; word-break: break-word; background: #fff;
  border: 1px solid #eee; border-radius: 6px; padding: 8px; max-height: 360px; overflow: auto; }
.context-label { margin-top: 8px; font-weight: 600; color: #777; text-transform: uppercase;
  font-size: 0.7rem; letter-spacing: 0.05em; }
.context-meta { margin: 4px 0; font-size: 0.8rem; }
@media (prefers-color-scheme: dark) {
  body { background: #1a1a1a; color: #e0e0e0; }
  .message { background: #242424; box-shadow: none; }
  .body pre, .body code { background: #2e2e2e; }
  details.context { background: #1f1f1f; border-color: #333; }
  details.context pre { background: #242424; border-color: #333; }
}
`;

export function buildConversationHtml(
  messages: Message[],
  options: { title?: string; generatedAt?: number } = {},
): string {
  const generatedAt = options.generatedAt ?? Date.now();
  const title = options.title || "Emerald Conversation";
  const body = messages.map(renderMessage).join("");

  return (
    `<!doctype html>\n` +
    `<html lang="en">\n<head>\n<meta charset="utf-8" />\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />\n` +
    `<title>${escapeHtml(title)}</title>\n` +
    `<style>${STYLES}</style>\n</head>\n<body>\n` +
    `<div class="container">\n` +
    `<h1 class="title">${escapeHtml(title)}</h1>\n` +
    `<div class="meta">Generated at ${escapeHtml(new Date(generatedAt).toLocaleString())}</div>\n` +
    body +
    `\n</div>\n</body>\n</html>\n`
  );
}
