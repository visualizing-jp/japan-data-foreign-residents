/**
 * 都道府県タイル地図。指標は人口・比率・増減率など。
 */

import { scaleLinear } from "d3-scale";
import { max } from "d3-array";

const LAYOUT = [
  "........................01",
  "........................02",
  "......................0503",
  "......................0604",
  "....................1507..",
  "..............171620100908",
  "..............1821..111312",
  "....3231..2625..23221914..",
  "..35343328272924..........",
  "404438373630..............",
  "4143..39..................",
  "424645....................",
  "..........................",
  "47........................",
];

const COLS = 13;
const BELOW = "#8fb4cc";
const MIDDLE = "#ffffff";
const ABOVE = "#dd9583";
const SEQUENTIAL = ["#f7f5f1", "#e8d3ce", "#c96b5a", "#8f2a1f"];

export type Metric = "pop" | "share" | "growthRate";

export interface Tile {
  code: string;
  label: string;
  value: number | null;
}

function short(label: string): string {
  return label.replace(/[都府県]$/, "");
}

const whole = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatValue(metric: Metric, v: number): string {
  if (metric === "pop") {
    if (v >= 10_000) return `${whole.format(Math.round(v / 10_000))}万`;
    return whole.format(v);
  }
  if (metric === "share") return `${pct1.format(v * 100)}%`;
  return `${pct1.format(v)}%`;
}

export function TileMap({
  tiles,
  metric,
  hovered,
  onHover,
  pinned,
  onPin,
}: {
  tiles: Tile[];
  metric: Metric;
  hovered: string | null;
  onHover: (code: string | null) => void;
  pinned: string | null;
  onPin: (code: string | null) => void;
}) {
  const byPrefix = new Map(tiles.map((t) => [t.code.slice(0, 2), t]));
  const values = tiles.map((t) => t.value).filter((v): v is number => v !== null);

  const diverge = metric === "growthRate";
  const colorDiverge = scaleLinear<string>()
    .domain([-10, 0, 10])
    .range([BELOW, MIDDLE, ABOVE])
    .clamp(true);
  const vmax = max(values) ?? 1;
  const colorSeq = scaleLinear<string>()
    .domain([0, (vmax || 1) * 0.33, (vmax || 1) * 0.66, vmax || 1])
    .range(SEQUENTIAL)
    .clamp(true);

  function fill(v: number | null): string {
    if (v === null) return "var(--color-paper)";
    if (diverge) return colorDiverge(v);
    return colorSeq(v);
  }

  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <div
        className="grid aspect-[13/14] max-w-[700px] min-w-[560px] gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${LAYOUT.length}, minmax(0, 1fr))`,
        }}
        onMouseLeave={() => onHover(null)}
      >
        <div
          className="flex flex-col justify-start pt-1"
          style={{ gridColumn: "1 / 8", gridRow: "1 / 6" }}
        >
          <Legend metric={metric} vmax={vmax} diverge={diverge} />
        </div>
        {LAYOUT.flatMap((row, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const prefix = row.slice(c * 2, c * 2 + 2);
            const tile = prefix === ".." ? undefined : byPrefix.get(prefix);
            if (tile === undefined) return null;
            const isPinned = tile.code === pinned;
            return (
              <button
                type="button"
                key={tile.code}
                aria-pressed={isPinned}
                onClick={() => onPin(isPinned ? null : tile.code)}
                onMouseEnter={() => onHover(tile.code)}
                onFocus={() => onHover(tile.code)}
                onBlur={() => onHover(null)}
                title={`${tile.label} ${tile.value === null ? "—" : formatValue(metric, tile.value)}`}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-[3px] border transition-[box-shadow,transform] duration-150 ease-out active:scale-[0.97] ${
                  isPinned
                    ? "border-ink shadow-[0_0_0_1.5px_var(--color-ink)]"
                    : tile.code === hovered
                      ? "border-ink"
                      : "border-rule"
                }`}
                style={{
                  gridColumn: c + 1,
                  gridRow: r + 1,
                  backgroundColor: fill(tile.value),
                }}
              >
                <span className="text-[9.5px] leading-tight text-ink/70">
                  {short(tile.label)}
                </span>
                <span className="tnum text-[11px] leading-tight font-medium">
                  {tile.value === null ? "—" : formatValue(metric, tile.value)}
                </span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function Legend({
  metric,
  vmax,
  diverge,
}: {
  metric: Metric;
  vmax: number;
  diverge: boolean;
}) {
  const label =
    metric === "pop" ? "外国人住民人口" : metric === "share" ? "外国人比率" : "増減率";
  return (
    <div className="text-[10.5px] leading-relaxed text-muted">
      <p className="pb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <span className="tnum">
          {diverge ? "−10%" : metric === "share" ? "0%" : "少"}
        </span>
        <span
          className="h-[7px] flex-1 rounded-full border border-rule"
          style={{
            background: diverge
              ? `linear-gradient(to right, ${BELOW}, ${MIDDLE}, ${ABOVE})`
              : `linear-gradient(to right, ${SEQUENTIAL.join(", ")})`,
          }}
        />
        <span className="tnum">
          {diverge
            ? "+10%"
            : metric === "share"
              ? `${pct1.format(vmax * 100)}%`
              : "多"}
        </span>
      </div>
    </div>
  );
}

if (import.meta.env.DEV) {
  const codes = LAYOUT.flatMap((row) => row.match(/../g) ?? []).filter((s) => s !== "..");
  if (new Set(codes).size !== 47) {
    throw new Error(`タイル配置の県が ${new Set(codes).size} 個しかない`);
  }
}
