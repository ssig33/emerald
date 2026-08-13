import { Message } from "../../types";
import { MODEL, REASONING_EFFORT, RESPONSES_URL } from "./constants";

export interface TitleGeneratorConfig {
  apiKey: string;
}

const MAX_CHARS_PER_MESSAGE = 600;
const MAX_MESSAGES = 12;

function buildTranscript(messages: Message[]): string {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .slice(0, MAX_MESSAGES)
    .map((message) => {
      const role = message.sender === "user" ? "User" : "Assistant";
      const content = message.content.trim().slice(0, MAX_CHARS_PER_MESSAGE);
      return `${role}: ${content}`;
    })
    .join("\n\n");
}

function sanitizeTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^["'「『]+|["'」』]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
}

/** Concatenate the text parts of the assistant message items in a response. */
function extractOutputText(data: unknown): string {
  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";

  return output
    .filter((item) => (item as { type?: string }).type === "message")
    .flatMap((item) => {
      const content = (item as { content?: unknown }).content;
      return Array.isArray(content) ? content : [];
    })
    .filter((part) => (part as { type?: string }).type === "output_text")
    .map((part) => (part as { text?: string }).text ?? "")
    .join("");
}

/**
 * Generate a short title for the conversation.
 * Returns null on any failure so the upload can fall back to a default title.
 */
export async function generateConversationTitle(
  config: TitleGeneratorConfig,
  messages: Message[],
): Promise<string | null> {
  const transcript = buildTranscript(messages);
  if (!transcript) return null;

  try {
    const response = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        reasoning: { effort: REASONING_EFFORT },
        stream: false,
        input: [
          {
            role: "system",
            content:
              "You write a concise title for a conversation. " +
              "Respond with the title only, no quotes, no punctuation at the end. " +
              "Use the same language as the conversation. Keep it under 12 words.",
          },
          {
            role: "user",
            content: `Conversation:\n\n${transcript}\n\nTitle:`,
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const title = sanitizeTitle(extractOutputText(await response.json()));
    return title || null;
  } catch {
    return null;
  }
}
