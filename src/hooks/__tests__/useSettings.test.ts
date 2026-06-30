import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSettings } from "../useSettings";
import { chromeMock } from "../../test/mocks/chrome";

describe("useSettings profiles", () => {
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

  it("loads profiles from storage on mount", async () => {
    const stored = [
      {
        id: "p1",
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        openaiApiKey: "sk-or",
        model: "anthropic/claude-opus-4.1",
      },
    ];
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      llmProfiles: stored,
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.profiles).toEqual(stored);
  });

  it("saves the current provider config as a named profile", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.saveProfile("My Provider", {
        baseUrl: "https://example.com/v1/chat/completions",
        openaiApiKey: "sk-123",
        model: "gpt-5.4",
      });
    });

    expect(result.current.profiles).toHaveLength(1);
    const profile = result.current.profiles[0];
    expect(profile).toMatchObject({
      name: "My Provider",
      baseUrl: "https://example.com/v1/chat/completions",
      openaiApiKey: "sk-123",
      model: "gpt-5.4",
    });
    expect(profile.id).toBeTruthy();
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      llmProfiles: [profile],
    });
  });

  it("applies a profile into the active settings", async () => {
    const stored = [
      {
        id: "p1",
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        openaiApiKey: "sk-or",
        model: "anthropic/claude-opus-4.1",
      },
    ];
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      llmProfiles: stored,
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.applyProfile("p1");
    });

    expect(result.current.settings.baseUrl).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    expect(result.current.settings.openaiApiKey).toBe("sk-or");
    expect(result.current.settings.model).toBe("anthropic/claude-opus-4.1");
  });

  it("does nothing when applying an unknown profile id", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    const before = result.current.settings;
    await act(async () => {
      await result.current.applyProfile("missing");
    });

    expect(result.current.settings).toEqual(before);
  });

  it("deletes a profile by id", async () => {
    const stored = [
      { id: "p1", name: "A", baseUrl: "u1", openaiApiKey: "k1", model: "m1" },
      { id: "p2", name: "B", baseUrl: "u2", openaiApiKey: "k2", model: "m2" },
    ];
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      llmProfiles: stored,
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.deleteProfile("p1");
    });

    expect(result.current.profiles).toEqual([stored[1]]);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      llmProfiles: [stored[1]],
    });
  });
});
