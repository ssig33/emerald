import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ChatArea from "../ChatArea";
import { Message } from "../../types";

const mockMessages: Message[] = [
  {
    id: "1",
    content: "Hello",
    sender: "user",
    timestamp: 1625097600000, // 2021-07-01 00:00:00 JST
  },
  {
    id: "2",
    content: "Hello! How can I help you?",
    sender: "ai",
    timestamp: 1625097660000, // 2021-07-01 00:01:00 JST
    status: "done",
  },
  {
    id: "3",
    content: "**Markdown** test",
    sender: "ai",
    timestamp: 1625097720000, // 2021-07-01 00:02:00 JST
    status: "streaming",
  },
];

describe("ChatArea", () => {
  it("displays initial message when messages are empty", () => {
    render(<ChatArea messages={[]} />);

    expect(
      screen.getByText("Start chatting with Emerald AI"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Type a message and press send"),
    ).toBeInTheDocument();
  });

  it("displays user messages correctly", () => {
    const userMessage: Message[] = [mockMessages[0]];
    render(<ChatArea messages={userMessage} />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("displays AI messages correctly", () => {
    const aiMessage: Message[] = [mockMessages[1]];
    render(<ChatArea messages={aiMessage} />);

    expect(screen.getByText("Hello! How can I help you?")).toBeInTheDocument();
  });

  it("displays 'Typing...' chip for streaming AI messages", () => {
    const streamingMessage: Message[] = [mockMessages[2]];
    render(<ChatArea messages={streamingMessage} />);

    expect(screen.getByText("Typing...")).toBeInTheDocument();
  });

  it("displays multiple messages correctly", () => {
    render(<ChatArea messages={mockMessages} />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hello! How can I help you?")).toBeInTheDocument();
    expect(screen.getByText("Typing...")).toBeInTheDocument();
  });

  it("displays error messages", () => {
    const errorMessage = "API connection error occurred";
    render(<ChatArea messages={[]} error={errorMessage} />);

    expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
  });

  it("displays messages and errors simultaneously", () => {
    const errorMessage = "Connection error";
    render(<ChatArea messages={[mockMessages[0]]} error={errorMessage} />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
  });
});
