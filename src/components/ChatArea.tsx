import React, { useEffect, useRef } from "react";
import { Box, Paper, Typography, Avatar, Chip } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "../types";
import PersonIcon from "@mui/icons-material/Person";
import SmartToyIcon from "@mui/icons-material/SmartToy";

interface ChatAreaProps {
  messages: Message[];
  error?: string | null;
}

const ChatArea: React.FC<ChatAreaProps> = ({ messages, error }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
    const isUser = message.sender === "user";

    return (
      <Box
        sx={{
          display: "flex",
          gap: 1,
          flexDirection: isUser ? "row-reverse" : "row",
          mb: 2,
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: isUser ? "primary.main" : "secondary.main",
          }}
        >
          {isUser ? <PersonIcon /> : <SmartToyIcon />}
        </Avatar>

        <Box sx={{ flex: 1, maxWidth: "80%" }}>
          <Paper
            sx={{
              p: 1.5,
              bgcolor: isUser ? "primary.light" : "grey.100",
              color: isUser ? "primary.contrastText" : "text.primary",
            }}
          >
            {/* Show images if present */}
            {message.images && message.images.length > 0 && (
              <Box sx={{ mb: 1 }}>
                {message.images.map((image, index) => (
                  <img
                    key={index}
                    src={image.dataUrl}
                    alt={`Attached image ${index + 1}`}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "200px",
                      borderRadius: "8px",
                      marginBottom: "8px",
                      display: "block",
                    }}
                  />
                ))}
              </Box>
            )}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {message.sender === "ai" && message.status === "streaming" && (
              <Chip
                label="Typing..."
                size="small"
                sx={{ mt: 1, fontSize: "0.7rem" }}
              />
            )}
          </Paper>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "block",
              mt: 0.5,
              textAlign: isUser ? "right" : "left",
            }}
          >
            {formatTime(message.timestamp)}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      ref={scrollRef}
      sx={{
        flex: 1,
        overflow: "auto",
        mb: 2,
        display: "flex",
        flexDirection: "column",
        px: 1,
      }}
    >
      {messages.length === 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <Paper sx={{ p: 3, textAlign: "center" }}>
            <SmartToyIcon
              sx={{ fontSize: 48, color: "text.secondary", mb: 1 }}
            />
            <Typography variant="body1" color="text.secondary">
              Start chatting with Emerald AI
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Type a message and press send
            </Typography>
          </Paper>
        </Box>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {error && (
        <Box sx={{ mb: 2 }}>
          <Paper
            sx={{ p: 1.5, bgcolor: "error.light", color: "error.contrastText" }}
          >
            <Typography variant="body2">Error: {error}</Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default ChatArea;
