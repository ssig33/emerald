import React, { useState, useEffect } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  Typography,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
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

  const handleDelete = async (threadId: string) => {
    await chatStorage.deleteChatHistory(threadId);
    setThreads((prev) => prev.filter((t) => t.threadId !== threadId));
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Box>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Thread List
        </Typography>
      </Box>
      <List>
        {threads.map((thread) => (
          <ListItem
            key={thread.threadId}
            onClick={() => {
              onThreadSelect(thread.threadId);
              onClose?.();
            }}
            sx={{ cursor: "pointer" }}
            secondaryAction={
              <IconButton
                edge="end"
                aria-label="delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(thread.threadId);
                }}
              >
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText
              primary={thread.title || "Untitled"}
              secondary={formatTime(thread.lastUpdated)}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default ThreadList;
