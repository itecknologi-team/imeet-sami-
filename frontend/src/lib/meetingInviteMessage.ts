import logoUrl from "../assets/itecknologi-logo.png";

export interface MeetingInviteInfo {
  title: string | null | undefined;
  hostName: string;
  link: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Builds both a plain-text and an HTML version of the invite so
// copyRichToClipboard can hand both to the OS clipboard at once — paste into
// a plain-text field (SMS, notepad) and you get the text version; paste into
// a rich-text field (email, Slack, Docs) and you get the branded card below,
// logo included.
export function buildInviteMessage({ title, hostName, link }: MeetingInviteInfo): { text: string; html: string } {
  const meetingTitle = title?.trim() || "Untitled Meeting";
  const logoAbsoluteUrl = `${window.location.origin}${logoUrl}`;

  const text = `You're invited to join a meeting on imeet 🎥

Meeting: ${meetingTitle}
Host: ${hostName}

Join here: ${link}

— Powered by iTecknologi-AI Lab`;

  const html = `
<div style="font-family: -apple-system, 'Segoe UI', Arial, sans-serif; max-width: 420px; border: 1px solid #e6ebf0; border-radius: 16px; overflow: hidden;">
  <div style="height: 6px; background: linear-gradient(90deg, #00a9ce, #0a5ca8, #00a19a);"></div>
  <div style="padding: 24px; background: #ffffff;">
    <img src="${logoAbsoluteUrl}" alt="iTecknologi" height="28" style="height: 28px; display: block; margin-bottom: 16px;" />
    <p style="margin: 0 0 6px; font-size: 13px; color: #6b7a85;">You're invited to join a meeting on <strong style="color: #0a5ca8;">imeet</strong></p>
    <h2 style="margin: 0 0 4px; font-size: 19px; color: #1e2a32;">${escapeHtml(meetingTitle)}</h2>
    <p style="margin: 0 0 20px; font-size: 13px; color: #6b7a85;">Hosted by ${escapeHtml(hostName)}</p>
    <a href="${link}" style="display: inline-block; background: #0a5ca8; color: #ffffff; padding: 11px 22px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 14px;">Join Meeting</a>
    <p style="margin: 18px 0 0; font-size: 11px; word-break: break-all;"><a href="${link}" style="color: #0a5ca8;">${link}</a></p>
  </div>
</div>`.trim();

  return { text, html };
}
