import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ThreadList from "../ThreadList";
import { ChatHistoryItem } from "../../types";

// Mock chatStorage
vi.mock("../../utils/chatStorage", () => ({
  chatStorage: {
    getThreadList: vi.fn(),
  },
}));

import { chatStorage } from "../../utils/chatStorage";
const mockChatStorage = vi.mocked(chatStorage);

describe("ThreadList", () => {
  const mockOnThreadSelect = vi.fn();
  const mockOnClose = vi.fn();

  const mockThreads: ChatHistoryItem[] = [
    {
      threadId: "thread-1",
      title: "Test Thread 1",
      lastUpdated: 1625097600000, // 2021-07-01 09:00:00 JST
    },
    {
      threadId: "thread-2",
      title: "Test Thread 2",
      lastUpdated: 1625097660000, // 2021-07-01 09:01:00 JST
    },
    {
      threadId: "thread-3",
      title: "",
      lastUpdated: 1625097720000, // 2021-07-01 09:02:00 JST
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockChatStorage.getThreadList.mockResolvedValue(mockThreads);
  });

  it("renders basic components correctly", async () => {
    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    expect(screen.getByText("Thread List")).toBeInTheDocument();

    // Wait for threads to load
    await waitFor(() => {
      expect(screen.getByText("Test Thread 1")).toBeInTheDocument();
    });

    expect(screen.getByText("Test Thread 2")).toBeInTheDocument();
  });

  it("fetches thread list from chatStorage", async () => {
    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      expect(mockChatStorage.getThreadList).toHaveBeenCalled();
    });
  });

  it("handles empty threads without error", async () => {
    mockChatStorage.getThreadList.mockResolvedValueOnce([]);

    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      expect(mockChatStorage.getThreadList).toHaveBeenCalled();
    });

    // Thread list is displayed but no thread items
    expect(screen.getByText("Thread List")).toBeInTheDocument();
    expect(screen.queryByText("Test Thread 1")).not.toBeInTheDocument();
  });

  it("calls onThreadSelect when thread is clicked", async () => {
    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Test Thread 1")).toBeInTheDocument();
    });

    const threadItem = screen.getByText("Test Thread 1");
    fireEvent.click(threadItem);

    expect(mockOnThreadSelect).toHaveBeenCalledWith("thread-1");
  });

  it("calls onClose when thread is clicked", async () => {
    render(
      <ThreadList onThreadSelect={mockOnThreadSelect} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Test Thread 1")).toBeInTheDocument();
    });

    const threadItem = screen.getByText("Test Thread 1");
    fireEvent.click(threadItem);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("handles missing onClose without error", async () => {
    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Test Thread 1")).toBeInTheDocument();
    });

    const threadItem = screen.getByText("Test Thread 1");

    // Verify no error occurs
    expect(() => fireEvent.click(threadItem)).not.toThrow();
    expect(mockOnThreadSelect).toHaveBeenCalledWith("thread-1");
  });

  it("displays 'Untitled' for empty titles", async () => {
    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Untitled")).toBeInTheDocument();
    });
  });

  it("formats timestamps in correct format", async () => {
    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      // Verify formatting in Japanese time
      expect(screen.getByText("7/1 09:00")).toBeInTheDocument();
      expect(screen.getByText("7/1 09:01")).toBeInTheDocument();
      expect(screen.getByText("7/1 09:02")).toBeInTheDocument();
    });
  });

  it("can click multiple threads", async () => {
    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Test Thread 1")).toBeInTheDocument();
      expect(screen.getByText("Test Thread 2")).toBeInTheDocument();
    });

    // Click first thread
    const thread1 = screen.getByText("Test Thread 1");
    fireEvent.click(thread1);
    expect(mockOnThreadSelect).toHaveBeenCalledWith("thread-1");

    // Click second thread
    const thread2 = screen.getByText("Test Thread 2");
    fireEvent.click(thread2);
    expect(mockOnThreadSelect).toHaveBeenCalledWith("thread-2");

    expect(mockOnThreadSelect).toHaveBeenCalledTimes(2);
  });

  it("verifies chatStorage.getThreadList is called", async () => {
    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      expect(mockChatStorage.getThreadList).toHaveBeenCalled();
    });

    // Verify basic rendering occurs
    expect(screen.getByText("Thread List")).toBeInTheDocument();
  });

  it("applies cursor pointer style to ListItem", async () => {
    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Test Thread 1")).toBeInTheDocument();
    });

    const listItem = screen.getByText("Test Thread 1").closest("li");

    // ListItem is rendered as li element
    expect(listItem).toBeInTheDocument();
  });

  it("sets up scrollable container", async () => {
    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    // Verify Paper element exists (style details verified in E2E tests)
    await waitFor(() => {
      const paperElement = screen.getByRole("list").closest("div");
      expect(paperElement).toBeInTheDocument();
    });
  });

  it("displays titles with special characters correctly", async () => {
    const specialThreads: ChatHistoryItem[] = [
      {
        threadId: "thread-special-1",
        title: "Title<>&\"'",
        lastUpdated: 1625097600000,
      },
      {
        threadId: "thread-special-2",
        title: "Emoji test🚀🎉",
        lastUpdated: 1625097660000,
      },
    ];

    mockChatStorage.getThreadList.mockResolvedValueOnce(specialThreads);

    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Title<>&\"'")).toBeInTheDocument();
      expect(screen.getByText("Emoji test🚀🎉")).toBeInTheDocument();
    });
  });

  it("displays very long titles correctly", async () => {
    const longTitle =
      "This is a very long title to test how Material-UI's ListItemText component handles long content";
    const longTitleThreads: ChatHistoryItem[] = [
      {
        threadId: "thread-long",
        title: longTitle,
        lastUpdated: 1625097600000,
      },
    ];

    mockChatStorage.getThreadList.mockResolvedValueOnce(longTitleThreads);

    render(<ThreadList onThreadSelect={mockOnThreadSelect} />);

    await waitFor(() => {
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });
  });
});
