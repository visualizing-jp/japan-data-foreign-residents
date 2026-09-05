/**
 * 年齢ビュー。年齢階級別の外国人住民人口。
 */

import { use, useMemo } from "react";
import { loadAge, loadAgeCity } from "../data/chunks.ts";
import { AgePyramid } from "../components/AgePyramid.tsx";
import { YearSelect } from "../components/YearSelect.tsx";
import { useWidth } from "../hooks/useWidth.ts";
import { useUrlState } from "../hooks/useUrlState.ts";

const int = new Intl.NumberFormat("ja-JP");

export function AgeView() {
  const pref = use(loadAge());
  const city = use(loadAgeCity());
  const [year, setYear] = useUrlState<string>("year", pref.years.at(-1)!, (v) =>
    pref.years.includes(v),
  );
  const [area, setArea] = useUrlState<string>("area", "00", (v) => {
    if (pref.areas.some((a) => a.code === v)) return true;
    return year === city.year && city.cities.some((c) => c.code === v);
  });

  const [ref, width] = useWidth<HTMLDivElement>();

  const isCity = area.length > 2;
  const areaLabel = isCity
    ? (city.cities.find((c) => c.code === area)?.label ?? area)
    : (pref.areas.find((a) => a.code === area)?.label ?? area);

  const rows = useMemo(() => {
    const ages = pref.ages;
    if (isCity && year === city.year) {
      return ages.map((a) => ({
        code: a.code,
        label: a.label,
        male: city.cube.at("pop", { area, sex: "male", age: a.code }),
        female: city.cube.at("pop", { area, sex: "female", age: a.code }),
      }));
    }
    return ages.map((a) => ({
      code: a.code,
      label: a.label,
      male: pref.cube.at("pop", { area: isCity ? "00" : area, sex: "male", year, age: a.code }),
      female: pref.cube.at("pop", {
        area: isCity ? "00" : area,
        sex: "female",
        year,
        age: a.code,
      }),
    }));
  }, [pref, city, area, year, isCity]);

  const total = useMemo(() => {
    if (isCity && year === city.year) {
      return pref.ages.reduce((s, a) => {
        const m = city.cube.at("pop", { area, sex: "male", age: a.code }) ?? 0;
        const f = city.cube.at("pop", { area, sex: "female", age: a.code }) ?? 0;
        return s + m + f;
      }, 0);
    }
    const code = isCity ? "00" : area;
    return pref.ages.reduce((s, a) => {
      const m = pref.cube.at("pop", { area: code, sex: "male", year, age: a.code }) ?? 0;
      const f = pref.cube.at("pop", { area: code, sex: "female", year, age: a.code }) ?? 0;
      return s + m + f;
    }, 0);
  }, [pref, city, area, year, isCity]);

  // 県セレクト用: 全国+47。市区町村は県を選んだあと別UIにしない（シンプルに県のみ）
  const areaOptions = pref.areas;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col">
      <aside className="w-[260px] shrink-0 max-lg:w-full">
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <YearSelect years={[...pref.years].reverse()} value={year} onChange={setYear} />
        </div>
        <h2 className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-faint">
          地域
        </h2>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-rule bg-surface lg:max-h-[calc(100dvh-10rem)]">
          <ul className="py-1">
            {areaOptions.map((a) => (
              <li key={a.code}>
                <button
                  type="button"
                  onClick={() => setArea(a.code)}
                  className={`w-full cursor-pointer px-3 py-1.5 text-left text-[12px] transition-colors duration-150 ${
                    area === a.code
                      ? "bg-ink/[0.06] font-semibold text-ink"
                      : "text-muted hover:bg-ink/[0.03] hover:text-ink"
                  }`}
                >
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {year === city.year && area.length === 2 && area !== "00" && (
          <CityPicker
            cities={city.cities}
            pref={area}
            selected={null}
            onSelect={setArea}
          />
        )}
        {year === city.year && isCity && (
          <CityPicker
            cities={city.cities}
            pref={city.cities.find((c) => c.code === area)?.pref ?? "13"}
            selected={area}
            onSelect={setArea}
          />
        )}
      </aside>

      <main className="min-w-0 flex-1">
        <header className="pb-4">
          <h2 className="text-[18px] font-semibold tracking-tight">
            {areaLabel}
            <span className="ml-2 text-[13px] font-normal text-muted">{year}年</span>
          </h2>
          <p className="pt-1 text-[12px] text-muted">
            年齢階級別人口（男女） 合計{" "}
            <span className="tnum font-medium text-ink">{int.format(total)}人</span>
          </p>
        </header>
        <div ref={ref} className="rounded-md border border-rule bg-surface px-3 py-4">
          {width > 0 && <AgePyramid rows={rows} width={width - 24} />}
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
          左が男性、右が女性。秘匿のため内訳合計と総数が一致しない場合がある。
        </p>
      </main>
    </div>
  );
}

function CityPicker({
  cities,
  pref,
  selected,
  onSelect,
}: {
  cities: { code: string; label: string; pref: string }[];
  pref: string;
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  const list = cities.filter((c) => c.pref === pref).slice(0, 80);
  if (list.length === 0) return null;
  return (
    <div className="pt-4">
      <h3 className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-faint">
        市区町村（最新年）
      </h3>
      <div className="max-h-[28vh] overflow-y-auto rounded-md border border-rule bg-surface">
        <ul className="py-1">
          {list.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => onSelect(c.code)}
                className={`w-full cursor-pointer px-3 py-1 text-left text-[11px] transition-colors duration-150 ${
                  selected === c.code
                    ? "bg-ink/[0.06] font-semibold text-ink"
                    : "text-muted hover:bg-ink/[0.03]"
                }`}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
