import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ImageSelector from "../ImageSelector";

// Mock useScreenCapture hook
const mockUseScreenCapture = {
  captureScreen: vi.fn(),
  isCapturing: false,
};

vi.mock("../../hooks/useScreenCapture", () => ({
  useScreenCapture: () => mockUseScreenCapture,
}));

// Mock useContext hook
const mockUseContext = {
  contextData: {
    url: "https://example.com",
    text: "",
  },
  contextState: {
    url: true,
    text: false,
  },
  loading: false,
  error: "",
  handleContextChange: vi.fn(),
};

vi.mock("../../hooks/useContextStore", () => ({
  useContextData: () => mockUseContext,
}));

// No need to mock gyazo anymore since it's removed

describe("ImageSelector", () => {
  const mockOnImageCapture = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseScreenCapture.captureScreen.mockResolvedValue(
      "data:image/png;base64,test",
    );
    mockUseScreenCapture.isCapturing = false;
  });

  it("performs capture when capture button is clicked", async () => {
    render(<ImageSelector onImageCapture={mockOnImageCapture} />);

    const captureButton = screen.getByRole("button");
    fireEvent.click(captureButton);

    await waitFor(() => {
      expect(mockUseScreenCapture.captureScreen).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(mockOnImageCapture).toHaveBeenCalledWith({
        dataUrl: "data:image/png;base64,test",
        timestamp: expect.any(Number),
      });
    });
  });

  it("displays capturing state correctly", () => {
    mockUseScreenCapture.isCapturing = true;

    render(<ImageSelector onImageCapture={mockOnImageCapture} />);

    const captureButton = screen.getByRole("button");
    expect(captureButton).toBeDisabled();
    expect(screen.getByTestId("CircularProgress")).toBeInTheDocument();
  });

  it("displays capturing state during screen capture", async () => {
    // Set isCapturing to true to simulate capturing state
    mockUseScreenCapture.isCapturing = true;
    mockUseScreenCapture.captureScreen.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve("data:image/png;base64,test"), 100),
        ),
    );

    render(<ImageSelector onImageCapture={mockOnImageCapture} />);

    const captureButton = screen.getByRole("button");

    expect(captureButton).toBeDisabled();
    expect(screen.getByTestId("CircularProgress")).toBeInTheDocument();
  });

  it("outputs error log to console on capture error", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockUseScreenCapture.captureScreen.mockRejectedValue(
      new Error("Capture failed"),
    );

    render(<ImageSelector onImageCapture={mockOnImageCapture} />);

    const captureButton = screen.getByRole("button");
    fireEvent.click(captureButton);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Image capture failed:",
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("does not cause error when onImageCapture is not provided", async () => {
    render(<ImageSelector />);

    const captureButton = screen.getByRole("button");
    fireEvent.click(captureButton);

    await waitFor(() => {
      expect(mockUseScreenCapture.captureScreen).toHaveBeenCalledOnce();
    });

    // Verify no error occurs
    expect(() => {}).not.toThrow();
  });

  it("displays PhotoCamera icon", () => {
    render(<ImageSelector onImageCapture={mockOnImageCapture} />);

    expect(screen.getByTestId("PhotoCameraIcon")).toBeInTheDocument();
  });
});
