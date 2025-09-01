import { describe, it, expect, beforeEach } from "vitest";
import { MessageBuilder } from "../message-builder";
import { Message, ImageData } from "../../types";

describe("MessageBuilder", () => {
  let messageBuilder: MessageBuilder;

  beforeEach(() => {
    messageBuilder = new MessageBuilder();
  });

  describe("buildMessages", () => {
    it("should build simple text message", () => {
      const result = messageBuilder.buildMessages("Hello, AI!");

      expect(result).toEqual([
        {
          role: "user",
          content: "Hello, AI!",
        },
      ]);
    });

    it("should include system prompt for new conversation", () => {
      const result = messageBuilder.buildMessages(
        "Hello, AI!",
        [],
        "You are a helpful assistant.",
      );

      expect(result).toEqual([
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "user",
          content: "Hello, AI!",
        },
      ]);
    });

    it("should not include system prompt when there is conversation history", () => {
      const history: Message[] = [
        {
          id: "1",
          content: "Previous message",
          sender: "user",
          timestamp: 123456,
        },
      ];

      const result = messageBuilder.buildMessages(
        "Hello, AI!",
        history,
        "You are a helpful assistant.",
      );

      expect(result).toEqual([
        {
          role: "user",
          content: "Previous message",
        },
        {
          role: "user",
          content: "Hello, AI!",
        },
      ]);
    });

    it("should handle conversation history with mixed senders", () => {
      const history: Message[] = [
        {
          id: "1",
          content: "User message",
          sender: "user",
          timestamp: 123456,
        },
        {
          id: "2",
          content: "AI response",
          sender: "ai",
          timestamp: 123457,
        },
      ];

      const result = messageBuilder.buildMessages("Follow up", history);

      expect(result).toEqual([
        {
          role: "user",
          content: "User message",
        },
        {
          role: "assistant",
          content: "AI response",
        },
        {
          role: "user",
          content: "Follow up",
        },
      ]);
    });

    it("should handle current message with images", () => {
      const images: ImageData[] = [
        {
          dataUrl: "data:image/png;base64,abc123",
          timestamp: 123456,
        },
      ];

      const result = messageBuilder.buildMessages(
        "What's in this image?",
        [],
        undefined,
        images,
      );

      expect(result).toEqual([
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "What's in this image?",
            },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,abc123",
              },
            },
          ],
        },
      ]);
    });

    it("should handle multiple images", () => {
      const images: ImageData[] = [
        {
          dataUrl: "data:image/png;base64,abc123",
          timestamp: 123456,
        },
        {
          dataUrl: "data:image/jpeg;base64,def456",
          timestamp: 123457,
        },
      ];

      const result = messageBuilder.buildMessages(
        "Compare these images",
        [],
        undefined,
        images,
      );

      expect(result).toEqual([
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Compare these images",
            },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,abc123",
              },
            },
            {
              type: "image_url",
              image_url: {
                url: "data:image/jpeg;base64,def456",
              },
            },
          ],
        },
      ]);
    });

    it("should handle conversation history with images", () => {
      const history: Message[] = [
        {
          id: "1",
          content: "Look at this",
          sender: "user",
          timestamp: 123456,
          images: [
            {
              dataUrl: "data:image/png;base64,xyz789",
              timestamp: 123456,
            },
          ],
        },
        {
          id: "2",
          content: "I can see the image",
          sender: "ai",
          timestamp: 123457,
        },
      ];

      const result = messageBuilder.buildMessages("What about this?", history);

      expect(result).toEqual([
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Look at this",
            },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,xyz789",
              },
            },
          ],
        },
        {
          role: "assistant",
          content: "I can see the image",
        },
        {
          role: "user",
          content: "What about this?",
        },
      ]);
    });

    it("should handle text-only messages in history", () => {
      const history: Message[] = [
        {
          id: "1",
          content: "Text only message",
          sender: "user",
          timestamp: 123456,
        },
      ];

      const result = messageBuilder.buildMessages("Follow up", history);

      expect(result).toEqual([
        {
          role: "user",
          content: "Text only message",
        },
        {
          role: "user",
          content: "Follow up",
        },
      ]);
    });

    it("should handle empty images array", () => {
      const result = messageBuilder.buildMessages("Hello", [], undefined, []);

      expect(result).toEqual([
        {
          role: "user",
          content: "Hello",
        },
      ]);
    });

    it("should handle complete scenario with all elements", () => {
      const history: Message[] = [
        {
          id: "1",
          content: "First message",
          sender: "user",
          timestamp: 123456,
          images: [
            {
              dataUrl: "data:image/png;base64,hist123",
              timestamp: 123456,
            },
          ],
        },
        {
          id: "2",
          content: "AI response",
          sender: "ai",
          timestamp: 123457,
        },
      ];

      const currentImages: ImageData[] = [
        {
          dataUrl: "data:image/jpeg;base64,curr456",
          timestamp: 123458,
        },
      ];

      const result = messageBuilder.buildMessages(
        "Current message",
        history,
        "System prompt",
        currentImages,
      );

      expect(result).toEqual([
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "First message",
            },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,hist123",
              },
            },
          ],
        },
        {
          role: "assistant",
          content: "AI response",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Current message",
            },
            {
              type: "image_url",
              image_url: {
                url: "data:image/jpeg;base64,curr456",
              },
            },
          ],
        },
      ]);
    });
  });
});
