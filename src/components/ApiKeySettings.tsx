import React, { useState, useEffect } from "react";
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
  const { settings, loading, saveSettings } = useSettings();
  const [apiKey, setApiKey] = useState(settings.openaiApiKey);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [braveApiKey, setBraveApiKey] = useState(settings.braveApiKey);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (loading) return;
    setApiKey(settings.openaiApiKey);
    setSystemPrompt(settings.systemPrompt);
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
    setBraveApiKey(settings.braveApiKey);
  }, [loading, settings]);
  const [showBraveApiKey, setShowBraveApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await saveSettings({
        openaiApiKey: apiKey,
        systemPrompt,
        baseUrl,
        model,
        braveApiKey,
      });
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const isValidApiKey = (key: string) => {
    return key.length > 0;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        API Settings
      </Typography>

      <TextField
        fullWidth
        label="API Key"
        type={showApiKey ? "text" : "password"}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-..."
        margin="normal"
        error={apiKey.length > 0 && !isValidApiKey(apiKey)}
        helperText="API key for OpenAI, OpenRouter, or any compatible provider"
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
        label="Base URL"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder="https://api.openai.com/v1/chat/completions"
        margin="normal"
        helperText="Chat Completions endpoint. e.g. OpenRouter: https://openrouter.ai/api/v1/chat/completions"
      />

      <TextField
        fullWidth
        label="Model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder="gpt-5.4"
        margin="normal"
        helperText="Model ID. e.g. OpenRouter: anthropic/claude-opus-4.1"
      />

      <TextField
        fullWidth
        label="Brave Search API Key (optional)"
        type={showBraveApiKey ? "text" : "password"}
        value={braveApiKey}
        onChange={(e) => setBraveApiKey(e.target.value)}
        placeholder="BSA..."
        margin="normal"
        helperText="Set to enable web search. The AI looks things up when needed and cites source URLs."
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle brave api key visibility"
                onClick={() => setShowBraveApiKey(!showBraveApiKey)}
                edge="end"
              >
                {showBraveApiKey ? <VisibilityOff /> : <Visibility />}
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
          !baseUrl.trim() ||
          !model.trim() ||
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
