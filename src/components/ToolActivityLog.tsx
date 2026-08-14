import React, { useState } from "react";
import { Box, Chip, Collapse, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import TerminalIcon from "@mui/icons-material/Terminal";
import { ToolInteraction } from "../types";

interface ToolActivityLogProps {
  interactions: ToolInteraction[];
}

const MAX_RESULT_LENGTH = 800;

/** Renders tool arguments as a compact one-liner, dropping empty values. */
const formatArguments = (rawArguments: string): string => {
  if (!rawArguments) return "";

  try {
    const parsed = JSON.parse(rawArguments);
    if (typeof parsed !== "object" || parsed === null) return rawArguments;

    const entries = Object.entries(parsed).filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    );
    if (entries.length === 0) return "";

    return entries
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
  } catch {
    return rawArguments;
  }
};

const truncate = (text: string): string =>
  text.length > MAX_RESULT_LENGTH
    ? `${text.slice(0, MAX_RESULT_LENGTH)}\n… (${text.length - MAX_RESULT_LENGTH} more characters)`
    : text;

/**
 * Shows what the agent did on its own: browser tools run without asking for
 * confirmation, so every call has to be readable afterwards in the chat log.
 */
const ToolActivityLog: React.FC<ToolActivityLogProps> = ({ interactions }) => {
  const [expanded, setExpanded] = useState(false);

  if (interactions.length === 0) return null;

  return (
    <Box sx={{ mb: 1 }}>
      <Chip
        icon={<TerminalIcon />}
        label={`${interactions.length} tool action${interactions.length > 1 ? "s" : ""}`}
        size="small"
        onClick={() => setExpanded((previous) => !previous)}
        onDelete={() => setExpanded((previous) => !previous)}
        deleteIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ fontSize: "0.7rem" }}
      />

      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 1,
            p: 1,
            borderRadius: 1,
            bgcolor: "grey.200",
            fontFamily: "monospace",
            fontSize: "0.7rem",
            overflowX: "auto",
          }}
        >
          {interactions.map((interaction, index) => {
            const args = formatArguments(interaction.arguments);

            return (
              <Box
                key={index}
                sx={{ mb: index === interactions.length - 1 ? 0 : 1 }}
              >
                <Typography
                  component="div"
                  sx={{
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    fontWeight: 700,
                  }}
                >
                  {interaction.name}
                  {args ? `(${args})` : "()"}
                </Typography>
                <Typography
                  component="pre"
                  sx={{
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    m: 0,
                    color: "text.secondary",
                  }}
                >
                  {truncate(interaction.result)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

export default ToolActivityLog;
