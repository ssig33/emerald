import React, { useState, useCallback, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Drawer,
  IconButton,
  Divider,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import AddIcon from "@mui/icons-material/Add";
import ChatArea from "../components/ChatArea";
import InputArea from "../components/InputArea";
import ThreadList from "../components/ThreadList";
import ApiKeySettings from "../components/ApiKeySettings";
import { Message, ImageData } from "../types";
import { useApi } from "../hooks/useApi";
import { useChatThread } from "../hooks/useChatThread";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#50c878",
    },
    secondary: {
      main: "#f50057",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          height: "100%",
        },
        body: {
          height: "100%",
          margin: 0,
          padding: 0,
        },
        "#root": {
          height: "100%",
          display: "flex",
          flexDirection: "column",
        },
      },
    },
  },
});

const App: React.FC = () => {
  const [inputValue, setInputValue] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const {
    messages,
    threadId,
    addMessage,
    appendToLastMessage,
    completeLastMessage,
    loadChatHistory,
  } = useChatThread();

  const { sendMessage, error } = useApi();

  const generateMessageId = (): string => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleImageCapture = useCallback((image: ImageData) => {
    // Image is now handled directly in InputArea component
    console.log("Image captured:", image);
  }, []);

  const handleSendMessage = useCallback(
    async (messageText: string, images?: ImageData[]) => {
      if (!messageText.trim() && (!images || images.length === 0)) return;

      // Add user message
      const userMessage: Message = {
        id: generateMessageId(),
        content: messageText,
        sender: "user",
        timestamp: Date.now(),
        images: images,
      };

      addMessage(userMessage);
      // Add streaming AI response message
      const aiMessage: Message = {
        id: generateMessageId(),
        content: "",
        sender: "ai",
        timestamp: Date.now(),
        status: "streaming",
      };
      addMessage(aiMessage);
      setInputValue(""); // Clear input field

      // API call with images only
      const contextToSend: { images?: ImageData[] } | undefined =
        images && images.length > 0
          ? {
              images: images,
            }
          : undefined;

      await sendMessage(
        {
          message: messageText,
        },
        messages.filter((m) => m.status !== "streaming"),
        contextToSend,
        // onMessage: receive response chunks
        (chunk: string) => {
          appendToLastMessage(chunk);
        },
        // onComplete: response completed
        () => {
          completeLastMessage();
        },
      );
    },
    [
      sendMessage,
      threadId,
      addMessage,
      appendToLastMessage,
      completeLastMessage,
      messages,
    ],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <AppBar position="static" sx={{ flexShrink: 0 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={() => setDrawerOpen(!drawerOpen)}
              edge="start"
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Emerald
            </Typography>
            <IconButton
              color="inherit"
              aria-label="new conversation"
              onClick={() => window.location.reload()}
            >
              <AddIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sx={{
            "& .MuiDrawer-paper": {
              width: 320,
            },
          }}
        >
          <ThreadList
            onThreadSelect={loadChatHistory}
            onClose={() => setDrawerOpen(false)}
          />
          <Divider />
          <ApiKeySettings />
        </Drawer>
        <Container
          maxWidth={false}
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: 1,
            overflow: "hidden",
          }}
        >
          <ChatArea messages={messages} error={error} />
          <InputArea
            onSendMessage={handleSendMessage}
            disabled={messages.some((m) => m.status === "streaming")}
            value={inputValue}
            onChange={setInputValue}
            onImageCapture={handleImageCapture}
          />
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default App;
