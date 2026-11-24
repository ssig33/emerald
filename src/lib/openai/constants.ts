import { ReasoningEffort } from "../../types/openai";

/** Base URL of the OpenAI API; `/responses` is appended to reach the endpoint. */
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/** Responses API endpoint of a server, given its base URL. */
export function responsesUrl(baseUrl = DEFAULT_BASE_URL): string {
  const base = baseUrl.trim() || DEFAULT_BASE_URL;
  return `${base.replace(/\/+$/, "")}/responses`;
}

/** Model IDs of the GPT-6 capability tiers exposed by the Responses API. */
export const MODEL_IDS = [
  "gpt-6.2-astra",
  "gpt-6.2-sol",
  "gpt-6.1-terra",
  "gpt-6-luna",
] as const;

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
    id: "gpt-6.2-astra",
    label: "Astra",
    reasoningEfforts: ["low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-6.2-sol",
    label: "Sol",
    reasoningEfforts: ["low", "medium", "high", "xhigh", "max"],
  },
  { id: "gpt-6.1-terra", label: "Terra", reasoningEfforts: REASONING_EFFORTS },
  { id: "gpt-6-luna", label: "Luna", reasoningEfforts: REASONING_EFFORTS },
];

export const DEFAULT_MODEL: ModelId = "gpt-6-luna";

/** Accepted by every GPT-6 tier. */
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "max";

export function isModelId(value: unknown): value is ModelId {
  return MODEL_IDS.includes(value as ModelId);
}

/** Earlier model IDs of each tier, so saved settings keep their tier. */
const PREVIOUS_MODEL_IDS: Record<string, ModelId> = {
  "gpt-6-astra": "gpt-6.2-astra",
  "gpt-6.1-sol": "gpt-6.2-sol",
};

/** The model a stored ID refers to, or undefined when it is unknown. */
export function storedModelId(value: unknown): ModelId | undefined {
  if (isModelId(value)) return value;
  return typeof value === "string" ? PREVIOUS_MODEL_IDS[value] : undefined;
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
