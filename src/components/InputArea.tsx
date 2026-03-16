import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  IconButton,
  Paper,
  InputAdornment,
  CircularProgress,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import ArticleIcon from "@mui/icons-material/Article";
import ImageSelector from "./ImageSelector";
import { ImageData, PageContent, PageContentType } from "../types";
import { extractPageContent } from "../lib/page-extractor";

interface InputAreaProps {
  onSendMessage: (
    message: string,
    images?: ImageData[],
    pageContent?: PageContent,
  ) => Promise<void>;
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
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [isCapturingPage, setIsCapturingPage] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);

  useEffect(() => {
    if (dialogOpen) {
      chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        setCurrentTabUrl(tabs[0]?.url || null);
      });
    }
  }, [dialogOpen]);

  const canToggleHtml =
    currentTabUrl !== null &&
    pageContent !== null &&
    currentTabUrl === pageContent.url;

  const handleContentTypeChange = (
    _: React.MouseEvent<HTMLElement>,
    newValue: PageContentType | null,
  ) => {
    if (newValue && pageContent) {
      setPageContent({ ...pageContent, contentType: newValue });
    }
  };

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
      await onSendMessage(currentValue, images, pageContent || undefined);
      if (onChange) {
        onChange("");
      } else {
        setMessage("");
      }
      setImages([]);
      setPageContent(null);
    }
  };

  const handleImageCapture = (image: ImageData) => {
    setImages((prev) => [...prev, image]);
    onImageCapture?.(image);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePageCapture = async () => {
    setIsCapturingPage(true);
    try {
      const content = await extractPageContent();
      setPageContent(content);
    } catch (error) {
      console.error("Failed to capture page:", error);
    } finally {
      setIsCapturingPage(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (currentValue.trim() || images.length > 0) && !disabled;

  const truncateTitle = (title: string, maxLen = 30) => {
    if (title.length <= maxLen) return title;
    return title.substring(0, maxLen) + "...";
  };

  return (
    <Paper sx={{ p: 1, flexShrink: 0 }}>
      {(images.length > 0 || pageContent) && (
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
          {pageContent && (
            <Chip
              icon={<ArticleIcon />}
              label={truncateTitle(pageContent.title || pageContent.url)}
              onClick={() => setDialogOpen(true)}
              onDelete={() => setPageContent(null)}
              deleteIcon={<CloseIcon />}
              variant="outlined"
              size="small"
              color="primary"
            />
          )}
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
              {isCapturingPage ? (
                <CircularProgress size={20} />
              ) : (
                <IconButton
                  onClick={handlePageCapture}
                  size="small"
                  title="Capture page content"
                >
                  <ArticleIcon />
                </IconButton>
              )}
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

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{pageContent?.title}</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {pageContent?.url}
            </Typography>
            <ToggleButtonGroup
              value={pageContent?.contentType || "markdown"}
              exclusive
              onChange={handleContentTypeChange}
              size="small"
            >
              <ToggleButton value="markdown">Markdown</ToggleButton>
              <ToggleButton value="html" disabled={!canToggleHtml}>
                HTML
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box
            sx={{
              maxHeight: 400,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              fontSize: "0.85rem",
            }}
          >
            {pageContent?.contentType === "html"
              ? pageContent?.html
              : pageContent?.markdown}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default InputArea;
