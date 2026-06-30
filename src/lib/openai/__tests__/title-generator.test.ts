import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateConversationTitle } from "../title-generator";
import { Message } from "../../../types";

function makeMessage(
  sender: "user" | "ai",
  content: string,
  id = Math.random().toString(),
): Message {
  return { id, sender, content, timestamp: 0 };
}

const config = {
  apiKey: "sk-test",
  model: "gpt-5.4",
  baseUrl: "https://api.openai.com/v1/chat/completions",
};

function mockResponse(content: string) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response;
}

describe("generateConversationTitle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a sanitized title from the model response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse('"  React hooks の使い方  "'));

    const title = await generateConversationTitle(config, [
      makeMessage("user", "React hooks について教えて"),
      makeMessage("ai", "useState は..."),
    ]);

    expect(title).toBe("React hooks の使い方");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.model).toBe("gpt-5.4");
    expect(body.stream).toBe(false);
  });

  it("returns null when there is no usable content", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const title = await generateConversationTitle(config, [
      makeMessage("user", "   "),
    ]);

    expect(title).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
    } as Response);

    const title = await generateConversationTitle(config, [
      makeMessage("user", "hello"),
    ]);

    expect(title).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    const title = await generateConversationTitle(config, [
      makeMessage("user", "hello"),
    ]);

    expect(title).toBeNull();
  });

  it("returns null when the response has no string content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    } as Response);

    const title = await generateConversationTitle(config, [
      makeMessage("user", "hello"),
    ]);

    expect(title).toBeNull();
  });
});
