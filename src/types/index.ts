export interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: number;
  status?: "streaming" | "done";
  images?: ImageData[];
  pageContent?: PageContent;
  toolInteractions?: ToolInteraction[];
}

export interface ToolInteraction {
  name: string;
  arguments: string;
  result: string;
  /** Thumbnail of the picture the call returned, e.g. a screenshot. */
  image?: string;
}

export interface ImageData {
  dataUrl: string;
  timestamp: number;
}

export type PageContentType = "markdown" | "html";

export interface PageContent {
  title: string;
  url: string;
  markdown: string;
  html: string;
  contentType: PageContentType;
}

export interface ApiRequest {
  message: string;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CapturedImage {
  dataUrl: string;
  timestamp: number;
}
