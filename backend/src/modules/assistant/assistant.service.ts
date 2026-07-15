import { env } from "../../config/env";

interface ChatEntry {
  name: string;
  text: string;
}

const MAX_BUFFER_ENTRIES = 50;
const buffers = new Map<string, ChatEntry[]>();

export function appendToBuffer(meetingCode: string, entry: ChatEntry): void {
  const buffer = buffers.get(meetingCode) ?? [];
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER_ENTRIES) {
    buffer.shift();
  }
  buffers.set(meetingCode, buffer);
}

export function clearBuffer(meetingCode: string): void {
  buffers.delete(meetingCode);
}

function formatContext(meetingCode: string): string {
  const buffer = buffers.get(meetingCode) ?? [];
  return buffer.map((entry) => `${entry.name}: ${entry.text}`).join("\n");
}

export async function streamAnswer(
  meetingCode: string,
  question: string,
  onDelta: (text: string) => void,
): Promise<string> {
  if (!env.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const context = formatContext(meetingCode);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      stream: true,
      system:
        "You are a live meeting assistant embedded in a video call's chat panel. Answer the " +
        "participant's question using only the in-call chat log given below as context. If the " +
        "chat log doesn't contain the answer, say so plainly instead of guessing.",
      messages: [
        {
          role: "user",
          content: `Chat log so far:\n${context || "(empty)"}\n\nQuestion: ${question}`,
        },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const events = buffered.split("\n\n");
    buffered = events.pop() ?? "";
    for (const evt of events) {
      const dataLine = evt.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      const payload = JSON.parse(dataLine.slice("data: ".length)) as {
        type: string;
        delta?: { type: string; text?: string };
      };
      if (payload.type === "content_block_delta" && payload.delta?.type === "text_delta" && payload.delta.text) {
        fullText += payload.delta.text;
        onDelta(payload.delta.text);
      }
    }
  }

  return fullText;
}
