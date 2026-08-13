import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSettings } from "../useSettings";
import { chromeMock } from "../../test/mocks/chrome";

describe("useSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chromeMock.storage.local.get).mockResolvedValue({});
    vi.mocked(chromeMock.storage.local.set).mockResolvedValue(undefined);
  });

  const waitLoaded = async (result: { current: { loading: boolean } }) => {
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  };

  it("falls back to the defaults when nothing is stored", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.openaiApiKey).toBe("");
    expect(result.current.settings.systemPrompt).toContain("Emerald");
    expect(result.current.settings.s3Region).toBe("us-east-1");
  });

  it("merges stored settings over the defaults", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { openaiApiKey: "sk-stored", s3Bucket: "my-bucket" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.openaiApiKey).toBe("sk-stored");
    expect(result.current.settings.s3Bucket).toBe("my-bucket");
    expect(result.current.settings.s3Region).toBe("us-east-1");
  });

  it("persists updated settings to storage", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.updateApiKey("sk-new");
    });

    expect(result.current.settings.openaiApiKey).toBe("sk-new");
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      settings: expect.objectContaining({ openaiApiKey: "sk-new" }),
    });
  });

  it("updates the system prompt", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.updateSystemPrompt("Be terse.");
    });

    expect(result.current.settings.systemPrompt).toBe("Be terse.");
  });
});
