import { env } from "../../config/env";

const languagePreferences = new Map<string, Map<string, string>>();

export function setLanguage(meetingCode: string, userId: string, language: string): void {
  const meetingPrefs = languagePreferences.get(meetingCode) ?? new Map<string, string>();
  meetingPrefs.set(userId, language);
  languagePreferences.set(meetingCode, meetingPrefs);
}

export function getDistinctLanguages(meetingCode: string): string[] {
  const meetingPrefs = languagePreferences.get(meetingCode);
  if (!meetingPrefs || meetingPrefs.size === 0) {
    return ["en"];
  }
  return Array.from(new Set(meetingPrefs.values()));
}

export function clearMeeting(meetingCode: string): void {
  languagePreferences.delete(meetingCode);
}

export async function transcribeChunk(audioBuffer: Buffer): Promise<string> {
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: "audio/webm" }), "chunk.webm");
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.openaiApiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper API error: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { text: string };
  return data.text;
}

export async function translate(text: string, targetLanguages: string[]): Promise<Record<string, string>> {
  if (!env.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const languageList = targetLanguages.join(", ");
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
      messages: [
        {
          role: "user",
          content:
            `Translate the following text into each of these languages: ${languageList}. ` +
            "Respond with ONLY valid JSON, no markdown fences, mapping each language code to its translation: " +
            `{"en": "...", "es": "..."}\n\nText:\n${text}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { content: Array<{ text: string }> };
  return JSON.parse(data.content[0].text) as Record<string, string>;
}
