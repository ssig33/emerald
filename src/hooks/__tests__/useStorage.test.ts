import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useStorage } from "../useStorage";
import { chromeMock } from "../../test/mocks/chrome";

describe("useStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes hook with default value", () => {
    const { result } = renderHook(() =>
      useStorage("test-key", "default-value"),
    );

    expect(result.current[0]).toBe("default-value");
  });

  it("loads value from storage and updates state", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      "test-key": "stored-value",
    });

    const { result } = renderHook(() =>
      useStorage("test-key", "default-value"),
    );

    await waitFor(() => {
      expect(result.current[0]).toBe("stored-value");
    });

    expect(chromeMock.storage.local.get).toHaveBeenCalledWith("test-key");
  });

  it("retains default value when storage has no value", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({});

    const { result } = renderHook(() =>
      useStorage("test-key", "default-value"),
    );

    await waitFor(() => {
      expect(result.current[0]).toBe("default-value");
    });
  });

  it("saves new value to storage and updates state", async () => {
    vi.mocked(chromeMock.storage.local.set).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useStorage("test-key", "default-value"),
    );

    await act(async () => {
      await result.current[1]("new-value");
    });

    expect(result.current[0]).toBe("new-value");
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      "test-key": "new-value",
    });
  });

  it("handles object-type values correctly", async () => {
    const defaultObj = { count: 0, name: "test" };
    const storedObj = { count: 5, name: "stored" };

    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      "object-key": storedObj,
    });

    const { result } = renderHook(() => useStorage("object-key", defaultObj));

    await waitFor(() => {
      expect(result.current[0]).toEqual(storedObj);
    });

    const newObj = { count: 10, name: "updated" };
    await act(async () => {
      await result.current[1](newObj);
    });

    expect(result.current[0]).toEqual(newObj);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      "object-key": newObj,
    });
  });

  it("handles storage read errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(chromeMock.storage.local.get).mockRejectedValueOnce(
      new Error("Storage error"),
    );

    const { result } = renderHook(() =>
      useStorage("test-key", "default-value"),
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading from storage:",
        expect.any(Error),
      );
    });

    expect(result.current[0]).toBe("default-value");
    consoleSpy.mockRestore();
  });

  it("handles storage write errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(chromeMock.storage.local.set).mockRejectedValueOnce(
      new Error("Storage write error"),
    );

    const { result } = renderHook(() =>
      useStorage("test-key", "default-value"),
    );

    await act(async () => {
      await result.current[1]("new-value");
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error saving to storage:",
      expect.any(Error),
    );

    expect(result.current[0]).toBe("default-value");
    consoleSpy.mockRestore();
  });

  it("handles array-type values correctly", async () => {
    const defaultArray = [1, 2, 3];
    const storedArray = [4, 5, 6];

    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      "array-key": storedArray,
    });

    const { result } = renderHook(() => useStorage("array-key", defaultArray));

    await waitFor(() => {
      expect(result.current[0]).toEqual(storedArray);
    });

    const newArray = [7, 8, 9];
    await act(async () => {
      await result.current[1](newArray);
    });

    expect(result.current[0]).toEqual(newArray);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      "array-key": newArray,
    });
  });
});
