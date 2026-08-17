import { Lock, SendHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ChatMessage, MeetingParticipantInfo } from "../../hooks/useMeeting";
import { linkify } from "../../lib/linkify";
import { InitialsAvatar } from "./InitialsAvatar";

interface ChatPanelProps {
  messages: ChatMessage[];
  participants: MeetingParticipantInfo[];
  currentUserId?: string;
  onSend: (text: string) => void;
  onSendPrivate: (targetUserId: string, text: string) => void;
  onAskAI: (question: string) => void;
  canSend?: boolean;
}

export function ChatPanel({
  messages,
  participants,
  currentUserId,
  onSend,
  onSendPrivate,
  onAskAI,
  canSend = true,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState("");
  const seenCountRef = useRef<Record<string, number>>({});

  const otherParticipants = participants.filter((p) => p.userId !== currentUserId);

  function threadWith(userId: string) {
    return messages.filter(
      (m) =>
        m.isPrivate &&
        ((m.userId === currentUserId && m.toUserId === userId) || (m.userId === userId && m.toUserId === currentUserId)),
    );
  }

  const visibleMessages = recipient ? threadWith(recipient) : messages.filter((m) => !m.isPrivate);

  // Keep the open thread's "seen" count fresh so switching away and back
  // doesn't falsely flag already-read messages as unread.
  useEffect(() => {
    if (recipient) {
      seenCountRef.current[recipient] = threadWith(recipient).length;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipient, messages]);

  function hasUnread(userId: string): boolean {
    if (userId === recipient) return false;
    return threadWith(userId).length > (seenCountRef.current[userId] ?? 0);
  }

  function selectRecipient(userId: string) {
    setRecipient(userId);
    seenCountRef.current[userId] = threadWith(userId).length;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (recipient) {
      onSendPrivate(recipient, text.trim());
    } else {
      onSend(text.trim());
    }
    setText("");
  }

  function handleAskAI() {
    if (!text.trim() || recipient) return;
    onAskAI(text.trim());
    setText("");
  }

  const recipientName = otherParticipants.find((p) => p.userId === recipient)?.name;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-brand-border bg-brand-surface shadow-soft">
      <div className="rounded-t-2xl bg-brand-blue px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Chat</h2>
      </div>

      {otherParticipants.length > 0 && (
        <div className="flex items-center gap-2 border-b border-brand-border px-3 py-2">
          <select
            value={recipient}
            onChange={(e) => selectRecipient(e.target.value)}
            aria-label="Chat with"
            className="min-w-0 flex-1 rounded-full border border-brand-border bg-white px-3 py-1.5 text-xs font-medium text-brand-text"
          >
            <option value="">Everyone</option>
            {otherParticipants.map((p) => (
              <option key={p.userId} value={p.userId}>
                {hasUnread(p.userId) ? `● ${p.name}` : p.name}
              </option>
            ))}
          </select>
          {recipient && (
            <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-brand-orange/10 px-2 py-1 text-[11px] font-medium text-brand-orange">
              <Lock className="h-3 w-3" /> Private
            </span>
          )}
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {visibleMessages.length === 0 && recipient && (
          <p className="pt-6 text-center text-sm text-brand-muted">
            Private messages with {recipientName} will show up here.
          </p>
        )}
        {visibleMessages.map((msg, i) =>
          msg.isAI ? (
            <div key={i} className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-teal text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-brand-text">AI Assistant</span>
                <p className="mt-1 rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-brand-text">
                  {msg.text ? linkify(msg.text) : msg.streaming ? "…thinking" : ""}
                </p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5">
              <InitialsAvatar name={msg.name} size="sm" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-brand-text">
                  {msg.name}
                  {msg.isPrivate && <span className="ml-1.5 text-[11px] font-normal text-brand-orange">private</span>}
                </span>
                <p className="mt-1 rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-brand-text">
                  {linkify(msg.text)}
                </p>
              </div>
            </div>
          ),
        )}
      </div>

      {canSend ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-brand-border p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={recipient ? `Message ${recipientName ?? ""} privately...` : "Type a message..."}
            className="min-w-0 flex-1 rounded-full border border-brand-border px-4 py-2 text-sm placeholder:text-brand-muted"
          />
          {!recipient && (
            <button
              type="button"
              onClick={handleAskAI}
              aria-label="Ask AI assistant"
              title="Ask AI"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-brand-border text-brand-teal hover:bg-slate-50"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Send message"
            title="Send"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-blue text-white hover:bg-brand-blue-dark"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <p className="flex items-center gap-1.5 border-t border-brand-border p-3 text-xs text-brand-muted">
          <Lock className="h-3.5 w-3.5 flex-shrink-0" /> The host has disabled chat for participants.
        </p>
      )}
    </div>
  );
}
