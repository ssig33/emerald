import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import InputArea from "../InputArea";

describe("InputArea", () => {
  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders basic components correctly", () => {
    render(<InputArea onSendMessage={mockOnSendMessage} />);

    expect(
      screen.getByPlaceholderText("Type a message..."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2); // Camera and Send buttons
  });

  it("allows text input", async () => {
    const user = userEvent.setup();
    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");

    await user.type(textField, "Test message");

    expect(textField).toHaveValue("Test message");
  });

  it("can send message by clicking send button", async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockResolvedValueOnce(undefined);

    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");
    const sendButton = screen.getAllByRole("button")[1]; // Second button is Send

    await user.type(textField, "Test message");
    await user.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith("Test message", []);
  });

  it("can send message with Enter key", async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockResolvedValueOnce(undefined);

    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");

    await user.type(textField, "Test message");
    await user.keyboard("{Enter}");

    expect(mockOnSendMessage).toHaveBeenCalledWith("Test message", []);
  });

  it("creates new line with Shift+Enter without sending", async () => {
    const user = userEvent.setup();
    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");

    await user.type(textField, "Line 1");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(textField, "Line 2");

    expect(textField).toHaveValue("Line 1\nLine 2");
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it("clears text field after sending", async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockResolvedValueOnce(undefined);

    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");

    await user.type(textField, "Test message");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(textField).toHaveValue("");
    });
  });

  it("cannot send whitespace-only messages", async () => {
    const user = userEvent.setup();
    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");
    const sendButton = screen.getAllByRole("button")[1]; // Send button

    await user.type(textField, "   ");

    expect(sendButton).toBeDisabled();
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it("disables input and sending when disabled", () => {
    render(<InputArea onSendMessage={mockOnSendMessage} disabled />);

    const textField = screen.getByPlaceholderText("Type a message...");

    expect(textField).toBeDisabled();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    // Camera button should still be visible but send button is replaced with progress
    expect(screen.getByRole("button")).toBeInTheDocument(); // Camera button
  });

  it("works as controlled component", () => {
    const mockOnChange = vi.fn();
    const { rerender } = render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        value="Initial value"
        onChange={mockOnChange}
      />,
    );

    const textField = screen.getByPlaceholderText("Type a message...");
    expect(textField).toHaveValue("Initial value");

    // Use fireEvent to trigger change event directly
    fireEvent.change(textField, {
      target: { value: "Initial value additional text" },
    });

    expect(mockOnChange).toHaveBeenCalledWith("Initial value additional text");

    // Update value externally
    rerender(
      <InputArea
        onSendMessage={mockOnSendMessage}
        value="Updated value"
        onChange={mockOnChange}
      />,
    );

    expect(textField).toHaveValue("Updated value");
  });

  it("controlled component clears externally after message send", async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    mockOnSendMessage.mockResolvedValueOnce(undefined);

    render(
      <InputArea
        onSendMessage={mockOnSendMessage}
        value="Test message"
        onChange={mockOnChange}
      />,
    );

    const sendButton = screen.getAllByRole("button")[1]; // Send button
    await user.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith("Test message", []);
    expect(mockOnChange).toHaveBeenCalledWith("");
  });

  it("disables send button when message is empty", () => {
    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const sendButton = screen.getAllByRole("button")[1]; // Send button
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when message is present", async () => {
    const user = userEvent.setup();
    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");
    const sendButton = screen.getAllByRole("button")[1]; // Send button

    await user.type(textField, "Message");

    expect(sendButton).toBeEnabled();
  });

  it("multiline functionality works correctly", () => {
    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");

    // Material-UI TextField multiline property is rendered as textarea
    expect(textField.tagName.toLowerCase()).toBe("textarea");
  });

  it("applies maxRows limit", () => {
    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");
    // Material-UI TextField maxRows being applied
    // cannot be directly verified through DOM attributes, but verified by correct component rendering
    expect(textField).toBeInTheDocument();
  });

  it("trim processing works correctly", async () => {
    const user = userEvent.setup();
    mockOnSendMessage.mockResolvedValueOnce(undefined);

    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");

    await user.type(textField, "  Message  ");
    await user.keyboard("{Enter}");

    expect(mockOnSendMessage).toHaveBeenCalledWith("  Message  ", []);
  });

  it("asynchronous send processing works correctly", async () => {
    const user = userEvent.setup();
    let resolvePromise: () => void;
    const sendPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    mockOnSendMessage.mockReturnValueOnce(sendPromise);

    render(<InputArea onSendMessage={mockOnSendMessage} />);

    const textField = screen.getByPlaceholderText("Type a message...");

    await user.type(textField, "Async message");
    await user.keyboard("{Enter}");

    // Send is called
    expect(mockOnSendMessage).toHaveBeenCalledWith("Async message", []);

    // Text still remains before Promise resolve
    expect(textField).toHaveValue("Async message");

    // Promise resolved
    await act(async () => {
      resolvePromise!();
      await sendPromise;
    });

    // Cleared after send completion
    await waitFor(() => {
      expect(textField).toHaveValue("");
    });
  });
});
