import { useState } from "react";
import {
  ApiRequest,
  Message,
  ImageData,
  PageContent,
  ResponseReference,
  ToolInteraction,
} from "../types";
import { activeApiKey, useSettings } from "./useSettings";
import { OpenAIClient } from "../lib/openai/client";
import { MessageBuilder } from "../lib/message-builder";
import { ApiError } from "../types/openai";

/**
 * The response to continue from: the last answer, as long as it was made with
 * the same API key. A response made with another key lives on another account
 * or server, so the conversation is sent in full instead.
 */
function previousResponseId(
  history: Message[],
  apiKeyId: string,
): string | undefined {
  const lastAnswer = [...history]
    .reverse()
    .find((message) => message.sender === "ai");
  return lastAnswer?.apiKeyId === apiKeyId ? lastAnswer.responseId : undefined;
}

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  const sendMessage = async (
    request: ApiRequest,
    conversationHistory: Message[] = [],
    contextData?: { images?: ImageData[]; pageContent?: PageContent },
    onMessage?: (chunk: string) => void,
    onComplete?: (response: ResponseReference) => void,
    onToolActivity?: (interactions: ToolInteraction[]) => void,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const apiKey = activeApiKey(settings);
      if (!apiKey.apiKey) {
        throw new ApiError(
          "API key not configured. Please set it in the settings.",
        );
      }

      const client = new OpenAIClient({
        apiKey: apiKey.apiKey,
        baseUrl: apiKey.baseUrl,
        model: settings.model,
        reasoningEffort: settings.reasoningEffort,
      });

      const previousId = previousResponseId(conversationHistory, apiKey.id);
      const messageBuilder = new MessageBuilder();
      const messages = previousId
        ? [
            messageBuilder.buildCurrentMessage(
              request.message,
              contextData?.images,
              contextData?.pageContent,
            ),
          ]
        : messageBuilder.buildMessages(
            request.message,
            conversationHistory,
            settings.systemPrompt,
            contextData?.images,
            contextData?.pageContent,
          );

      await client.sendMessage(
        messages,
        {
          onContent: onMessage,
          onToolActivity,
          onComplete: (responseId) => {
            onComplete?.({ responseId, apiKeyId: apiKey.id });
            setLoading(false);
          },
          onError: (err) => {
            setError(err.message);
            setLoading(false);
          },
        },
        previousId,
      );
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
