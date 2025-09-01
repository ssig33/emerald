import { Message, ImageData } from "../types";
import { OpenAIMessage, OpenAIMessageContent } from "../types/openai";

export class MessageBuilder {
  buildMessages(
    currentMessage: string,
    conversationHistory: Message[] = [],
    systemPrompt?: string,
    contextImages?: ImageData[],
  ): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];

    if (conversationHistory.length === 0 && systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    messages.push(...this.convertConversationHistory(conversationHistory));

    messages.push(this.buildCurrentMessage(currentMessage, contextImages));

    return messages;
  }

  private convertConversationHistory(history: Message[]): OpenAIMessage[] {
    return history.map((msg): OpenAIMessage => {
      if (msg.sender === "user" && msg.images && msg.images.length > 0) {
        return {
          role: "user",
          content: this.buildMultimodalContent(msg.content, msg.images),
        };
      } else {
        return {
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.content,
        };
      }
    });
  }

  private buildCurrentMessage(
    message: string,
    contextImages?: ImageData[],
  ): OpenAIMessage {
    if (contextImages && contextImages.length > 0) {
      return {
        role: "user",
        content: this.buildMultimodalContent(message, contextImages),
      };
    } else {
      return {
        role: "user",
        content: message,
      };
    }
  }

  private buildMultimodalContent(
    text: string,
    images: ImageData[],
  ): OpenAIMessageContent[] {
    const content: OpenAIMessageContent[] = [{ type: "text", text }];

    images.forEach((image) => {
      content.push({
        type: "image_url",
        image_url: { url: image.dataUrl },
      });
    });

    return content;
  }
}
