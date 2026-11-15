import { useMemo } from "react";
import i18n from "../utils/i18n";

export function useTranslation() {
  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>) => {
      // Passing the count lets i18n-js pick the plural form ({ one, other } values).
      let translation = params?.count !== undefined ? i18n.t(key, { count: Number(params.count) }) : i18n.t(key);
      
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

