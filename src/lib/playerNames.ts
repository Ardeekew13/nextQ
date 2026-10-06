/**
 * Name matching used to stop the same person being added twice. Pure and DB-free.
 *
 * Two levels: an exact match (same name once case, accents, punctuation and spacing are
 * ignored) is treated as a duplicate and blocked. A near match (one or two typos) is only a
 * "could this be the same person?" question for the organiser, because nicknames and
 * different people with similar names are real. Names that merely share a first word
 * ("DAVE" and "DAVE AMATONG") are deliberately NOT treated as similar.
 */

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSameName(a: string, b: string): boolean {
  const na = normalizeName(a);
  return na.length > 0 && na === normalizeName(b);
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

/** True for a near match that is not an exact match: spacing differences ("JOY ANN" vs
 * "JOYANN") or a small typo, with the allowed typos scaled to the name's length. */
export function isSimilarName(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb || na === nb) return false;
  if (na.replace(/ /g, "") === nb.replace(/ /g, "")) return true;
  const shortest = Math.min(na.length, nb.length);
  const allowed = shortest <= 3 ? 0 : shortest <= 6 ? 1 : 2;
  return allowed > 0 && editDistance(na, nb) <= allowed;
}
