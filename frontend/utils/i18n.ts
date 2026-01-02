import { I18n } from "i18n-js";
import en from "../translations/en.json";
import fr from "../translations/fr.json";
import es from "../translations/es.json";
import it from "../translations/it.json";
import cn from "../translations/cn.json";
import pt from "../translations/pt.json";
import de from "../translations/de.json";
import ru from "../translations/ru.json";
import zh from "../translations/zh.json";

// Try to import expo-localization, but handle gracefully if not available (e.g., in Expo Go)
let locale = "en";

try {
  const Localization = require("expo-localization");
  locale = Localization.locale || "en";
  
  // Extract language code (e.g., "en-US" -> "en")
  if (locale.includes("-")) {
    locale = locale.split("-")[0];
  }
  
  // Map locale codes to our supported languages
  const localeMap: Record<string, string> = {
    en: "en",
    fr: "fr",
    es: "es",
    it: "it",
    "zh-CN": "cn",
    "zh-Hans": "cn",
    "zh": "cn",
    "zh-TW": "zh",
    "zh-Hant": "zh",
    pt: "pt",
    de: "de",
    ru: "ru",
  };
  
  locale = localeMap[locale] || localeMap[Localization.locale] || "en";
} catch (e) {
  // expo-localization not available, use default
  console.log("expo-localization not available, using default locale: en");
  locale = "en";
}

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
