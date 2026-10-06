import { ReasoningEffort } from "../../types/openai";

export const RESPONSES_URL = "https://api.openai.com/v1/responses";

/** Model IDs of the GPT-6 capability tiers exposed by the Responses API. */
export const MODEL_IDS = ["gpt-6-astra", "gpt-6.1-sol", "gpt-6-luna"] as const;

export type ModelId = (typeof MODEL_IDS)[number];

export interface ModelOption {
  id: ModelId;
  /** Tier name used in the UI. */
  label: string;
  /** Reasoning efforts the model accepts, from the lightest to the heaviest. */
  reasoningEfforts: ReasoningEffort[];
}

/** Every reasoning effort accepted by at least one GPT-6 tier. */
export const REASONING_EFFORTS: ReasoningEffort[] = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export const MODELS: ModelOption[] = [
  {
    id: "gpt-6-astra",
    label: "Astra",
    reasoningEfforts: ["low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-6.1-sol",
    label: "Sol",
    reasoningEfforts: ["low", "medium", "high", "xhigh", "max"],
  },
  { id: "gpt-6-luna", label: "Luna", reasoningEfforts: REASONING_EFFORTS },
];

export const DEFAULT_MODEL: ModelId = "gpt-6-luna";

/** Accepted by every GPT-6 tier. */
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "max";

export function isModelId(value: unknown): value is ModelId {
  return MODEL_IDS.includes(value as ModelId);
}

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return REASONING_EFFORTS.includes(value as ReasoningEffort);
}

function modelOption(id: ModelId): ModelOption | undefined {
  return MODELS.find((model) => model.id === id);
}

export function modelLabel(id: ModelId): string {
  return modelOption(id)?.label ?? id;
}

export function reasoningEffortsFor(id: ModelId): ReasoningEffort[] {
  return modelOption(id)?.reasoningEfforts ?? REASONING_EFFORTS;
}

/**
 * Keep the effort when the model accepts it, otherwise move to the lightest
 * effort the model does accept.
 */
export function supportedReasoningEffort(
  id: ModelId,
  effort: ReasoningEffort,
): ReasoningEffort {
  const efforts = reasoningEffortsFor(id);
  return efforts.includes(effort) ? effort : efforts[0];
}
