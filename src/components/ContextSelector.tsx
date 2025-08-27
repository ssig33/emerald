import React from "react";
import {
  Box,
  FormControlLabel,
  Switch,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useContextData } from "../hooks/useContextStore";

const ContextSelector: React.FC = () => {
  const { contextData, includePageText, loading, error, togglePageText } =
    useContextData();

  const truncateText = (text: string, maxLength: number = 50) => {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  return (
    <Paper sx={{ p: 2, mb: 2, flexShrink: 0 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="subtitle2">Include Page Text</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={includePageText}
              onChange={togglePageText}
              size="small"
              disabled={loading}
            />
          }
          label=""
          sx={{ m: 0 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 1, fontSize: "0.8rem" }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Extracting page text...
          </Typography>
        </Box>
      )}

      {includePageText && contextData.text && (
        <Box sx={{ mt: 1 }}>
          <Chip
            label={`Page Text: ${truncateText(contextData.text, 40)}`}
            size="small"
            variant="outlined"
            color="primary"
          />
        </Box>
      )}
    </Paper>
  );
};

export default ContextSelector;
