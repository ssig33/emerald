import { useState, useEffect } from "react";
import { ApiRequest, Message, ImageData } from "../types";
import { useSettings } from "./useSettings";

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  const sendMessage = async (
    request: ApiRequest,
    conversationHistory: Message[] = [],
    contextData?: { text?: string; images?: ImageData[] },
    onMessage?: (chunk: string) => void,
    onComplete?: () => void,
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Check if API key is configured
      if (!settings.openaiApiKey) {
        throw new Error(
          "OpenAI API key not configured. Please set it in the settings.",
        );
      }

      const apiUrl = "https://api.openai.com/v1/chat/completions";

      // Build current message with context data
      let currentMessage = request.message;
      if (contextData?.text) {
        currentMessage = `${currentMessage}\n\nPage content: ${contextData.text}`;
      }

      // Convert conversation history to OpenAI format
      const messages: Array<{
        role: "system" | "user" | "assistant";
        content:
          | string
          | Array<{
              type: "text" | "image_url";
              text?: string;
              image_url?: { url: string };
            }>;
      }> = conversationHistory.map((msg) => {
        if (msg.sender === "user" && msg.images && msg.images.length > 0) {
          // Multimodal message with images
          const content: Array<{
            type: "text" | "image_url";
            text?: string;
            image_url?: { url: string };
          }> = [{ type: "text", text: msg.content }];
          msg.images.forEach((image) => {
            content.push({
              type: "image_url",
              image_url: { url: image.dataUrl },
            });
          });
          return {
            role: "user" as const,
            content,
          };
        } else {
          // Text-only message
          return {
            role:
              msg.sender === "user"
                ? ("user" as const)
                : ("assistant" as const),
            content: msg.content,
          };
        }
      });

      // Add system prompt if this is the first message
      if (conversationHistory.length === 0 && settings.systemPrompt) {
        messages.unshift({
          role: "system",
          content: settings.systemPrompt,
        });
      }

      // Add current message with images if present
      if (contextData?.images && contextData.images.length > 0) {
        const content: Array<{
          type: "text" | "image_url";
          text?: string;
          image_url?: { url: string };
        }> = [{ type: "text", text: currentMessage }];
        contextData.images.forEach((image) => {
          content.push({
            type: "image_url",
            image_url: { url: image.dataUrl },
          });
        });
        messages.push({
          role: "user",
          content,
        });
      } else {
        messages.push({
          role: "user",
          content: currentMessage,
        });
      }

      // OpenAI API request format
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5",
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // OpenAI streaming response processing
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process line by line
          let lines = buffer.split("\n");
          buffer = lines.pop() as string;

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                onComplete?.();
                setLoading(false);
                return;
              }
              if (data.startsWith("{")) {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error) {
                    throw new Error(parsed.error.message || "OpenAI API Error");
                  }
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    onMessage?.(content);
                  }
                } catch (parseErr) {
                  if (
                    parseErr instanceof Error &&
                    (parseErr.message.includes("OpenAI API Error") ||
                      parseErr.message.includes("Invalid request"))
                  ) {
                    throw parseErr;
                  }
                }
              }
            }
          }
        }
      }

      onComplete?.();
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return {
    sendMessage,
    loading,
    error,
  };
};
