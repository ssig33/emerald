import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ContextSelector from "../ContextSelector";

// Mock useContext hook
const mockUseContext = {
  contextData: {
    text: "",
  },
  includePageText: false,
  loading: false,
  error: "",
  togglePageText: vi.fn(),
};

vi.mock("../../hooks/useContextStore", () => ({
  useContextData: () => mockUseContext,
}));

// Mock ImageSelector component
vi.mock("../ImageSelector", () => ({
  default: ({
    onImageCapture,
  }: {
    onImageCapture?: (imageUrl: string) => void;
  }) => (
    <div data-testid="image-selector">
      ImageSelector Component
      <button onClick={() => onImageCapture?.("test-image-url")}>
        Test Image Capture
      </button>
    </div>
  ),
}));

describe("ContextSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock values to default
    mockUseContext.contextData = { text: "" };
    mockUseContext.includePageText = false;
    mockUseContext.loading = false;
    mockUseContext.error = "";
  });

  it("should render basic components correctly", () => {
    render(<ContextSelector />);

    expect(screen.getByText("Include Page Text")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("should have switch initially unchecked", () => {
    render(<ContextSelector />);

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();
  });

  it("should call togglePageText when switch is clicked", () => {
    render(<ContextSelector />);

    const switchElement = screen.getByRole("switch");
    fireEvent.click(switchElement);

    expect(mockUseContext.togglePageText).toHaveBeenCalled();
  });

  it("should show page text chip when enabled and text is available", () => {
    mockUseContext.contextData.text = "Sample text content";
    mockUseContext.includePageText = true;

    render(<ContextSelector />);

    expect(
      screen.getByText("Page Text: Sample text content"),
    ).toBeInTheDocument();
  });

  it("should truncate long text in chip", () => {
    const longText =
      "This is a very long text content that should be truncated because it exceeds the limit";
    mockUseContext.contextData.text = longText;
    mockUseContext.includePageText = true;

    render(<ContextSelector />);

    expect(
      screen.getByText(`Page Text: ${longText.substring(0, 40)}...`),
    ).toBeInTheDocument();
  });

  it("should disable switch when loading", () => {
    mockUseContext.loading = true;

    render(<ContextSelector />);

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeDisabled();
  });

  it("should show loading indicator when loading", () => {
    mockUseContext.loading = true;

    render(<ContextSelector />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Extracting page text...")).toBeInTheDocument();
  });

  it("should show error message when there is an error", () => {
    mockUseContext.error = "Test error message";

    render(<ContextSelector />);

    expect(screen.getByText("Test error message")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("should not show error alert when there is no error", () => {
    mockUseContext.error = "";

    render(<ContextSelector />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("should not show chip when page text is disabled", () => {
    mockUseContext.contextData.text = "Sample text";
    mockUseContext.includePageText = false;

    render(<ContextSelector />);

    expect(screen.queryByText(/Page Text:/)).not.toBeInTheDocument();
  });

  it("should not show chip when page text is enabled but no text available", () => {
    mockUseContext.contextData.text = "";
    mockUseContext.includePageText = true;

    render(<ContextSelector />);

    expect(screen.queryByText(/Page Text:/)).not.toBeInTheDocument();
  });

  it("should show chip for short text without truncation", () => {
    const shortText = "Short text";
    mockUseContext.contextData.text = shortText;
    mockUseContext.includePageText = true;

    render(<ContextSelector />);

    expect(screen.getByText(`Page Text: ${shortText}`)).toBeInTheDocument();
  });

  it("should show switch as checked when includePageText is true", () => {
    mockUseContext.includePageText = true;

    render(<ContextSelector />);

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();
  });
});
