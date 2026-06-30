import { useState } from "react";
import { Message } from "../types";
import { useSettings } from "./useSettings";
import { buildConversationHtml } from "../lib/export/conversation-html";
import { uploadToS3, S3Config } from "../lib/storage/s3";

export type ExportStatus = "idle" | "uploading" | "success" | "error";

function buildObjectKey(prefix: string): string {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const random = Math.random().toString(36).slice(2, 8);
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const name = `${stamp}-${random}.html`;
  return cleanPrefix ? `${cleanPrefix}/${name}` : name;
}

export const useConversationExport = () => {
  const { settings } = useSettings();
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = Boolean(
    settings.s3Endpoint &&
    settings.s3Bucket &&
    settings.s3AccessKeyId &&
    settings.s3SecretAccessKey,
  );

  const exportConversation = async (messages: Message[]) => {
    if (messages.length === 0) {
      setError("No conversation to save.");
      setStatus("error");
      return null;
    }
    if (!isConfigured) {
      setError("S3 storage is not configured. Open settings to add it.");
      setStatus("error");
      return null;
    }

    setStatus("uploading");
    setError(null);
    setResultUrl(null);

    try {
      const html = buildConversationHtml(messages);
      const key = buildObjectKey(settings.s3Prefix);
      const config: S3Config = {
        endpoint: settings.s3Endpoint,
        region: settings.s3Region,
        bucket: settings.s3Bucket,
        accessKeyId: settings.s3AccessKeyId,
        secretAccessKey: settings.s3SecretAccessKey,
        pathStyle: settings.s3PathStyle,
        publicBaseUrl: settings.s3PublicBaseUrl || undefined,
      };

      const { url } = await uploadToS3(
        config,
        key,
        html,
        "text/html; charset=utf-8",
      );
      setResultUrl(url);
      setStatus("success");
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
      return null;
    }
  };

  const reset = () => {
    setStatus("idle");
    setResultUrl(null);
    setError(null);
  };

  return {
    status,
    resultUrl,
    error,
    isConfigured,
    exportConversation,
    reset,
  };
};
