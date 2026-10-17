/** Tiny 24 h response-time area chart (server-rendered SVG). Gaps (no data) break the line. */
export function Sparkline({ points, label, className }: { points: Array<number | null>; label: string; className?: string }) {
  const W = 104;
  const H = 28;
  const values = points.filter((v): v is number => v !== null);
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * W;
  const y = (v: number) => H - 3 - ((v - min) / span) * (H - 8);

  // Split into continuous runs so missing hours show as gaps.
  const runs: Array<Array<[number, number]>> = [];
  let run: Array<[number, number]> = [];
  points.forEach((v, i) => {
    if (v === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push([x(i), y(v)]);
  });
  if (run.length) runs.push(run);

  const line = runs.map((r) => r.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join("")).join("");
  const area = runs
    .filter((r) => r.length > 1)
    .map((r) => `M${r[0][0].toFixed(1)} ${H}` + r.map(([px, py]) => `L${px.toFixed(1)} ${py.toFixed(1)}`).join("") + `L${r[r.length - 1][0].toFixed(1)} ${H}Z`)
    .join("");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} className={className} preserveAspectRatio="none">
      <title>{label}</title>
      <path d={area} fill="var(--primary)" opacity="0.12" />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
