/**
 * Turns the visible tab into an image the model can look at.
 *
 * The capture comes back in device pixels, which is not the space the page is
 * clicked in: `browser_click` takes CSS pixels. The image is therefore scaled
 * down to the CSS size of the viewport, so a coordinate read off the picture
 * can be handed straight back to a click, and an optional grid is painted on
 * top to make those coordinates readable.
 */
import { sendBrowserCommand } from "./bridge";
import { ViewportInfo } from "./types";

/** Widest image handed to the model; a viewport wider than this is scaled. */
export const DEFAULT_MAX_WIDTH = 1280;
const MIN_MAX_WIDTH = 200;
/** Small copy kept in the chat log so the run stays auditable. */
const THUMBNAIL_WIDTH = 320;
const JPEG_QUALITY = 0.75;
const THUMBNAIL_QUALITY = 0.6;
/** Spacing of the coordinate grid, in CSS pixels. */
const GRID_STEP = 100;

export interface Screenshot {
  /** Full-size capture, ready to be sent as an input_image. */
  dataUrl: string;
  /** Downscaled copy for the chat log. */
  thumbnailDataUrl: string;
  width: number;
  height: number;
  /** Geometry of the page, when a content script could report it. */
  viewport: ViewportInfo | null;
  /** CSS pixels per image pixel: 1 when the image matches the viewport. */
  cssPerPixel: number;
}

export interface ScreenshotOptions {
  /** Paint a labelled coordinate grid over the capture. */
  grid: boolean;
  maxWidth: number;
}

/** Captures the visible area of a window as a PNG data URL. */
export function captureVisibleTab(windowId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(
          new Error(
            `The tab could not be captured: ${error.message}. ` +
              "Browser-internal pages (chrome://, about:, the extension gallery) cannot be photographed.",
          ),
        );
        return;
      }
      if (!dataUrl) {
        reject(new Error("The tab could not be captured: empty capture."));
        return;
      }
      resolve(dataUrl);
    });
  });
}

/**
 * Page geometry, or null when no content script answers. A capture is still
 * worth taking in that case; only the coordinate mapping is then unknown.
 */
export async function readViewportInfo(
  tabId: number,
): Promise<ViewportInfo | null> {
  try {
    return JSON.parse(
      await sendBrowserCommand(tabId, { name: "viewportInfo" }),
    ) as ViewportInfo;
  } catch {
    return null;
  }
}

let canvasSupport: boolean | null = null;

/** jsdom and other DOM-less hosts have no 2D context to draw on. */
function canvasAvailable(): boolean {
  if (canvasSupport === null) {
    try {
      canvasSupport =
        typeof document !== "undefined" &&
        document.createElement("canvas").getContext("2d") !== null;
    } catch {
      canvasSupport = false;
    }
  }
  return canvasSupport;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("The captured screenshot could not be decoded."));
    image.src = dataUrl;
  });
}

function scaleCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  context.drawImage(source, 0, 0, width, height);

  return canvas;
}

/**
 * Rulers every `GRID_STEP` CSS pixels, labelled with the coordinate a click
 * would use. Reading a position off the picture then needs no arithmetic.
 */
function drawGrid(canvas: HTMLCanvasElement, cssPerPixel: number): void {
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  const step = GRID_STEP / cssPerPixel;

  context.save();
  context.lineWidth = 1;
  context.strokeStyle = "rgba(255, 0, 128, 0.4)";
  context.font = "11px monospace";
  context.textBaseline = "top";

  const label = (text: string, x: number, y: number): void => {
    const width = context.measureText(text).width + 4;
    context.fillStyle = "rgba(255, 255, 255, 0.8)";
    context.fillRect(x, y, width, 13);
    context.fillStyle = "rgba(200, 0, 100, 1)";
    context.fillText(text, x + 2, y + 1);
  };

  for (let x = step; x < canvas.width; x += step) {
    context.beginPath();
    context.moveTo(Math.round(x) + 0.5, 0);
    context.lineTo(Math.round(x) + 0.5, canvas.height);
    context.stroke();
    label(String(Math.round(x * cssPerPixel)), x + 2, 1);
  }

  for (let y = step; y < canvas.height; y += step) {
    context.beginPath();
    context.moveTo(0, Math.round(y) + 0.5);
    context.lineTo(canvas.width, Math.round(y) + 0.5);
    context.stroke();
    label(String(Math.round(y * cssPerPixel)), 1, y + 2);
  }

  context.restore();
}

/**
 * Captures the tab and returns an image scaled to the CSS size of its
 * viewport. Without a canvas the raw capture is passed through unchanged.
 */
export async function captureScreenshot(
  tabId: number,
  windowId: number,
  options: ScreenshotOptions,
): Promise<Screenshot> {
  const viewport = await readViewportInfo(tabId);
  const raw = await captureVisibleTab(windowId);

  if (!canvasAvailable()) {
    return {
      dataUrl: raw,
      thumbnailDataUrl: raw,
      width: viewport?.width ?? 0,
      height: viewport?.height ?? 0,
      viewport,
      cssPerPixel: 1,
    };
  }

  const image = await loadImage(raw);
  const maxWidth = Math.max(MIN_MAX_WIDTH, options.maxWidth);
  // The capture is in device pixels; the CSS width of the viewport is the
  // size at which one image pixel means one clickable pixel.
  const targetWidth = Math.min(viewport?.width ?? image.width, maxWidth);
  const scale = targetWidth / image.width;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = scaleCanvas(image, width, height);
  const cssPerPixel = viewport ? viewport.width / width : 1;

  if (options.grid && viewport) {
    drawGrid(canvas, cssPerPixel);
  }

  const thumbnailWidth = Math.min(THUMBNAIL_WIDTH, width);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    thumbnailDataUrl: scaleCanvas(
      canvas,
      thumbnailWidth,
      Math.max(1, Math.round((height * thumbnailWidth) / width)),
    ).toDataURL("image/jpeg", THUMBNAIL_QUALITY),
    width,
    height,
    viewport,
    cssPerPixel,
  };
}

/** The text that travels back to the model next to the picture. */
export function describeScreenshot(shot: Screenshot): string {
  const lines: string[] = [];
  const { viewport } = shot;

  if (viewport) {
    lines.push(`Screenshot of ${viewport.url} (${viewport.title}).`);
    lines.push(
      `Viewport ${viewport.width}x${viewport.height} CSS px, scrolled to ` +
        `(${viewport.scrollX}, ${viewport.scrollY}) of a ` +
        `${viewport.pageWidth}x${viewport.pageHeight} px page.`,
    );
    lines.push(
      shot.cssPerPixel === 1
        ? `Image ${shot.width}x${shot.height} px: one image pixel is one CSS pixel, so an ` +
            "x/y read off the image can go straight into browser_click, browser_hover or browser_describe_point."
        : `Image ${shot.width}x${shot.height} px: multiply an image coordinate by ` +
            `${shot.cssPerPixel.toFixed(3)} to get the CSS pixels browser_click expects.`,
    );
    lines.push(
      "Coordinates are relative to the viewport, not the document: scrolling moves them.",
    );
  } else {
    lines.push(
      "Screenshot of the visible tab. No content script answered, so the viewport " +
        "geometry is unknown and coordinates cannot be mapped reliably.",
    );
  }

  return lines.join("\n");
}
