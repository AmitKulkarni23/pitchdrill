import type { Role } from "@/types/api";

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");

/** A one-event calendar file with the ticket link and a 15-minute reminder. */
export function buildIcs({ slotId, role, link, now = Date.now() }: { slotId: string; role: Role; link: string; now?: number }): string {
  const start = Date.parse(slotId);
  const title = `PitchDrill: ${role === "seller" ? "Seller" : "Buyer"} round`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PitchDrill//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${stamp(start)}-${role}-${link.split("/").pop()}@pitchdrill`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(start + 15 * 60_000)}`,
    `SUMMARY:${escape(title)}`,
    `DESCRIPTION:${escape(`Your ticket (keep it private): ${link}\nThe arena opens 5 minutes before the start.`)}`,
    `URL:${link}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(title)}`,
    "TRIGGER:-PT15M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadIcs(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
