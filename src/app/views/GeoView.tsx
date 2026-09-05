/**
 * 地域ビュー。県タイル地図 + 市区町村ランキング。
 */

import { use, useMemo, useState } from "react";
import { loadGeo } from "../data/chunks.ts";
import { CityRanking } from "../components/CityRanking.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { TileMap, type Metric, type Tile } from "../components/TileMap.tsx";
import { useUrlState } from "../hooks/useUrlState.ts";

const int = new Intl.NumberFormat("ja-JP");
const pct = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const METRICS: { value: Metric; label: string }[] = [
  { value: "pop", label: "人口" },
  { value: "share", label: "比率" },
  { value: "growthRate", label: "増減率" },
];

export function GeoView() {
  const { year, areas, cities, sexes, prefs, citiesCube } = use(loadGeo());
  const [sex, setSex] = useUrlState<string>("sex", "total", (v) => sexes.some((s) => s.code === v));
  const [metric, setMetric] = useUrlState<Metric>("metric", "pop", (v) =>
    METRICS.some((m) => m.value === v),
  );
  const [pinned, setPinned] = useUrlState<string>("pref", "", (v) =>
    v === "" || areas.some((a) => a.code === v && a.code !== "00"),
  );
  const [city, setCity] = useUrlState<string>("city", "", (v) =>
    v === "" || cities.some((c) => c.code === v),
  );
  const [hovered, setHovered] = useState<string | null>(null);

  const prefectures = useMemo(() => areas.filter((a) => a.code !== "00"), [areas]);

  const tiles: Tile[] = useMemo(
    () =>
      prefectures.map((a) => ({
        code: a.code,
        label: a.label,
        value: prefs.at(metric, { area: a.code, sex }),
      })),
    [prefectures, prefs, metric, sex],
  );

  const activePref = pinned || hovered;
  const activeLabel = activePref
    ? (prefectures.find((a) => a.code === activePref)?.label ?? "")
    : "全国";

  const national = {
    pop: prefs.at("pop", { area: "00", sex }),
    share: prefs.at("share", { area: "00", sex }),
    growthRate: prefs.at("growthRate", { area: "00", sex: "total" }),
  };

  const focusStats = activePref
    ? {
        pop: prefs.at("pop", { area: activePref, sex }),
        share: prefs.at("share", { area: activePref, sex }),
        growthRate: prefs.at("growthRate", { area: activePref, sex: "total" }),
        inDomestic: prefs.at("inDomestic", { area: activePref, sex: "total" }),
        inForeign: prefs.at("inForeign", { area: activePref, sex: "total" }),
        outDomestic: prefs.at("outDomestic", { area: activePref, sex: "total" }),
        outForeign: prefs.at("outForeign", { area: activePref, sex: "total" }),
        naturalGrowth: prefs.at("naturalGrowth", { area: activePref, sex: "total" }),
        socialGrowth: prefs.at("socialGrowth", { area: activePref, sex: "total" }),
      }
    : {
        pop: national.pop,
        share: national.share,
        growthRate: national.growthRate,
        inDomestic: null as number | null,
        inForeign: null as number | null,
        outDomestic: null as number | null,
        outForeign: null as number | null,
        naturalGrowth: null as number | null,
        socialGrowth: null as number | null,
      };

  const cityRows = useMemo(() => {
    const list = activePref
      ? cities.filter((c) => c.pref === activePref)
      : cities;
    return list
      .map((c) => ({
        code: c.code,
        label: c.label,
        pop: citiesCube.at("pop", { area: c.code, sex }),
        share: citiesCube.at("share", { area: c.code, sex }),
        growthRate: citiesCube.at("growthRate", { area: c.code, sex: "total" }),
      }))
      .sort((a, b) => {
        const av =
          metric === "pop" ? (a.pop ?? -1) : metric === "share" ? (a.share ?? -1) : (a.growthRate ?? -999);
        const bv =
          metric === "pop" ? (b.pop ?? -1) : metric === "share" ? (b.share ?? -1) : (b.growthRate ?? -999);
        return bv - av;
      })
      .slice(0, 40);
  }, [cities, citiesCube, activePref, sex, metric]);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col-reverse">
      <aside className="w-[300px] shrink-0 max-lg:w-full lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
        <div className="flex flex-wrap gap-2 pb-3">
          <Segmented label="指標" value={metric} onChange={setMetric} options={METRICS} />
        </div>
        <div className="pb-3">
          <Segmented
            label="性別"
            value={sex}
            onChange={setSex}
            options={sexes.map((s) => ({ value: s.code, label: s.label }))}
          />
        </div>
        <h2 className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-faint">
          市区町村ランキング
          {activePref ? `（${activeLabel}）` : "（全国上位）"}
        </h2>
        <CityRanking
          rows={cityRows}
          metric={metric}
          selected={city || null}
          onSelect={(code) => setCity(code ?? "")}
        />
      </aside>

      <main className="min-w-0 flex-1">
        <header className="pb-4">
          <h2 className="text-[18px] font-semibold tracking-tight">
            {activeLabel}
            <span className="ml-2 text-[13px] font-normal text-muted">{year}年1月1日</span>
          </h2>
          <p className="pt-1 text-[12px] text-muted">
            人口{" "}
            <span className="tnum font-medium text-ink">
              {focusStats.pop === null ? "—" : int.format(focusStats.pop)}
            </span>
            {focusStats.share !== null && (
              <>
                {" "}
                ／ 比率{" "}
                <span className="tnum font-medium text-ink">
                  {pct.format(focusStats.share * 100)}%
                </span>
              </>
            )}
            {focusStats.growthRate !== null && (
              <>
                {" "}
                ／ 増減率{" "}
                <span className="tnum font-medium text-ink">
                  {pct.format(focusStats.growthRate)}%
                </span>
              </>
            )}
          </p>
          {activePref && (
            <p className="pt-1 text-[11px] text-faint">
              転入 国内 {fmt(focusStats.inDomestic)} / 国外 {fmt(focusStats.inForeign)}
              {"  ·  "}
              転出 国内 {fmt(focusStats.outDomestic)} / 国外 {fmt(focusStats.outForeign)}
              {"  ·  "}
              自然 {fmt(focusStats.naturalGrowth)} / 社会 {fmt(focusStats.socialGrowth)}
            </p>
          )}
        </header>

        <TileMap
          tiles={tiles}
          metric={metric}
          hovered={hovered}
          onHover={setHovered}
          pinned={pinned || null}
          onPin={(code) => setPinned(code ?? "")}
        />
        <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
          升を選ぶと県を固定する。左の一覧は選択中の県内（未選択時は全国上位）の市区町村。
        </p>
      </main>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return int.format(v);
}
