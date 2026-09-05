/**
 * 市区町村ランキング（横バー）。
 */

import { scaleLinear } from "d3-scale";

const int = new Intl.NumberFormat("ja-JP");
const pct = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export interface CityRow {
  code: string;
  label: string;
  pop: number | null;
  share: number | null;
  growthRate: number | null;
}

export function CityRanking({
  rows,
  metric,
  selected,
  onSelect,
}: {
  rows: CityRow[];
  metric: "pop" | "share" | "growthRate";
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const values = rows.map((r) => {
    if (metric === "pop") return r.pop ?? 0;
    if (metric === "share") return r.share ?? 0;
    return Math.abs(r.growthRate ?? 0);
  });
  const maxV = Math.max(...values, 0.0001);
  const x = scaleLinear().domain([0, maxV]).range([0, 100]);

  function fmt(r: CityRow): string {
    if (metric === "pop") return r.pop === null ? "—" : int.format(r.pop);
    if (metric === "share")
      return r.share === null ? "—" : `${pct.format(r.share * 100)}%`;
    return r.growthRate === null ? "—" : `${pct.format(r.growthRate)}%`;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {rows.map((r) => {
        const v =
          metric === "pop" ? (r.pop ?? 0) : metric === "share" ? (r.share ?? 0) : Math.abs(r.growthRate ?? 0);
        const isSelected = r.code === selected;
        return (
          <li key={r.code}>
            <button
              type="button"
              onClick={() => onSelect(isSelected ? null : r.code)}
              className={`grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-2 rounded px-2 py-1 text-left transition-colors duration-150 ${
                isSelected ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
              }`}
            >
              <span className="min-w-0">
                <span
                  className={`block truncate text-[12px] ${
                    isSelected ? "font-semibold text-ink" : "text-muted"
                  }`}
                >
                  {r.label}
                </span>
                <span className="mt-0.5 block h-[5px] overflow-hidden rounded-full bg-ink/[0.06]">
                  <span
                    className="block h-full rounded-full bg-accent/70"
                    style={{ width: `${x(v)}%` }}
                  />
                </span>
              </span>
              <span className="tnum shrink-0 text-[11px] text-ink">{fmt(r)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
