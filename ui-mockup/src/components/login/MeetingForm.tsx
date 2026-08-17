import { useState } from "react";
import type { FormEvent } from "react";

type Mode = "new" | "join";

interface MeetingFormProps {
  onSubmit: () => void;
}

export function MeetingForm({ onSubmit }: MeetingFormProps) {
  const [mode, setMode] = useState<Mode>("new");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`focus-ring rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
            mode === "new" ? "bg-brand-blue text-white" : "border border-border bg-white text-text hover:bg-slate-50"
          }`}
        >
          New meeting
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`focus-ring rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
            mode === "join" ? "bg-brand-blue text-white" : "border border-border bg-white text-text hover:bg-slate-50"
          }`}
        >
          Join meeting
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-border bg-surface p-8 shadow-soft">
        {mode === "new" ? (
          <div className="mb-5">
            <label htmlFor="meeting-title" className="mb-1.5 block text-sm font-medium text-text">
              Meeting title
            </label>
            <input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="focus-ring w-full rounded-[10px] border border-border px-4 py-3 text-sm"
            />
          </div>
        ) : (
          <div className="mb-5">
            <label htmlFor="meeting-code" className="mb-1.5 block text-sm font-medium text-text">
              Meeting code
            </label>
            <input
              id="meeting-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="focus-ring w-full rounded-[10px] border border-border px-4 py-3 text-sm"
            />
          </div>
        )}

        <div className="mb-5">
          <label htmlFor="your-name" className="mb-1.5 block text-sm font-medium text-text">
            Your name
          </label>
          <input
            id="your-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="focus-ring w-full rounded-[10px] border border-border px-4 py-3 text-sm"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="passcode" className="mb-1.5 block text-sm font-medium text-text">
            Passcode (optional)
          </label>
          <input
            id="passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="At least 4 characters"
            className="focus-ring w-full rounded-[10px] border border-border px-4 py-3 text-sm placeholder:text-muted"
          />
        </div>

        <button
          type="submit"
          className="focus-ring w-full rounded-[10px] bg-brand-blue py-3 text-center text-sm font-bold text-white transition-colors hover:bg-brand-blue-dark"
        >
          {mode === "new" ? "Start meeting" : "Join meeting"}
        </button>
      </form>
    </div>
  );
}
