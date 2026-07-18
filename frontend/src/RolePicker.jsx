import { useState } from "react";

export const ROLE_PRESETS = [
  { name: "Default", prompt: null },
  {
    name: "Code reviewer",
    prompt:
      "You are a meticulous senior code reviewer. Point out bugs, security issues, and style problems directly, with specific line-level feedback. Suggest concrete fixes, not just descriptions of the problem.",
  },
  {
    name: "Patient teacher",
    prompt:
      "Explain things the way a patient, encouraging teacher would to a curious beginner. Use simple language and concrete analogies. Check understanding and invite follow-up questions rather than dumping everything at once.",
  },
  {
    name: "Concise expert",
    prompt:
      "Answer as a domain expert talking to another expert. Be maximally concise — short, precise, no hedging, no restating the question, no filler. Assume deep technical background.",
  },
  {
    name: "Creative writer",
    prompt:
      "You are an imaginative creative writing collaborator. Favor vivid, original language. Show, don't tell. Take creative risks rather than defaulting to the safest, most generic phrasing.",
  },
];

export default function RolePicker({ rolePrompt, onChange }) {
  const [open, setOpen] = useState(false);
  const [customText, setCustomText] = useState(
    ROLE_PRESETS.some((r) => r.prompt === rolePrompt) ? "" : rolePrompt || ""
  );
  const [showCustomInput, setShowCustomInput] = useState(false);

  const activePreset = ROLE_PRESETS.find((r) => r.prompt === rolePrompt);
  const label = activePreset ? activePreset.name : rolePrompt ? "Custom" : "Default";

  function pick(preset) {
    onChange(preset.prompt);
    setShowCustomInput(false);
    setOpen(false);
  }

  function saveCustom() {
    const text = customText.trim();
    onChange(text || null);
    setOpen(false);
  }

  return (
    <div className="role-picker">
      <button
        type="button"
        className="role-picker-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="role-picker-icon">🎭</span> {label}
      </button>

      {open && (
        <>
          <div className="role-picker-backdrop" onClick={() => setOpen(false)} />
          <div className="role-picker-menu">
            {!showCustomInput ? (
              <>
                {ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={`role-picker-option ${
                      preset.prompt === rolePrompt ? "active" : ""
                    }`}
                    onClick={() => pick(preset)}
                  >
                    {preset.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="role-picker-option"
                  onClick={() => setShowCustomInput(true)}
                >
                  Custom…
                </button>
              </>
            ) : (
              <div className="role-picker-custom">
                <textarea
                  autoFocus
                  rows={3}
                  placeholder="e.g. Act as a skeptical investor asking hard questions about this pitch."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                />
                <button
                  type="button"
                  className="send-btn role-picker-save"
                  onClick={saveCustom}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
