import React from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";
import { useSettings } from "../hooks/useSettings";
import { ReasoningEffort } from "../types/openai";
import { MODELS, REASONING_EFFORTS, ModelId } from "../lib/openai/constants";

/**
 * Chat-level picker for the GPT-5.6 tier and the reasoning effort.
 * Both values live in the shared settings, so they survive a reload and
 * apply to every conversation.
 */
const ModelSelector: React.FC = () => {
  const { settings, loading, updateModel, updateReasoningEffort } =
    useSettings();

  const handleModelChange = (event: SelectChangeEvent) => {
    updateModel(event.target.value as ModelId);
  };

  const handleEffortChange = (event: SelectChangeEvent) => {
    updateReasoningEffort(event.target.value as ReasoningEffort);
  };

  return (
    <Box sx={{ display: "flex", gap: 1, mb: 1, flexShrink: 0 }}>
      <FormControl size="small" sx={{ flex: 1 }} disabled={loading}>
        <InputLabel id="model-select-label">Model</InputLabel>
        <Select
          labelId="model-select-label"
          label="Model"
          value={settings.model}
          onChange={handleModelChange}
        >
          {MODELS.map((model) => (
            <MenuItem key={model.id} value={model.id}>
              {model.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ flex: 1 }} disabled={loading}>
        <InputLabel id="reasoning-effort-select-label">Reasoning</InputLabel>
        <Select
          labelId="reasoning-effort-select-label"
          label="Reasoning"
          value={settings.reasoningEffort}
          onChange={handleEffortChange}
        >
          {REASONING_EFFORTS.map((effort) => (
            <MenuItem key={effort} value={effort}>
              {effort}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default ModelSelector;
