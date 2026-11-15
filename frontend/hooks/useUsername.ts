import { useState, useEffect } from "react";
import { getStoredItem, removeStoredItem, setStoredItem, STORAGE_KEYS } from "../utils/storage";

export const MAX_USERNAME_LENGTH = 16;

export function useUsername() {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getStoredItem(STORAGE_KEYS.username)
      .then((saved) => {
        if (saved) setUsername(saved.slice(0, MAX_USERNAME_LENGTH));
      })
      .catch((error) => console.error("Error loading username:", error))
      .finally(() => setIsLoading(false));
  }, []);

  const saveUsername = async (value: string) => {
    const next = value.slice(0, MAX_USERNAME_LENGTH);
    setUsername(next);
    try {
      if (next.trim()) {
        await setStoredItem(STORAGE_KEYS.username, next.trim());
      } else {
        await removeStoredItem(STORAGE_KEYS.username);
      }
    } catch (error) {
      console.error("Error saving username:", error);
    }
  };

  return {
    username,
    setUsername: saveUsername,
    isLoading,
  };
}
