import { useEffect, useState } from "react";

const STORAGE_KEY = "groq-chat:concise";

export function useConcise() {
  const [concise, setConcise] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(concise));
    } catch {
      // storage unavailable — preference still applies for this session
    }
  }, [concise]);

  return { concise, toggleConcise: () => setConcise((c) => !c) };
}
