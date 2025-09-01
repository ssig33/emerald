import { useState } from "react";
import { ApiRequest, Message, ImageData } from "../types";
import { useSettings } from "./useSettings";
import { OpenAIClient } from "../lib/openai/client";
import { MessageBuilder } from "../lib/message-builder";
import { ApiError } from "../types/openai";

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  const sendMessage = async (
    request: ApiRequest,
    conversationHistory: Message[] = [],
    contextData?: { images?: ImageData[] },
    onMessage?: (chunk: string) => void,
    onComplete?: () => void,
  ) => {
    setLoading(true);
    setError(null);

    try {
      if (!settings.openaiApiKey) {
        throw new ApiError(
          "OpenAI API key not configured. Please set it in the settings.",
        );
      }

      const client = new OpenAIClient({
        apiKey: settings.openaiApiKey,
      });

      const messageBuilder = new MessageBuilder();
      const messages = messageBuilder.buildMessages(
        request.message,
        conversationHistory,
        settings.systemPrompt,
        contextData?.images,
      );

      await client.sendMessage(messages, {
        onContent: onMessage,
        onComplete: () => {
          onComplete?.();
          setLoading(false);
        },
        onError: (err) => {
          setError(err.message);
          setLoading(false);
        },
      });
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
