/**
 * 時代ビュー。外国人住民の人口・増減率・比率の推移。
 */

import { use, useMemo, useState } from "react";
import { loadEra } from "../data/chunks.ts";
import { NOTES } from "../data/annotations.ts";
import { AreaList } from "../components/AreaList.tsx";
import { TrendStack, type Panel, type Point } from "../components/TrendStack.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { useWidth } from "../hooks/useWidth.ts";
import { useUrlState } from "../hooks/useUrlState.ts";

const int = new Intl.NumberFormat("ja-JP");
const pct = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function dense(years: number[], values: (number | null)[]): Point[] {
  return years.map((year, i) => ({ year, value: values[i] ?? null }));
}

export function EraView() {
  const { areas, sexes, years, cube } = use(loadEra());
  const yearNums = useMemo(() => years.map(Number), [years]);
  const [area, setArea] = useUrlState<string>("area", "00", (v) => areas.some((a) => a.code === v));
  const [sex, setSex] = useUrlState<string>("sex", "total", (v) => sexes.some((s) => s.code === v));
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();

  const current = areas.find((a) => a.code === area)!;

  const rows = useMemo(
    () =>
      areas.map((a) => ({
        area: a,
        values: cube.series("pop", "year", { area: a.code, sex }),
      })),
    [areas, cube, sex],
  );

  const panels = useMemo((): Panel[] => {
    const at = (measure: string) => cube.series(measure, "year", { area, sex });
    return [
      {
        key: "pop",
        title: "外国人住民人口",
        unit: "人",
        format: (v) => int.format(Math.round(v)),
        formatTick: (v) =>
          v >= 10_000 ? `${int.format(Math.round(v / 10_000))}万` : int.format(v),
        series: [
          {
            key: "pop",
            label: "",
            points: dense(yearNums, at("pop")),
            emphasized: true,
          },
        ],
      },
      {
        key: "growthRate",
        title: "増減率",
        unit: "前年比（総数）",
        format: (v) => `${pct.format(v)}%`,
        formatTick: (v) => `${pct.format(v)}%`,
        series: [
          {
            key: "growthRate",
            label: "",
            points: dense(yearNums, cube.series("growthRate", "year", { area, sex: "total" })),
            emphasized: true,
          },
        ],
      },
      {
        key: "share",
        title: "外国人比率",
        unit: "総人口に占める割合",
        format: (v) => `${pct.format(v * 100)}%`,
        formatTick: (v) => `${pct.format(v * 100)}%`,
        series: [
          {
            key: "share",
            label: "",
            points: dense(yearNums, at("share")),
            emphasized: true,
          },
        ],
      },
    ];
  }, [cube, area, sex, yearNums]);

  const latestPop = cube.at("pop", { area, sex, year: years.at(-1)! });
  const latestShare = cube.at("share", { area, sex, year: years.at(-1)! });

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col-reverse">
      <aside className="w-[288px] shrink-0 max-lg:w-full">
        <h2 className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-faint">
          地域
        </h2>
        <div className="max-h-[70vh] overflow-y-auto lg:max-h-[calc(100dvh-8rem)]">
          <AreaList rows={rows} years={yearNums} selected={area} onSelect={setArea} />
        </div>
        <p className="px-2 pt-3 text-[10.5px] leading-relaxed text-faint">
          折れ線は人口推移。高さは地域ごとに正規化してあるので、地域間の大小は比べられない。
        </p>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">{current.label}</h2>
            <p className="pt-1 text-[12px] text-muted">
              {years.at(-1)}年{" "}
              <span className="tnum font-medium text-ink">
                {latestPop === null ? "—" : int.format(latestPop)}人
              </span>
              {latestShare !== null && (
                <>
                  {" "}
                  （比率{" "}
                  <span className="tnum font-medium text-ink">
                    {pct.format(latestShare * 100)}%
                  </span>
                  ）
                </>
              )}
            </p>
          </div>
          <Segmented
            label="性別"
            value={sex}
            onChange={setSex}
            options={sexes.map((s) => ({ value: s.code, label: s.label }))}
          />
        </header>

        <div ref={ref}>
          {width > 0 && (
            <TrendStack
              panels={panels}
              width={width}
              domain={[yearNums[0]!, yearNums.at(-1)!]}
              hoverYear={hoverYear}
              onHoverYear={setHoverYear}
            />
          )}
        </div>

        <ul className="mt-4 space-y-1 text-[10.5px] leading-relaxed text-faint">
          {NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </main>
    </div>
  );
}
