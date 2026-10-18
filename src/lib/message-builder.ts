import { Message, ImageData, PageContent } from "../types";
import {
  ResponseContentPart,
  ResponseInputItem,
  ResponseMessageItem,
} from "../types/openai";

export class MessageBuilder {
  /**
   * The whole conversation, starting with the system prompt, for a request
   * that does not continue from a stored response.
   */
  buildMessages(
    currentMessage: string,
    conversationHistory: Message[] = [],
    systemPrompt?: string,
    contextImages?: ImageData[],
    contextPageContent?: PageContent,
  ): ResponseInputItem[] {
    const messages: ResponseInputItem[] = [];

    if (systemPrompt) {
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

  private convertConversationHistory(
    history: Message[],
  ): ResponseMessageItem[] {
    return history.map((msg): ResponseMessageItem => {
      const text =
        msg.sender === "user"
          ? this.withPageContext(msg.content, msg.pageContent)
          : msg.content;

      if (msg.sender === "user" && msg.images && msg.images.length > 0) {
        return {
          role: "user",
          content: this.buildMultimodalContent(text, msg.images),
        };
      } else {
        return {
          role: msg.sender === "user" ? "user" : "assistant",
          content: text,
        };
      }
    });
  }

  /** The new user message alone, for a server that keeps the conversation. */
  buildCurrentMessage(
    message: string,
    contextImages?: ImageData[],
    pageContent?: PageContent,
  ): ResponseMessageItem {
    const text = this.withPageContext(message, pageContent);

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

  /** Prefix a user message with the page it was asked about, if any. */
  private withPageContext(message: string, pageContent?: PageContent): string {
    if (!pageContent) return message;
    const content =
      pageContent.contentType === "html"
        ? pageContent.html
        : pageContent.markdown;
    return `<page_context>\nTitle: ${pageContent.title}\nURL: ${pageContent.url}\n\n${content}\n</page_context>\n\n${message}`;
  }

  private buildMultimodalContent(
    text: string,
    images: ImageData[],
  ): ResponseContentPart[] {
    const content: ResponseContentPart[] = [{ type: "input_text", text }];

    images.forEach((image) => {
      content.push({
        type: "input_image",
        image_url: image.dataUrl,
      });
    });

    return content;
  }
}
