const BASE = "/api/memory";

export async function fetchMemories() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error("Failed to load memory");
  const data = await res.json();
  return data.memories;
}

export async function addMemoryFact(text) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to add memory");
  return res.json();
}

export async function updateMemoryFact(id, text) {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to update memory");
  return res.json();
}

export async function deleteMemoryFact(id) {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete memory");
  return res.json();
}

export async function clearAllMemory() {
  const res = await fetch(BASE, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear memory");
  return res.json();
}

/**
 * Fire-and-forget: after a completed exchange, ask the backend to
 * pull out anything durable worth remembering. Errors are swallowed
 * on purpose — this is a background nicety, never something that
 * should interrupt or error out the actual conversation.
 */
export async function extractMemoryFromExchange(userMessage, assistantMessage) {
  try {
    const res = await fetch(`${BASE}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_message: userMessage,
        assistant_message: assistantMessage,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.added || [];
  } catch {
    return [];
  }
}
