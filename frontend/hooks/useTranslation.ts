import { useMemo } from "react";
import i18n from "../utils/i18n";

export function useTranslation() {
  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>) => {
      let translation = i18n.t(key);
      
      // Replace parameters in translation
      if (params) {
        Object.keys(params).forEach((paramKey) => {
          translation = translation.replace(
            new RegExp(`\\{${paramKey}\\}`, "g"),
            String(params[paramKey])
          );
        });
      }
      
      return translation;
    },
    []
  );

  return { t };
}

