export interface DailyPoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface CorrelationResult {
  /** Pearson correlation coefficient, -1..1. */
  r: number;
  /** Number of days with data on both sides — the honesty check for the caller. */
  n: number;
}

/** Minimum overlapping days before a correlation is trustworthy enough to show. */
export const MIN_CORRELATION_SAMPLE = 5;

/**
 * Pearson correlation between two daily series, matched by date. Returns
 * null when there isn't enough overlap to say anything real — callers
 * should treat null as "no insight," not "prompt the user to keep logging."
 */
export function correlateByDate(a: DailyPoint[], b: DailyPoint[]): CorrelationResult | null {
  const bByDate = new Map(b.map((p) => [p.date, p.value]));
  const pairs: Array<[number, number]> = [];
  for (const pa of a) {
    const bv = bByDate.get(pa.date);
    if (bv !== undefined) pairs.push([pa.value, bv]);
  }

  const n = pairs.length;
  if (n < MIN_CORRELATION_SAMPLE) return null;

  const meanX = pairs.reduce((s, [x]) => s + x, 0) / n;
  const meanY = pairs.reduce((s, [, y]) => s + y, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) return null;
  return { r: num / Math.sqrt(denX * denY), n };
}
