import { useState } from "react";
import { LANGUAGES } from "./i18n.js";

export default function LanguagePicker({ languageCode, onChange }) {
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === languageCode) || LANGUAGES[0];

  return (
    <div className="lang-picker">
      <button
        type="button"
        className="lang-picker-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose language"
      >
        <span>{current.flag}</span>
      </button>

      {open && (
        <>
          <div className="lang-picker-backdrop" onClick={() => setOpen(false)} />
          <div className="lang-picker-menu">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`lang-picker-option ${
                  lang.code === languageCode ? "active" : ""
                }`}
                onClick={() => {
                  onChange(lang.code);
                  setOpen(false);
                }}
              >
                <span className="lang-picker-flag">{lang.flag}</span>
                {lang.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
