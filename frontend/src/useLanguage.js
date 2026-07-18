import { useEffect, useState } from "react";
import { LANGUAGES, getStrings } from "./i18n.js";

const STORAGE_KEY = "groq-chat:language";

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    // ignore, fall through to default
  }
  return "auto";
}

const RTL_LANGUAGES = new Set(["ar"]);

export function useLanguage() {
  const [languageCode, setLanguageCode] = useState(getInitialLanguage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, languageCode);
    } catch {
      // storage unavailable — selection still applies for this session
    }
    document.documentElement.dir = RTL_LANGUAGES.has(languageCode) ? "rtl" : "ltr";
  }, [languageCode]);

  const current = LANGUAGES.find((l) => l.code === languageCode) || LANGUAGES[0];
  // UI chrome always needs to render in something concrete, so "auto"
  // falls back to English strings — but promptName stays null, which
  // is what tells the backend not to force any particular reply language.
  const strings = getStrings(languageCode === "auto" ? "en" : languageCode);

  return {
    languageCode,
    setLanguageCode,
    currentLanguage: current,
    responseLanguage: current.promptName, // null for "auto"
    t: strings,
  };
}
