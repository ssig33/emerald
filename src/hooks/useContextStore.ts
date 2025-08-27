import { useContextStore } from "../stores/contextStore";
import { useEffect } from "react";

export const useContextData = () => {
  const contextData = useContextStore((state) => state.contextData);
  const includePageText = useContextStore((state) => state.includePageText);
  const loading = useContextStore((state) => state.loading);
  const error = useContextStore((state) => state.error);

  const togglePageText = useContextStore((state) => state.togglePageText);
  const fetchText = useContextStore((state) => state.fetchText);

  useEffect(() => {
    if (includePageText) {
      fetchText();
    }
  }, [includePageText, fetchText]);

  return {
    contextData,
    includePageText,
    loading,
    error,
    togglePageText,
    refetchText: fetchText,
  };
};
