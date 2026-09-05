/**
 * Excel → public/data/*.json（Cube）。
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Cube, round } from "../src/lib/cube.ts";
import { AGE_BANDS, NATIONAL, PREFECTURES, SEXES } from "../src/lib/labels.ts";
import { listAvailableYears, readAge, readPop, type PopRow } from "../src/lib/parse.ts";

const OUT = resolve(import.meta.dirname, "../public/data");

function sexValue(row: PopRow, sex: string): number | null {
  if (sex === "male") return row.male;
  if (sex === "female") return row.female;
  return row.total;
}

function shareOf(foreign: number | null, total: number | null): number | null {
  if (foreign === null || total === null || total <= 0) return null;
  return foreign / total;
}

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const years = listAvailableYears();
  if (years.length === 0) throw new Error("data/raw に Excel がない。npm run fetch を先に実行。");
  const latest = years.at(-1)!;
  console.log("years", years.join(", "), "latest", latest);

  const prefAreas = [
    { code: NATIONAL.code, label: NATIONAL.label, level: 0 },
    ...PREFECTURES.map((p) => ({ code: p.code, label: p.label, level: 1 })),
  ];
  const areaCodes = prefAreas.map((a) => a.code);
  const sexCodes = SEXES.map((s) => s.code);

  // --- era: area × sex × year ---
  const era = new Cube(
    [
      { name: "area", codes: areaCodes },
      { name: "sex", codes: sexCodes },
      { name: "year", codes: years },
    ],
    ["pop", "households", "growth", "growthRate", "share"],
  );

  for (const year of years) {
    const foreign = readPop(year, "foreign_pref_pop");
    const total = readPop(year, "total_pref_pop");
    const totalByArea = new Map(total.map((r) => [r.area, r]));

    for (const row of foreign) {
      if (row.level === "city") continue;
      if (!areaCodes.includes(row.area)) continue;
      const tot = totalByArea.get(row.area);
      for (const sex of sexCodes) {
        const pop = sexValue(row, sex);
        const totPop = tot ? sexValue(tot, sex) : null;
        era.set("pop", [row.area, sex, year], pop);
        era.set("households", [row.area, sex, year], sex === "total" ? row.households : null);
        era.set("growth", [row.area, sex, year], sex === "total" ? row.growth : null);
        era.set(
          "growthRate",
          [row.area, sex, year],
          sex === "total" ? round(row.growthRate, 3) : null,
        );
        era.set("share", [row.area, sex, year], round(shareOf(pop, totPop), 6));
      }
    }
    console.log("era", year, "foreign rows", foreign.length);
  }

  // --- age: area × sex × year × age (prefs only) ---
  const age = new Cube(
    [
      { name: "area", codes: areaCodes },
      { name: "sex", codes: sexCodes },
      { name: "year", codes: years },
      { name: "age", codes: [...AGE_BANDS] },
    ],
    ["pop"],
  );

  for (const year of years) {
    const rows = readAge(year, "foreign_pref_age");
    for (const row of rows) {
      if (row.level === "city") continue;
      if (!areaCodes.includes(row.area)) continue;
      for (const band of AGE_BANDS) {
        age.set("pop", [row.area, row.sex, year, band], row.bands[band] ?? null);
      }
    }
    console.log("age", year, "rows", rows.length);
  }

  // --- geo: latest prefs + cities ---
  const foreignCity = readPop(latest, "foreign_city_pop").filter((r) => r.level === "city");
  const totalCity = readPop(latest, "total_city_pop").filter((r) => r.level === "city");
  const totalCityBy = new Map(totalCity.map((r) => [r.area, r]));
  const foreignPref = readPop(latest, "foreign_pref_pop").filter((r) => r.level !== "city");
  const totalPref = readPop(latest, "total_pref_pop");
  const totalPrefBy = new Map(totalPref.map((r) => [r.area, r]));

  const cities = foreignCity.map((r) => ({
    code: r.area,
    label: r.label,
    pref: r.pref!,
  }));
  // 同一コードの重複を潰す
  const cityMap = new Map(cities.map((c) => [c.code, c]));
  const cityList = [...cityMap.values()].sort((a, b) => a.code.localeCompare(b.code));
  const cityCodes = cityList.map((c) => c.code);

  const geoPref = new Cube(
    [
      { name: "area", codes: areaCodes },
      { name: "sex", codes: sexCodes },
    ],
    [
      "pop",
      "households",
      "growth",
      "growthRate",
      "share",
      "naturalGrowth",
      "socialGrowth",
      "inDomestic",
      "inForeign",
      "outDomestic",
      "outForeign",
      "births",
      "deaths",
    ],
  );

  for (const row of foreignPref) {
    if (!areaCodes.includes(row.area)) continue;
    const tot = totalPrefBy.get(row.area);
    for (const sex of sexCodes) {
      const pop = sexValue(row, sex);
      const totPop = tot ? sexValue(tot, sex) : null;
      const coords = [row.area, sex];
      geoPref.set("pop", coords, pop);
      geoPref.set("households", coords, sex === "total" ? row.households : null);
      geoPref.set("growth", coords, sex === "total" ? row.growth : null);
      geoPref.set("growthRate", coords, sex === "total" ? round(row.growthRate, 3) : null);
      geoPref.set("share", coords, round(shareOf(pop, totPop), 6));
      geoPref.set("naturalGrowth", coords, sex === "total" ? row.naturalGrowth : null);
      geoPref.set("socialGrowth", coords, sex === "total" ? row.socialGrowth : null);
      geoPref.set("inDomestic", coords, sex === "total" ? row.inDomestic : null);
      geoPref.set("inForeign", coords, sex === "total" ? row.inForeign : null);
      geoPref.set("outDomestic", coords, sex === "total" ? row.outDomestic : null);
      geoPref.set("outForeign", coords, sex === "total" ? row.outForeign : null);
      geoPref.set("births", coords, sex === "total" ? row.births : null);
      geoPref.set("deaths", coords, sex === "total" ? row.deaths : null);
    }
  }

  const geoCity = new Cube(
    [
      { name: "area", codes: cityCodes },
      { name: "sex", codes: sexCodes },
    ],
    ["pop", "households", "growth", "growthRate", "share"],
  );

  for (const row of foreignCity) {
    if (!cityMap.has(row.area)) continue;
    const tot = totalCityBy.get(row.area);
    for (const sex of sexCodes) {
      const pop = sexValue(row, sex);
      const totPop = tot ? sexValue(tot, sex) : null;
      geoCity.set("pop", [row.area, sex], pop);
      geoCity.set("households", [row.area, sex], sex === "total" ? row.households : null);
      geoCity.set("growth", [row.area, sex], sex === "total" ? row.growth : null);
      geoCity.set("growthRate", [row.area, sex], sex === "total" ? round(row.growthRate, 3) : null);
      geoCity.set("share", [row.area, sex], round(shareOf(pop, totPop), 6));
    }
  }

  // age for cities (latest only) — 年齢ビューの市区町村切替用
  const ageCityRows = readAge(latest, "foreign_city_age").filter((r) => r.level === "city");
  const ageCityCodes = [...new Set(ageCityRows.map((r) => r.area))].sort();
  const ageCity = new Cube(
    [
      { name: "area", codes: ageCityCodes },
      { name: "sex", codes: sexCodes },
      { name: "age", codes: [...AGE_BANDS] },
    ],
    ["pop"],
  );
  for (const row of ageCityRows) {
    if (!ageCityCodes.includes(row.area)) continue;
    for (const band of AGE_BANDS) {
      ageCity.set("pop", [row.area, row.sex, band], row.bands[band] ?? null);
    }
  }

  const notes = [
    {
      year: "2013",
      text: "平成25年は3月31日現在。以降は原則1月1日現在。",
    },
    {
      year: null,
      text: "外国人比率 = 外国人住民人口 ÷ 総計人口。",
    },
    {
      year: null,
      text: "年齢階級の一部市区町村は秘匿のため、内訳合計と総数が一致しない場合がある。",
    },
  ];

  const meta = {
    latestYear: latest,
    years,
    source: "総務省「住民基本台帳に基づく人口、人口動態及び世帯数」",
    sourceUrl:
      "https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/jinkou_jinkoudoutai-setaisuu.html",
    notes,
  };

  writeFileSync(
    resolve(OUT, "era.json"),
    JSON.stringify({
      areas: prefAreas,
      sexes: SEXES,
      years,
      ...era.toJSON(),
    }),
  );
  writeFileSync(
    resolve(OUT, "age.json"),
    JSON.stringify({
      areas: prefAreas,
      sexes: SEXES,
      years,
      ages: AGE_BANDS.map((c) => ({
        code: c,
        label: c === "100+" ? "100歳以上" : `${c.replace("-", "～")}歳`,
      })),
      ...age.toJSON(),
    }),
  );
  writeFileSync(
    resolve(OUT, "geo.json"),
    JSON.stringify({
      year: latest,
      areas: prefAreas,
      cities: cityList,
      sexes: SEXES,
      prefs: geoPref.toJSON(),
      citiesCube: geoCity.toJSON(),
    }),
  );
  writeFileSync(
    resolve(OUT, "age-city.json"),
    JSON.stringify({
      year: latest,
      cities: cityList.filter((c) => ageCityCodes.includes(c.code)),
      sexes: SEXES,
      ages: AGE_BANDS.map((c) => ({
        code: c,
        label: c === "100+" ? "100歳以上" : `${c.replace("-", "～")}歳`,
      })),
      ...ageCity.toJSON(),
    }),
  );
  writeFileSync(resolve(OUT, "meta.json"), JSON.stringify(meta, null, 2));

  console.log("wrote", OUT);
  console.log("era filled pop", era.filled("pop"));
  console.log("geo cities", cityList.length);
}

main();
