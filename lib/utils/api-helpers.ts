/**
 * Makes a POST request with JSON payload and timeout handling
 */
export const postJson = async <T,>(
  url: string,
  payload: unknown,
  timeoutMs: number = 60_000
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await res.text();
    if (!res.ok) {
      const message = (() => {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          return parsed.error || parsed.message;
        } catch {
          return null;
        }
      })();
      throw new Error(message || "Request failed.");
    }

    return (text ? (JSON.parse(text) as T) : ({} as T));
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
