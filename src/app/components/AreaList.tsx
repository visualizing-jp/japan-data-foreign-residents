/**
 * 地域一覧。スパークラインは人口推移（行ごとに正規化）。
 */

import { line } from "d3-shape";
import { scaleLinear } from "d3-scale";
import type { DictEntry } from "../data/cube.ts";

const W = 68;
const H = 20;

export interface AreaRow {
  area: DictEntry;
  values: (number | null)[];
}

export function AreaList({
  rows,
  years,
  selected,
  onSelect,
}: {
  rows: AreaRow[];
  years: number[];
  selected: string;
  onSelect: (code: string) => void;
}) {
  const x = scaleLinear()
    .domain([years[0]!, years.at(-1)!])
    .range([1, W - 1]);

  return (
    <ul className="flex flex-col">
      {rows.map(({ area, values }) => {
        const max = Math.max(...values.map((v) => v ?? 0), 0);
        const y = scaleLinear().domain([0, max || 1]).range([H - 2, 2]);
        const path = line<number | null>()
          .defined((v) => v !== null)
          .x((_, i) => x(years[i]!))
          .y((v) => y(v!));
        const isSelected = area.code === selected;

        return (
          <li key={area.code}>
            <button
              type="button"
              onClick={() => onSelect(area.code)}
              aria-pressed={isSelected}
              className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left transition-colors duration-150 ${
                isSelected ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
              }`}
            >
              <span
                className={`flex-1 truncate text-[12px] leading-tight ${
                  isSelected ? "font-semibold text-ink" : "text-muted"
                }`}
                title={area.label}
              >
                {area.label}
              </span>
              <svg width={W} height={H} className="shrink-0" aria-hidden>
                <path
                  d={path(values) ?? undefined}
                  fill="none"
                  className={isSelected ? "stroke-accent" : "stroke-faint"}
                  strokeWidth={isSelected ? 1.5 : 1}
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
