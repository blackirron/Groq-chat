/**
 * Streams a chat completion from our backend's /api/chat SSE endpoint.
 * Calls onToken(text) for each chunk as it arrives, onDone(totalMs)
 * when the stream finishes, onError(message) if anything goes wrong.
 */
export async function streamChat(
  messages,
  { onToken, onDone, onError, rolePrompt = null, responseLanguage = null, concise = false }
) {
  const started = performance.now();
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        role_prompt: rolePrompt,
        response_language: responseLanguage,
        concise,
      }),
    });

    if (!res.ok || !res.body) {
      onError(`Request failed (${res.status})`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line
      const events = buffer.split("\n\n");
      buffer = events.pop(); // keep the last (possibly incomplete) chunk

      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data: ")) continue;
        const data = line.slice("data: ".length);

        if (data === "[DONE]") {
          onDone(Math.round(performance.now() - started));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            onError(parsed.error);
            return;
          }
          if (parsed.content) onToken(parsed.content);
        } catch {
          // ignore malformed chunk, keep streaming
        }
      }
    }

    onDone(Math.round(performance.now() - started));
  } catch (e) {
    onError(e.message || "Network error");
  }
}
