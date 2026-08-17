function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export function buildGoogleCalendarUrl(
  title: string,
  scheduledAtIso: string,
  durationMinutes: number,
  joinUrl: string,
): string {
  const start = new Date(scheduledAtIso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatUtc(start)}/${formatUtc(end)}`,
    details: `Join here: ${joinUrl}`,
    location: joinUrl,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsDataUrl(
  title: string,
  scheduledAtIso: string,
  durationMinutes: number,
  joinUrl: string,
): string {
  const start = new Date(scheduledAtIso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//imeet//meeting//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(`Join here: ${joinUrl}`)}`,
    `URL:${joinUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}
