import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Divider,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useSettings } from "../hooks/useSettings";
import { MODEL, REASONING_EFFORT } from "../lib/openai/constants";

const ApiKeySettings: React.FC = () => {
  const { settings, loading, saveSettings } = useSettings();
  const [apiKey, setApiKey] = useState(settings.openaiApiKey);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [showApiKey, setShowApiKey] = useState(false);
  const [s3Endpoint, setS3Endpoint] = useState(settings.s3Endpoint);
  const [s3Region, setS3Region] = useState(settings.s3Region);
  const [s3Bucket, setS3Bucket] = useState(settings.s3Bucket);
  const [s3AccessKeyId, setS3AccessKeyId] = useState(settings.s3AccessKeyId);
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState(
    settings.s3SecretAccessKey,
  );
  const [s3PathStyle, setS3PathStyle] = useState(settings.s3PathStyle);
  const [s3Prefix, setS3Prefix] = useState(settings.s3Prefix);
  const [s3PublicBaseUrl, setS3PublicBaseUrl] = useState(
    settings.s3PublicBaseUrl,
  );
  const [showSecretKey, setShowSecretKey] = useState(false);

  useEffect(() => {
    if (loading) return;
    setApiKey(settings.openaiApiKey);
    setSystemPrompt(settings.systemPrompt);
    setS3Endpoint(settings.s3Endpoint);
    setS3Region(settings.s3Region);
    setS3Bucket(settings.s3Bucket);
    setS3AccessKeyId(settings.s3AccessKeyId);
    setS3SecretAccessKey(settings.s3SecretAccessKey);
    setS3PathStyle(settings.s3PathStyle);
    setS3Prefix(settings.s3Prefix);
    setS3PublicBaseUrl(settings.s3PublicBaseUrl);
  }, [loading, settings]);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await saveSettings({
        openaiApiKey: apiKey,
        systemPrompt,
        s3Endpoint,
        s3Region,
        s3Bucket,
        s3AccessKeyId,
        s3SecretAccessKey,
        s3PathStyle,
        s3Prefix,
        s3PublicBaseUrl,
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
        label="OpenAI API Key"
        type={showApiKey ? "text" : "password"}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-..."
        margin="normal"
        error={apiKey.length > 0 && !isValidApiKey(apiKey)}
        helperText="API key for the OpenAI Responses API"
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

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Model: {MODEL} (reasoning effort: {REASONING_EFFORT}). Web search is
        handled by the built-in OpenAI tool.
      </Typography>

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

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Conversation Storage (S3 / MinIO)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Saved conversations are uploaded as public HTML pages to an
        S3-compatible bucket.
      </Typography>

      <TextField
        fullWidth
        label="Endpoint"
        value={s3Endpoint}
        onChange={(e) => setS3Endpoint(e.target.value)}
        placeholder="https://s3.amazonaws.com or https://minio.example.com"
        margin="normal"
        helperText="Base URL of the S3-compatible service."
      />

      <TextField
        fullWidth
        label="Region"
        value={s3Region}
        onChange={(e) => setS3Region(e.target.value)}
        placeholder="us-east-1"
        margin="normal"
      />

      <TextField
        fullWidth
        label="Bucket"
        value={s3Bucket}
        onChange={(e) => setS3Bucket(e.target.value)}
        placeholder="my-bucket"
        margin="normal"
      />

      <TextField
        fullWidth
        label="Access Key ID"
        value={s3AccessKeyId}
        onChange={(e) => setS3AccessKeyId(e.target.value)}
        margin="normal"
      />

      <TextField
        fullWidth
        label="Secret Access Key"
        type={showSecretKey ? "text" : "password"}
        value={s3SecretAccessKey}
        onChange={(e) => setS3SecretAccessKey(e.target.value)}
        margin="normal"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle secret key visibility"
                onClick={() => setShowSecretKey(!showSecretKey)}
                edge="end"
              >
                {showSecretKey ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <TextField
        fullWidth
        label="Object Key Prefix"
        value={s3Prefix}
        onChange={(e) => setS3Prefix(e.target.value)}
        placeholder="emerald/conversations"
        margin="normal"
        helperText="Folder-like prefix for uploaded files."
      />

      <TextField
        fullWidth
        label="Public Base URL (optional)"
        value={s3PublicBaseUrl}
        onChange={(e) => setS3PublicBaseUrl(e.target.value)}
        placeholder="https://files.example.com"
        margin="normal"
        helperText="If set, the shareable link uses this base instead of the endpoint."
      />

      <FormControlLabel
        control={
          <Switch
            checked={s3PathStyle}
            onChange={(e) => setS3PathStyle(e.target.checked)}
          />
        }
        label="Path-style addressing (required for MinIO)"
        sx={{ mt: 1 }}
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
