import { ReasoningEffort } from "../../types/openai";

export const RESPONSES_URL = "https://api.openai.com/v1/responses";

/** Model IDs of the GPT-5.6 capability tiers exposed by the Responses API. */
export const MODEL_IDS = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
] as const;

export type ModelId = (typeof MODEL_IDS)[number];

export interface ModelOption {
  id: ModelId;
  /** Tier name used in the UI. */
  label: string;
}

export const MODELS: ModelOption[] = [
  { id: "gpt-5.6-sol", label: "Sol" },
  { id: "gpt-5.6-terra", label: "Terra" },
  { id: "gpt-5.6-luna", label: "Luna" },
];

export const DEFAULT_MODEL: ModelId = "gpt-5.6-luna";

/** Reasoning efforts accepted by every GPT-5.6 tier. */
export const REASONING_EFFORTS: ReasoningEffort[] = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "max";

export function isModelId(value: unknown): value is ModelId {
  return MODEL_IDS.includes(value as ModelId);
}

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return REASONING_EFFORTS.includes(value as ReasoningEffort);
}

export function modelLabel(id: ModelId): string {
  return MODELS.find((model) => model.id === id)?.label ?? id;
}
