export function buildPublicSessionUrl(clubSlug: string, sessionSlug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/club/${clubSlug}/session/${sessionSlug}`;
}

export function buildPublicClubUrl(clubSlug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/club/${clubSlug}`;
}

/** Parses "HH:mm" strings and returns the difference in minutes, or null if either is missing/invalid. */
export function diffMinutes(startTime?: string | null, endTime?: string | null): number | null {
  if (!startTime || !endTime) return null;
  const toMinutes = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null) return null;
  const diff = end - start;
  return diff >= 0 ? diff : diff + 24 * 60;
}
