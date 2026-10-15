import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { groupChatStorage } from "../groupChatStorage";
import { Message } from "../../types";

const messages: Message[] = [
  { id: "1", content: "Hello", sender: "user", timestamp: 1 },
  { id: "2", content: "Hi there!", sender: "ai", timestamp: 2 },
];

describe("groupChatStorage", () => {
  beforeEach(async () => {
    await chrome.storage.session.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when nothing is stored for the group", async () => {
    expect(await groupChatStorage.getGroupChat(42)).toBeNull();
  });

  it("saves and reads back a group's conversation", async () => {
    await groupChatStorage.saveGroupChat(42, messages);

    expect(await groupChatStorage.getGroupChat(42)).toEqual(messages);
    expect(await groupChatStorage.getGroupChat(7)).toBeNull();
  });

  it("stores the conversation under group_<id> in session storage", async () => {
    await groupChatStorage.saveGroupChat(42, messages);

    const stored = await chrome.storage.session.get("group_42");
    expect(stored["group_42"]).toEqual({ messages });
  });

  it("clears only the given group's conversation", async () => {
    await groupChatStorage.saveGroupChat(42, messages);
    await groupChatStorage.saveGroupChat(7, messages);

    await groupChatStorage.clearGroupChat(42);

    expect(await groupChatStorage.getGroupChat(42)).toBeNull();
    expect(await groupChatStorage.getGroupChat(7)).toEqual(messages);
  });

  it("returns null when reading fails", async () => {
    vi.mocked(chrome.storage.session.get).mockRejectedValueOnce(
      new Error("boom"),
    );

    expect(await groupChatStorage.getGroupChat(42)).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("does not throw when saving or clearing fails", async () => {
    vi.mocked(chrome.storage.session.set).mockRejectedValueOnce(
      new Error("boom"),
    );
    vi.mocked(chrome.storage.session.remove).mockRejectedValueOnce(
      new Error("boom"),
    );

    await expect(
      groupChatStorage.saveGroupChat(42, messages),
    ).resolves.toBeUndefined();
    await expect(groupChatStorage.clearGroupChat(42)).resolves.toBeUndefined();
  });
});
