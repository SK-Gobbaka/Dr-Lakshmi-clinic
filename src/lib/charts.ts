// Small dependency-free SVG chart builders, used for the downloadable statistics.
// Output is a complete, standalone .svg file that opens in any browser or image viewer.

export interface Row {
  label: string;
  value: number;
  color?: string;
}
export interface Line {
  name: string;
  color: string;
  values: number[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONT = 'font-family="Arial, Helvetica, sans-serif"';
const W = 720;
const H = 420;

function frame(title: string, subtitle: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="24" y="34" ${FONT} font-size="20" font-weight="700" fill="#17222B">${esc(title)}</text>
<text x="24" y="56" ${FONT} font-size="12" fill="#4A5961">${esc(subtitle)}</text>
${body}
</svg>`;
}

const PALETTE = ["#1F7A63", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#64748b"];

export function barChart(title: string, subtitle: string, rows: Row[]): string {
  const top = 84;
  const bottom = H - 70;
  const left = 48;
  const right = W - 24;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const slot = (right - left) / Math.max(1, rows.length);
  const bw = Math.min(64, slot * 0.6);
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = bottom - f * (bottom - top);
      return `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="#e5e7eb"/><text x="${left - 8}" y="${y + 4}" ${FONT} font-size="11" fill="#6b7280" text-anchor="end">${Math.round(max * f)}</text>`;
    })
    .join("");
  const bars = rows
    .map((r, i) => {
      const h = (r.value / max) * (bottom - top);
      const x = left + i * slot + (slot - bw) / 2;
      const color = r.color ?? PALETTE[i % PALETTE.length];
      return `<rect x="${x}" y="${bottom - h}" width="${bw}" height="${h}" rx="4" fill="${color}"/>
<text x="${x + bw / 2}" y="${bottom - h - 6}" ${FONT} font-size="12" font-weight="700" fill="#17222B" text-anchor="middle">${r.value}</text>
<text x="${x + bw / 2}" y="${bottom + 18}" ${FONT} font-size="11" fill="#374151" text-anchor="middle">${esc(r.label)}</text>`;
    })
    .join("");
  return frame(title, subtitle, grid + bars);
}

export function pieChart(title: string, subtitle: string, rows: Row[]): string {
  const total = rows.reduce((n, r) => n + r.value, 0);
  const cx = 190;
  const cy = 240;
  const R = 130;
  if (total === 0) return frame(title, subtitle, `<text x="${W / 2}" y="${H / 2}" ${FONT} font-size="14" fill="#6b7280" text-anchor="middle">No data in this range</text>`);
  let angle = -Math.PI / 2;
  const slices = rows
    .filter((r) => r.value > 0)
    .map((r, i) => {
      const color = r.color ?? PALETTE[i % PALETTE.length];
      const a = (r.value / total) * Math.PI * 2;
      if (r.value === total) return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${color}"/>`;
      const x1 = cx + R * Math.cos(angle);
      const y1 = cy + R * Math.sin(angle);
      angle += a;
      const x2 = cx + R * Math.cos(angle);
      const y2 = cy + R * Math.sin(angle);
      return `<path d="M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}" stroke="#fff" stroke-width="2"/>`;
    })
    .join("");
  const legend = rows
    .map((r, i) => {
      const color = r.color ?? PALETTE[i % PALETTE.length];
      const y = 150 + i * 34;
      return `<rect x="400" y="${y - 12}" width="16" height="16" rx="3" fill="${color}"/><text x="426" y="${y + 1}" ${FONT} font-size="14" fill="#17222B">${esc(r.label)}: <tspan font-weight="700">${r.value}</tspan> (${Math.round((r.value / total) * 100)}%)</text>`;
    })
    .join("");
  return frame(title, subtitle, slices + legend);
}

export function lineChart(title: string, subtitle: string, labels: string[], lines: Line[]): string {
  const top = 96;
  const bottom = H - 70;
  const left = 48;
  const right = W - 24;
  const max = Math.max(1, ...lines.flatMap((l) => l.values));
  const x = (i: number) => left + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (right - left));
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const gy = bottom - f * (bottom - top);
      return `<line x1="${left}" x2="${right}" y1="${gy}" y2="${gy}" stroke="#e5e7eb"/><text x="${left - 8}" y="${gy + 4}" ${FONT} font-size="11" fill="#6b7280" text-anchor="end">${Math.round(max * f)}</text>`;
    })
    .join("");
  const ticks = labels
    .map((l, i) => (i % Math.ceil(labels.length / 7) === 0 ? `<text x="${x(i)}" y="${bottom + 18}" ${FONT} font-size="10" fill="#374151" text-anchor="middle">${esc(l)}</text>` : ""))
    .join("");
  const paths = lines
    .map((l) => {
      const pts = l.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      const dots = l.values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="${l.color}"/>`).join("");
      return `<polyline points="${pts}" fill="none" stroke="${l.color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}`;
    })
    .join("");
  const legend = lines
    .map((l, i) => `<rect x="${24 + i * 150}" y="68" width="14" height="14" rx="3" fill="${l.color}"/><text x="${44 + i * 150}" y="80" ${FONT} font-size="13" fill="#17222B">${esc(l.name)}</text>`)
    .join("");
  return frame(title, subtitle, legend + grid + paths + ticks);
}
