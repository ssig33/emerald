import React, { useState, useEffect } from "react";
import { Box, List, ListItem, ListItemText, Typography } from "@mui/material";
import { ChatHistoryItem } from "../types";
import { chatStorage } from "../utils/chatStorage";

interface ThreadListProps {
  onThreadSelect: (threadId: string) => void;
  onClose?: () => void;
}

const ThreadList: React.FC<ThreadListProps> = ({ onThreadSelect, onClose }) => {
  const [threads, setThreads] = useState<ChatHistoryItem[]>([]);

  useEffect(() => {
    const loadThreads = async () => {
      const threadList = await chatStorage.getThreadList();
      setThreads(threadList);
    };
    loadThreads();
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2, flexShrink: 0 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Thread List
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <List>
          {threads.map((thread) => (
            <ListItem
              key={thread.threadId}
              onClick={() => {
                onThreadSelect(thread.threadId);
                onClose?.();
              }}
              sx={{ cursor: "pointer" }}
            >
              <ListItemText
                primary={thread.title || "Untitled"}
                secondary={formatTime(thread.lastUpdated)}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
};

export default ThreadList;
