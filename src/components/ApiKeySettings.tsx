import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useSettings } from "../hooks/useSettings";

const ApiKeySettings: React.FC = () => {
  const { settings, saveSettings } = useSettings();
  const [apiKey, setApiKey] = useState(settings.openaiApiKey);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await saveSettings({ openaiApiKey: apiKey, systemPrompt });
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const isValidApiKey = (key: string) => {
    return key.startsWith("sk-") && key.length > 20;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        OpenAI Settings
      </Typography>

      <TextField
        fullWidth
        label="OpenAI API Key"
        type={showApiKey ? "text" : "password"}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-..."
        margin="normal"
        error={apiKey.length > 0 && !isValidApiKey(apiKey)}
        helperText={
          apiKey.length > 0 && !isValidApiKey(apiKey)
            ? "API key should start with 'sk-' and be at least 20 characters long"
            : "Get your API key from https://platform.openai.com/api-keys"
        }
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle api key visibility"
                onClick={() => setShowApiKey(!showApiKey)}
                edge="end"
              >
                {showApiKey ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <TextField
        fullWidth
        label="System Prompt"
        multiline
        minRows={4}
        maxRows={8}
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        placeholder="System prompt that will be sent at the start of each new conversation..."
        margin="normal"
        helperText="This prompt will be sent to the AI at the beginning of each new conversation to set the context and behavior."
      />

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={
          !apiKey ||
          !isValidApiKey(apiKey) ||
          !systemPrompt.trim() ||
          saveStatus === "saving"
        }
        sx={{ mt: 2 }}
        fullWidth
      >
        {saveStatus === "saving" ? "Saving..." : "Save Settings"}
      </Button>

      {saveStatus === "success" && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Settings saved successfully!
        </Alert>
      )}

      {saveStatus === "error" && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to save settings. Please try again.
        </Alert>
      )}
    </Box>
  );
};

export default ApiKeySettings;
