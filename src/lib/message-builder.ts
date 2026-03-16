import { Message, ImageData, PageContent } from "../types";
import { OpenAIMessage, OpenAIMessageContent } from "../types/openai";

export class MessageBuilder {
  buildMessages(
    currentMessage: string,
    conversationHistory: Message[] = [],
    systemPrompt?: string,
    contextImages?: ImageData[],
    contextPageContent?: PageContent,
  ): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];

    if (conversationHistory.length === 0 && systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    messages.push(...this.convertConversationHistory(conversationHistory));

    messages.push(
      this.buildCurrentMessage(
        currentMessage,
        contextImages,
        contextPageContent,
      ),
    );

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
    pageContent?: PageContent,
  ): OpenAIMessage {
    let text = message;
    if (pageContent) {
      text = `<page_context>\nTitle: ${pageContent.title}\nURL: ${pageContent.url}\n\n${pageContent.markdown}\n</page_context>\n\n${message}`;
    }

    if (contextImages && contextImages.length > 0) {
      return {
        role: "user",
        content: this.buildMultimodalContent(text, contextImages),
      };
    } else {
      return {
        role: "user",
        content: text,
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
