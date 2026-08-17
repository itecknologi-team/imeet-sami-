import { Paperclip, SendHorizontal, Smile, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { privateMessages as initialPrivate, publicMessages as initialPublic } from "../../data/mockData";
import type { ChatMessage } from "../../data/mockData";
import { IconButton } from "../ui/IconButton";

type Tab = "public" | "private";

export function ChatPanel() {
  const [tab, setTab] = useState<Tab>("public");
  const [publicMessages, setPublicMessages] = useState<ChatMessage[]>(initialPublic);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>(initialPrivate);
  const [draft, setDraft] = useState("");

  const messages = tab === "public" ? publicMessages : privateMessages;

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      authorId: "alex",
      authorName: "Alex Rivera (You)",
      avatarSeed: 11,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: draft.trim(),
    };
    if (tab === "public") {
      setPublicMessages((prev) => [...prev, newMessage]);
    } else {
      setPrivateMessages((prev) => [...prev, newMessage]);
    }
    setDraft("");
  }

  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-border bg-surface shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text">Chats</h2>
        <IconButton icon={<MoreHorizontal className="h-4 w-4" />} label="Chat menu" size="sm" />
      </div>

      <div className="flex gap-1 px-4 pt-3">
        <button
          type="button"
          onClick={() => setTab("public")}
          className={`focus-ring rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
            tab === "public" ? "bg-brand-orange text-white" : "bg-slate-100 text-muted hover:bg-slate-200"
          }`}
        >
          Public
        </button>
        <button
          type="button"
          onClick={() => setTab("private")}
          className={`focus-ring rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
            tab === "private" ? "bg-brand-orange text-white" : "bg-slate-100 text-muted hover:bg-slate-200"
          }`}
        >
          Private
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-2.5">
            <img
              src={`https://i.pravatar.cc/150?img=${m.avatarSeed}`}
              alt=""
              className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-text">{m.authorName}</span>
                <span className="text-[11px] text-muted">{m.timestamp}</span>
              </div>
              <p className="mt-1 rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-text">{m.text}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border p-3">
        <IconButton icon={<Paperclip className="h-4 w-4" />} label="Attach file" size="sm" type="button" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="focus-ring min-w-0 flex-1 rounded-full border border-border px-4 py-2 text-sm"
        />
        <IconButton icon={<Smile className="h-4 w-4" />} label="Emoji" size="sm" type="button" />
        <IconButton icon={<SendHorizontal className="h-4 w-4" />} label="Send" size="sm" type="submit" variant="dark" active />
      </form>
    </div>
  );
}
