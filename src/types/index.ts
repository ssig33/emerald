export interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: number;
  status?: "streaming" | "done";
  images?: ImageData[];
}

export interface ImageData {
  dataUrl: string;
  timestamp: number;
}

export interface ContextData {
  url?: string;
  text?: string;
  images?: ImageData[];
}

export interface ApiRequest {
  message: string;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  title?: string;
  createdAt: number;
}

export interface ChatHistoryItem {
  threadId: string;
  title?: string;
  lastUpdated: number;
}

export interface AppState {
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  loading: boolean;
  error: string | null;
  context: ContextData;
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
