/** Format a cents amount as USD currency. */
export function fmtUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return (
    sign +
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(abs / 100)
  );
}

/** Convert dollars to integer cents, rounding half-up. */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Start-of-week Friday (pay-period end) for a given date. */
export function nextFriday(from: Date = new Date()): string {
  const d = new Date(from);
  const dow = d.getDay(); // 0 Sun..6 Sat
  const delta = (5 - dow + 7) % 7 || 7; // always move to the NEXT Friday
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
