import { useState } from "react";
import type { FormEvent } from "react";
import type { ChatMessage } from "../../hooks/useMeeting";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onAskAI: (question: string) => void;
}

export function ChatPanel({ messages, onSend, onAskAI }: ChatPanelProps) {
  const [text, setText] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  function handleAskAI() {
    if (!text.trim()) return;
    onAskAI(text.trim());
    setText("");
  }

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="mb-2 text-sm font-semibold text-gray-200">Chat</h2>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {messages.map((msg, i) =>
          msg.isAI ? (
            <div key={i} className="rounded bg-gray-800/80 p-2 text-sm text-gray-200">
              <span className="font-medium text-purple-400">AI Assistant: </span>
              {msg.text || (msg.streaming ? "…thinking" : "")}
            </div>
          ) : (
            <div key={i} className="text-sm text-gray-300">
              <span className="font-medium text-gray-100">{msg.name}: </span>
              {msg.text}
            </div>
          ),
        )}
      </div>
      <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
        />
        <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white">
          Send
        </button>
        <button
          type="button"
          onClick={handleAskAI}
          className="rounded bg-purple-600 px-3 py-1 text-sm font-medium text-white"
        >
          Ask AI
        </button>
      </form>
    </div>
  );
}
