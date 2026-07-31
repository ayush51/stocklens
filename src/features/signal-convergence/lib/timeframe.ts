export type SignalWindow = 7 | 30 | 90;

export interface SignalDateRange {
  from: Date;
  to: Date;
}

/** Either a fixed lookback window (relative to real "now") or an explicit historical range. */
export type SignalTimeframe = SignalWindow | SignalDateRange;

export function isDateRange(t: SignalTimeframe): t is SignalDateRange {
  return typeof t !== "number";
}

function windowStart(window: SignalWindow, now: Date): Date {
  return new Date(now.getTime() - window * 24 * 60 * 60 * 1000);
}

/**
 * A custom range's `asOf` is its own `to` date, not real "now" — recency
 * decay and "how fresh is this evidence" only make sense relative to the
 * end of the window being evaluated. A fixed 7/30/90-day window is always
 * relative to real now, matching this app's pre-existing behavior.
 * `windowDays` is stored on SignalSnapshot for Phase 3 evaluation, so a
 * custom range gets its own real day-count rather than reusing a fixed
 * bucket it doesn't actually match.
 */
export function resolveTimeframe(
  timeframe: SignalTimeframe,
  now: Date,
): { since: Date; asOf: Date; windowDays: number } {
  if (!isDateRange(timeframe)) {
    return { since: windowStart(timeframe, now), asOf: now, windowDays: timeframe };
  }
  const windowDays = Math.max(
    1,
    Math.round((timeframe.to.getTime() - timeframe.from.getTime()) / (24 * 60 * 60 * 1000)),
  );
  return { since: timeframe.from, asOf: timeframe.to, windowDays };
}
