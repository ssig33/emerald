import { Message } from "../../types";

export interface TitleGeneratorConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
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

/**
 * Generate a short title for the conversation using the configured model.
 * Returns null on any failure so the upload can fall back to a default title.
 */
export async function generateConversationTitle(
  config: TitleGeneratorConfig,
  messages: Message[],
): Promise<string | null> {
  const transcript = buildTranscript(messages);
  if (!transcript) return null;

  try {
    const response = await fetch(config.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
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

    const data = await response.json();
    const raw: unknown = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return null;

    const title = sanitizeTitle(raw);
    return title || null;
  } catch {
    return null;
  }
}
