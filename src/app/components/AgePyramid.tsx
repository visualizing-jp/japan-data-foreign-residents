/**
 * 年齢ピラミッド（男女背中合わせ）。
 */

import { scaleLinear } from "d3-scale";

const int = new Intl.NumberFormat("ja-JP");

export interface AgeBar {
  code: string;
  label: string;
  male: number | null;
  female: number | null;
}

export function AgePyramid({
  rows,
  width,
}: {
  rows: AgeBar[];
  width: number;
}) {
  const w = Math.max(width, 280);
  const rowH = 18;
  const midGap = 48;
  const labelW = 72;
  const chartW = w - labelW;
  const half = (chartW - midGap) / 2;
  const h = rows.length * rowH + 8;
  const maxV = Math.max(
    ...rows.flatMap((r) => [r.male ?? 0, r.female ?? 0]),
    1,
  );
  const x = scaleLinear().domain([0, maxV]).range([0, half]);

  return (
    <svg width={w} height={h} className="overflow-visible">
      {rows.map((r, i) => {
        const y = i * rowH;
        const mw = r.male === null ? 0 : x(r.male);
        const fw = r.female === null ? 0 : x(r.female);
        return (
          <g key={r.code} transform={`translate(0,${y})`}>
            <text
              x={labelW - 6}
              y={rowH / 2 + 1}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted text-[10px]"
            >
              {r.label}
            </text>
            <rect
              x={labelW + half - mw}
              y={3}
              width={mw}
              height={rowH - 6}
              className="fill-accent/80"
            />
            <rect
              x={labelW + half + midGap}
              y={3}
              width={fw}
              height={rowH - 6}
              className="fill-accent/45"
            />
          </g>
        );
      })}
      <text
        x={labelW + half / 2}
        y={h - 2}
        textAnchor="middle"
        className="fill-faint text-[10px]"
      >
        男
      </text>
      <text
        x={labelW + half + midGap + half / 2}
        y={h - 2}
        textAnchor="middle"
        className="fill-faint text-[10px]"
      >
        女
      </text>
      <title>{`最大 ${int.format(maxV)}人`}</title>
    </svg>
  );
}
