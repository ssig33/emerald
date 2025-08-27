import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useScreenCapture } from "../useScreenCapture";
import { chromeMock } from "../../test/mocks/chrome";

// Mock Date.now for consistent timestamps
const mockTimestamp = 1625097600000;
vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

describe("useScreenCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initial state is set correctly", () => {
    const { result } = renderHook(() => useScreenCapture());

    expect(result.current.isCapturing).toBe(false);
    expect(result.current.capturedImage).toBe(null);
    expect(typeof result.current.captureScreen).toBe("function");
    expect(typeof result.current.clearCapture).toBe("function");
  });

  it("screen capture works correctly", async () => {
    const mockDataUrl = "data:image/png;base64,mockImageData";
    const mockResponse = {
      dataUrl: mockDataUrl,
    };

    vi.mocked(chromeMock.tabs.sendMessage).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useScreenCapture());

    let capturePromise: Promise<string>;
    act(() => {
      capturePromise = result.current.captureScreen();
    });

    expect(result.current.isCapturing).toBe(true);

    const dataUrl = await act(async () => {
      return await capturePromise;
    });

    expect(dataUrl).toBe(mockDataUrl);
    expect(result.current.isCapturing).toBe(false);
    expect(result.current.capturedImage).toEqual({
      dataUrl: mockDataUrl,
      timestamp: mockTimestamp,
    });

    expect(chromeMock.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(1, {
      action: "startImageCapture",
    });
  });

  it("throws error when no active tab is found", async () => {
    vi.mocked(chromeMock.tabs.query).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useScreenCapture());

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await expect(result.current.captureScreen()).rejects.toThrow(
        "No active tab found",
      );
    });

    expect(result.current.isCapturing).toBe(false);
    expect(result.current.capturedImage).toBe(null);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("throws error when tab ID does not exist", async () => {
    vi.mocked(chromeMock.tabs.query).mockResolvedValueOnce([
      { id: undefined, url: "https://example.com" },
    ]);

    const { result } = renderHook(() => useScreenCapture());

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await expect(result.current.captureScreen()).rejects.toThrow(
        "No active tab found",
      );
    });

    expect(result.current.isCapturing).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("handles error response from sendMessage", async () => {
    const mockErrorResponse = {
      error: "Capture permission denied",
    };

    vi.mocked(chromeMock.tabs.sendMessage).mockResolvedValueOnce(
      mockErrorResponse,
    );

    const { result } = renderHook(() => useScreenCapture());

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await expect(result.current.captureScreen()).rejects.toThrow(
        "Capture permission denied",
      );
    });

    expect(result.current.isCapturing).toBe(false);
    expect(result.current.capturedImage).toBe(null);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("handles network errors during Chrome API calls", async () => {
    vi.mocked(chromeMock.tabs.query).mockRejectedValueOnce(
      new Error("Network error"),
    );

    const { result } = renderHook(() => useScreenCapture());

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await expect(result.current.captureScreen()).rejects.toThrow(
        "Network error",
      );
    });

    expect(result.current.isCapturing).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("handles errors when sendMessage fails", async () => {
    vi.mocked(chromeMock.tabs.sendMessage).mockRejectedValueOnce(
      new Error("Message sending failed"),
    );

    const { result } = renderHook(() => useScreenCapture());

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await expect(result.current.captureScreen()).rejects.toThrow(
        "Message sending failed",
      );
    });

    expect(result.current.isCapturing).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("can clear captured images", async () => {
    const mockDataUrl = "data:image/png;base64,mockImageData";
    const mockResponse = { dataUrl: mockDataUrl };

    vi.mocked(chromeMock.tabs.sendMessage).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useScreenCapture());

    // First perform capture
    await act(async () => {
      await result.current.captureScreen();
    });

    expect(result.current.capturedImage).not.toBe(null);

    // Clear capture
    act(() => {
      result.current.clearCapture();
    });

    expect(result.current.capturedImage).toBe(null);
  });

  it("can perform multiple captures", async () => {
    const mockDataUrl1 = "data:image/png;base64,mockImageData1";
    const mockDataUrl2 = "data:image/png;base64,mockImageData2";

    vi.mocked(chromeMock.tabs.sendMessage)
      .mockResolvedValueOnce({ dataUrl: mockDataUrl1 })
      .mockResolvedValueOnce({ dataUrl: mockDataUrl2 });

    const { result } = renderHook(() => useScreenCapture());

    // First capture
    await act(async () => {
      await result.current.captureScreen();
    });

    expect(result.current.capturedImage?.dataUrl).toBe(mockDataUrl1);

    // Second capture
    await act(async () => {
      await result.current.captureScreen();
    });

    expect(result.current.capturedImage?.dataUrl).toBe(mockDataUrl2);
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("handles multiple simultaneous capture requests appropriately", async () => {
    const mockDataUrl = "data:image/png;base64,mockImageData";
    const mockResponse = { dataUrl: mockDataUrl };

    vi.mocked(chromeMock.tabs.sendMessage).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useScreenCapture());

    let capture1Promise: Promise<string>;
    let capture2Promise: Promise<string>;

    // Start two captures simultaneously
    act(() => {
      capture1Promise = result.current.captureScreen();
      capture2Promise = result.current.captureScreen();
    });

    const [result1, result2] = await act(async () => {
      return await Promise.all([capture1Promise, capture2Promise]);
    });

    expect(result1).toBe(mockDataUrl);
    expect(result2).toBe(mockDataUrl);
    expect(result.current.isCapturing).toBe(false);
  });

  it("capturing flag is managed correctly", async () => {
    let resolveCapture: (value: any) => void;
    const capturePromise = new Promise((resolve) => {
      resolveCapture = resolve;
    });

    vi.mocked(chromeMock.tabs.sendMessage).mockReturnValueOnce(
      capturePromise as any,
    );

    const { result } = renderHook(() => useScreenCapture());

    expect(result.current.isCapturing).toBe(false);

    let captureScreenPromise: Promise<string>;

    // Start capture
    act(() => {
      captureScreenPromise = result.current.captureScreen();
    });

    expect(result.current.isCapturing).toBe(true);

    // Complete capture
    // @ts-ignore
    resolveCapture({ dataUrl: "test" });

    await act(async () => {
      await captureScreenPromise;
    });

    expect(result.current.isCapturing).toBe(false);
  });
});
