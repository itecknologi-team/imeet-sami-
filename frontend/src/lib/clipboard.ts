// navigator.clipboard is only defined in secure contexts (HTTPS or localhost)
// — it's undefined on plain HTTP over a LAN IP. Fall back to the legacy
// execCommand("copy") path there so "copy invite link" still works.
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall through to the legacy fallback below
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

// Writes both a plain-text and an HTML representation of the same content in
// one clipboard write — whatever the paste target supports picks the richer
// one automatically (e.g. Gmail/Slack/Docs render the HTML card with the
// logo; a plain text field just gets the text version). Falls back to the
// plain-text-only path wherever ClipboardItem isn't available.
export async function copyRichToClipboard(text: string, html: string): Promise<void> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      const item = new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      });
      await navigator.clipboard.write([item]);
      return;
    } catch {
      // fall through to the plain-text-only path below
    }
  }
  await copyToClipboard(text);
}
