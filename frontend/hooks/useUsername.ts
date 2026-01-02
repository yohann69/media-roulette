import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const USERNAME_KEY = "@photoroulette:username";

export function useUsername() {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUsername();
  }, []);

  const loadUsername = async () => {
    try {
      const saved = await AsyncStorage.getItem(USERNAME_KEY);
      if (saved) {
        setUsername(saved);
      }
    } catch (error) {
      console.error("Error loading username:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUsername = async (value: string) => {
    try {
      setUsername(value);
      if (value.trim()) {
        await AsyncStorage.setItem(USERNAME_KEY, value.trim());
      } else {
        await AsyncStorage.removeItem(USERNAME_KEY);
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


