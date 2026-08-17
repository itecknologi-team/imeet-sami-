import type { ReactNode } from "react";

const URL_SPLIT = /(https?:\/\/[^\s]+)/g;

// Splits text around http(s) URLs and turns each one into a real clickable
// link — used anywhere chat/AI message text is rendered, since plain text
// never auto-links a pasted meeting URL on its own.
export function linkify(text: string): ReactNode[] {
  return text.split(URL_SPLIT).map((part, i) =>
    part.startsWith("http://") || part.startsWith("https://") ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-brand-blue underline underline-offset-2"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}
