import { Message, ImageData, PageContent } from "../types";
import {
  ResponseContentPart,
  ResponseInputItem,
  ResponseMessageItem,
} from "../types/openai";

export class MessageBuilder {
  buildMessages(
    currentMessage: string,
    conversationHistory: Message[] = [],
    systemPrompt?: string,
    contextImages?: ImageData[],
    contextPageContent?: PageContent,
  ): ResponseInputItem[] {
    const messages: ResponseInputItem[] = [];

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

  private convertConversationHistory(
    history: Message[],
  ): ResponseMessageItem[] {
    return history.map((msg): ResponseMessageItem => {
      let text = msg.content;
      if (msg.sender === "user" && msg.pageContent) {
        const content =
          msg.pageContent.contentType === "html"
            ? msg.pageContent.html
            : msg.pageContent.markdown;
        text = `<page_context>\nTitle: ${msg.pageContent.title}\nURL: ${msg.pageContent.url}\n\n${content}\n</page_context>\n\n${msg.content}`;
      }

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

  private buildCurrentMessage(
    message: string,
    contextImages?: ImageData[],
    pageContent?: PageContent,
  ): ResponseMessageItem {
    let text = message;
    if (pageContent) {
      const content =
        pageContent.contentType === "html"
          ? pageContent.html
          : pageContent.markdown;
      text = `<page_context>\nTitle: ${pageContent.title}\nURL: ${pageContent.url}\n\n${content}\n</page_context>\n\n${message}`;
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
