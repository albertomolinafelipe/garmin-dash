// Small formatting helpers shared across pages.

export function fmtDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}h ${m}m`
    : m > 0
      ? `${m}m ${s}s`
      : `${s}s`;
}

export function fmtDistance(meters: number | null): string {
  if (!meters) return "—";
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${Math.round(meters)} m`;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function fmtPace(speedMps: number | null): string {
  if (!speedMps || speedMps <= 0) return "—";
  const secPerKm = 1000 / speedMps;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}
