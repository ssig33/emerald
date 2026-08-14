import React from "react";
import {
  Box,
  Button,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Tooltip,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useSettings } from "../hooks/useSettings";
import { ReasoningEffort } from "../types/openai";
import {
  MODELS,
  REASONING_EFFORTS,
  ModelId,
  modelLabel,
} from "../lib/openai/constants";

/**
 * Chat-level picker for the GPT-5.6 tier and the reasoning effort.
 * The pickers stay collapsed behind a summary button so they only take up
 * room while they are being used. Selection and expanded state both live in
 * the shared settings, so they survive a reload and apply to every
 * conversation.
 */
const ModelSelector: React.FC = () => {
  const {
    settings,
    loading,
    updateModel,
    updateReasoningEffort,
    updateModelSelectorOpen,
  } = useSettings();

  const open = settings.modelSelectorOpen;

  const handleModelChange = (event: SelectChangeEvent) => {
    updateModel(event.target.value as ModelId);
  };

  const handleEffortChange = (event: SelectChangeEvent) => {
    updateReasoningEffort(event.target.value as ReasoningEffort);
  };

  return (
    <Box sx={{ mb: 1, flexShrink: 0 }}>
      <Tooltip
        title={open ? "Hide model settings" : "Change model and reasoning"}
      >
        {/* The span keeps the tooltip working while the button is disabled. */}
        <span>
          <Button
            size="small"
            color="inherit"
            disabled={loading}
            onClick={() => updateModelSelectorOpen(!open)}
            startIcon={<TuneIcon fontSize="small" />}
            endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            aria-expanded={open}
            aria-controls="model-selector-panel"
            sx={{ textTransform: "none", color: "text.secondary" }}
          >
            {`${modelLabel(settings.model)} · ${settings.reasoningEffort}`}
          </Button>
        </span>
      </Tooltip>

      <Collapse in={open} unmountOnExit>
        <Box id="model-selector-panel" sx={{ display: "flex", gap: 1, mt: 1 }}>
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
            <InputLabel id="reasoning-effort-select-label">
              Reasoning
            </InputLabel>
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
      </Collapse>
    </Box>
  );
};

export default ModelSelector;
