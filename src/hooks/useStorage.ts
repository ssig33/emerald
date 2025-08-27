import { useState, useEffect } from "react";

export const useStorage = <T>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    const loadValue = async () => {
      try {
        const result = await chrome.storage.local.get(key);
        if (result[key] !== undefined) {
          setValue(result[key]);
        }
      } catch (error) {
        console.error("Error loading from storage:", error);
      }
    };

    loadValue();
  }, [key]);

  const setStoredValue = async (newValue: T) => {
    try {
      await chrome.storage.local.set({ [key]: newValue });
      setValue(newValue);
    } catch (error) {
      console.error("Error saving to storage:", error);
    }
  };

  return [value, setStoredValue] as const;
};
