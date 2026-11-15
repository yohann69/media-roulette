import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";
import en from "../translations/en.json";
import fr from "../translations/fr.json";
import es from "../translations/es.json";
import it from "../translations/it.json";
import cn from "../translations/cn.json";
import pt from "../translations/pt.json";
import de from "../translations/de.json";
import ru from "../translations/ru.json";
import zh from "../translations/zh.json";

/**
 * Picks the app language from the device's preferred languages.
 * Chinese: Traditional (Hant, or Taiwan/Hong Kong/Macau) -> "zh", Simplified -> "cn".
 */
function detectLocale(): string {
  const supported = new Set(["en", "fr", "es", "it", "pt", "de", "ru"]);
  try {
    for (const locale of getLocales()) {
      const language = locale.languageCode?.toLowerCase();
      if (!language) continue;
      if (language === "zh") {
        const traditional =
          locale.languageScriptCode === "Hant" || ["TW", "HK", "MO"].includes(locale.regionCode ?? "");
        return traditional ? "zh" : "cn";
      }
      if (supported.has(language)) return language;
    }
  } catch {
    // Fall back to English
  }
  return "en";
}

const locale = detectLocale();

const i18n = new I18n({
  en,
  fr,
  es,
  it,
  cn,
  pt,
  de,
  ru,
  zh,
});

// Set the locale
i18n.locale = locale;

// When a value is missing from a language it will fall back to English
i18n.enableFallback = true;
i18n.defaultLocale = "en";

export default i18n;
