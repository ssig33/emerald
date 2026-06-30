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
  List,
  ListItem,
  ListItemText,
  Stack,
} from "@mui/material";
import { Visibility, VisibilityOff, Delete } from "@mui/icons-material";
import { useSettings } from "../hooks/useSettings";

const ApiKeySettings: React.FC = () => {
  const {
    settings,
    profiles,
    loading,
    saveSettings,
    saveProfile,
    applyProfile,
    deleteProfile,
  } = useSettings();
  const [apiKey, setApiKey] = useState(settings.openaiApiKey);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [braveApiKey, setBraveApiKey] = useState(settings.braveApiKey);
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
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
    setBraveApiKey(settings.braveApiKey);
    setS3Endpoint(settings.s3Endpoint);
    setS3Region(settings.s3Region);
    setS3Bucket(settings.s3Bucket);
    setS3AccessKeyId(settings.s3AccessKeyId);
    setS3SecretAccessKey(settings.s3SecretAccessKey);
    setS3PathStyle(settings.s3PathStyle);
    setS3Prefix(settings.s3Prefix);
    setS3PublicBaseUrl(settings.s3PublicBaseUrl);
  }, [loading, settings]);
  const [showBraveApiKey, setShowBraveApiKey] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  const handleSaveProfile = async () => {
    const name = profileName.trim();
    if (!name) return;
    await saveProfile(name, { baseUrl, openaiApiKey: apiKey, model });
    setProfileName("");
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await saveSettings({
        openaiApiKey: apiKey,
        systemPrompt,
        baseUrl,
        model,
        braveApiKey,
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

      <Box
        sx={{
          mt: 1,
          mb: 1,
          p: 1.5,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          Provider Profiles
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Save the current Base URL, API Key and Model as a named profile, then
          switch providers with one click.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="Profile name"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="e.g. OpenRouter Claude"
          />
          <Button
            variant="outlined"
            onClick={handleSaveProfile}
            disabled={!profileName.trim() || !baseUrl.trim() || !model.trim()}
            sx={{ whiteSpace: "nowrap" }}
          >
            Save Profile
          </Button>
        </Stack>

        {profiles.length > 0 && (
          <List dense disablePadding>
            {profiles.map((profile) => (
              <ListItem
                key={profile.id}
                disableGutters
                secondaryAction={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => applyProfile(profile.id)}
                    >
                      Apply
                    </Button>
                    <IconButton
                      edge="end"
                      aria-label={`delete profile ${profile.name}`}
                      onClick={() => deleteProfile(profile.id)}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemText
                  primary={profile.name}
                  secondary={profile.model}
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

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
