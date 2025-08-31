import { useState, useEffect } from "react";
import { ApiRequest, Message, ImageData } from "../types";
import { useSettings } from "./useSettings";

// Define available tools
const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_page_text",
      description: "Extract text content from the current web page",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  const executeTools = async (toolCalls: any[]): Promise<any[]> => {
    const results = [];

    for (const toolCall of toolCalls) {
      const { function: func } = toolCall;

      if (func.name === "get_page_text") {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        console.log("Active tabs:", tabs);
        if (!tabs[0]?.id) {
          results.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: "Error: No active tab found",
          });
          continue;
        }
        try {
          const result = await chrome.tabs.sendMessage(tabs[0].id!, {
            action: "extractText",
          });

          console.log("Extracted page text:", result);

          results.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: result.text,
          });
        } catch (error) {
          console.log("ERROR extracting page text:", error);
          results.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: `Error: ${error instanceof Error ? error.message : "Failed to extract page text"}`,
          });
        }
      }
    }

    return results;
  };

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
      // Check if API key is configured
      if (!settings.openaiApiKey) {
        throw new Error(
          "OpenAI API key not configured. Please set it in the settings.",
        );
      }

      const apiUrl = "https://api.openai.com/v1/chat/completions";

      // Build current message
      const currentMessage = request.message;

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
      const apiPayload: any = {
        model: "gpt-4.1",
        messages,
        tools: AVAILABLE_TOOLS,
        tool_choice: "auto",
        stream: true,
      };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.openaiApiKey}`,
        },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // OpenAI streaming response processing
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let toolCallsBuffer: { [index: string]: any } = {};
      let isComplete = false;

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
                isComplete = true;
                break;
              }
              if (data.startsWith("{")) {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error) {
                    throw new Error(parsed.error.message || "OpenAI API Error");
                  }

                  const delta = parsed.choices?.[0]?.delta;
                  const finishReason = parsed.choices?.[0]?.finish_reason;

                  if (delta?.content) {
                    onMessage?.(delta.content);
                  }

                  if (delta?.tool_calls) {
                    for (const toolCallDelta of delta.tool_calls) {
                      const index = toolCallDelta.index;

                      if (!toolCallsBuffer[index]) {
                        toolCallsBuffer[index] = {
                          id: "",
                          type: "function",
                          function: {
                            name: "",
                            arguments: "",
                          },
                        };
                      }

                      if (toolCallDelta.id) {
                        toolCallsBuffer[index].id += toolCallDelta.id;
                      }

                      if (toolCallDelta.function) {
                        if (toolCallDelta.function.name) {
                          toolCallsBuffer[index].function.name +=
                            toolCallDelta.function.name;
                        }
                        if (toolCallDelta.function.arguments) {
                          toolCallsBuffer[index].function.arguments +=
                            toolCallDelta.function.arguments;
                        }
                      }
                    }
                  }

                  if (finishReason === "tool_calls") {
                    const toolCallsArray = Object.keys(toolCallsBuffer)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((key) => toolCallsBuffer[key]);

                    const toolResults = await executeTools(toolCallsArray);

                    // Add tool calls and results to messages
                    (messages as any[]).push({
                      role: "assistant",
                      content: null,
                      tool_calls: toolCallsArray,
                    });

                    for (const result of toolResults) {
                      messages.push(result as any);
                    }

                    // Make another API call with tool results
                    const followUpResponse = await fetch(apiUrl, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${settings.openaiApiKey}`,
                      },
                      body: JSON.stringify({
                        ...apiPayload,
                        messages,
                      }),
                    });

                    if (!followUpResponse.ok) {
                      throw new Error(
                        `HTTP ${followUpResponse.status}: ${followUpResponse.statusText}`,
                      );
                    }

                    // Process follow-up response
                    const followUpReader = followUpResponse.body?.getReader();
                    let followUpBuffer = "";

                    if (followUpReader) {
                      while (true) {
                        const { done: followUpDone, value: followUpValue } =
                          await followUpReader.read();
                        if (followUpDone) break;

                        followUpBuffer += decoder.decode(followUpValue, {
                          stream: true,
                        });
                        let followUpLines = followUpBuffer.split("\n");
                        followUpBuffer = followUpLines.pop() as string;

                        for (const followUpLine of followUpLines) {
                          if (followUpLine.startsWith("data: ")) {
                            const followUpData = followUpLine.slice(6);
                            if (followUpData === "[DONE]") {
                              onComplete?.();
                              setLoading(false);
                              return;
                            }
                            if (followUpData.startsWith("{")) {
                              try {
                                const followUpParsed = JSON.parse(followUpData);
                                const followUpContent =
                                  followUpParsed.choices?.[0]?.delta?.content;
                                if (followUpContent) {
                                  onMessage?.(followUpContent);
                                }
                              } catch (parseErr) {
                                // Ignore parse errors
                              }
                            }
                          }
                        }
                      }
                    }

                    onComplete?.();
                    setLoading(false);
                    return;
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

          if (isComplete) break;
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
