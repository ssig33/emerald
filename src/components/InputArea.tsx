import React, { useState } from "react";
import {
  Box,
  TextField,
  IconButton,
  Paper,
  InputAdornment,
  CircularProgress,
  Chip,
  Avatar,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import ImageSelector from "./ImageSelector";
import { ImageData } from "../types";

interface InputAreaProps {
  onSendMessage: (message: string, images?: ImageData[]) => Promise<void>;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onImageCapture?: (image: ImageData) => void;
}

const InputArea: React.FC<InputAreaProps> = ({
  onSendMessage,
  disabled = false,
  value,
  onChange,
  onImageCapture,
}) => {
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<ImageData[]>([]);

  const currentValue = value !== undefined ? value : message;
  const handleValueChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
    } else {
      setMessage(newValue);
    }
  };

  const handleSend = async () => {
    if (currentValue.trim() || images.length > 0) {
      await onSendMessage(currentValue, images);
      if (onChange) {
        onChange("");
      } else {
        setMessage("");
      }
      setImages([]);
    }
  };

  const handleImageCapture = (image: ImageData) => {
    setImages((prev) => [...prev, image]);
    onImageCapture?.(image);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (currentValue.trim() || images.length > 0) && !disabled;

  return (
    <Paper sx={{ p: 1, flexShrink: 0 }}>
      {/* Image previews */}
      {images.length > 0 && (
        <Box sx={{ mb: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
          {images.map((image, index) => (
            <Chip
              key={index}
              avatar={
                <Avatar src={image.dataUrl} sx={{ width: 24, height: 24 }} />
              }
              label={`Image ${index + 1}`}
              onDelete={() => removeImage(index)}
              deleteIcon={<CloseIcon />}
              variant="outlined"
              size="small"
            />
          ))}
        </Box>
      )}
      <TextField
        fullWidth
        multiline
        maxRows={4}
        placeholder="Type a message..."
        value={currentValue}
        onChange={(e) => handleValueChange(e.target.value)}
        onKeyPress={handleKeyPress}
        variant="outlined"
        size="small"
        disabled={disabled}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <ImageSelector onImageCapture={handleImageCapture} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {disabled ? (
                <CircularProgress size={20} />
              ) : (
                <IconButton
                  onClick={handleSend}
                  disabled={!canSend}
                  size="small"
                >
                  <SendIcon />
                </IconButton>
              )}
            </InputAdornment>
          ),
        }}
      />
    </Paper>
  );
};

export default InputArea;
