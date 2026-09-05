/**
 * e-Stat から住基 Excel を data/raw/ へ取得する。
 * カタログ（年×表 → statInfId）を先に組み立て、必要な表だけ落とす。
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAW = resolve(import.meta.dirname, "../data/raw");
const CATALOG = resolve(RAW, "catalog.json");
const CATALOG_SEED = resolve(import.meta.dirname, "catalog.json");
const BASE =
  "https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&toukei=00200241&tstat=000001039591&cycle=7&month=0&tclass1=000001039601";

type Catalog = Record<string, Record<string, string>>;

const YEAR_FROM = 2013;
const YEAR_TO = new Date().getFullYear();

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 japan-data-foreign-residents" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function mapTitle(cat: string, name: string): string | null {
  if (cat !== "総計" && cat !== "外国人住民") return null;
  const who = cat === "総計" ? "total" : "foreign";
  if (name.includes("都道府県別") && (name.includes("人口動態") || name.includes("人口、世帯"))) {
    return `${who}_pref_pop`;
  }
  if (name.includes("都道府県別") && name.includes("年齢")) return `${who}_pref_age`;
  if (name.includes("市区町村別") && (name.includes("人口動態") || name.includes("人口、世帯"))) {
    return `${who}_city_pop`;
  }
  if (name.includes("市区町村別") && name.includes("年齢")) return `${who}_city_age`;
  return null;
}

async function buildCatalog(): Promise<Catalog> {
  const catalog: Catalog = {};
  for (let y = YEAR_FROM; y <= YEAR_TO; y++) {
    const url = `${BASE}&year=${y}0`;
    const html = await fetchText(url);
    const ids = [...html.matchAll(/file-download\?statInfId=(\d+)&fileKind=0/g)].map((m) => m[1]!);
    const titles: [string, string][] = [];
    for (const m of html.matchAll(/【([^】]+)】\s*([^<\n]+)/g)) {
      const t: [string, string] = [m[1]!.trim(), m[2]!.trim()];
      if (t[1].includes("人口") && !titles.some((x) => x[0] === t[0] && x[1] === t[1])) {
        titles.push(t);
      }
    }
    if (ids.length === 0) continue;
    const mapping: Record<string, string> = {};
    for (let i = 0; i < ids.length; i++) {
      const title = titles[i];
      if (!title) continue;
      const key = mapTitle(title[0], title[1]);
      if (key) mapping[key] = ids[i]!;
    }
    if (Object.keys(mapping).length > 0) {
      catalog[String(y)] = mapping;
      console.log(y, Object.keys(mapping).sort().join(", "));
    }
  }
  return catalog;
}

async function download(year: string, key: string, id: string, force: boolean): Promise<void> {
  const out = resolve(RAW, `${year}_${key}.xlsx`);
  if (!force && existsSync(out)) {
    console.log("skip", `${year}_${key}`);
    return;
  }
  const url = `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${id}&fileKind=0`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 japan-data-foreign-residents" } });
  if (!res.ok) throw new Error(`${res.status} ${year} ${key}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log("ok", `${year}_${key}`, (await import("node:fs")).statSync(out).size);
}

async function main(): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  const force = process.argv.includes("--force");
  const refreshCatalog = process.argv.includes("--catalog");

  let catalog: Catalog;
  if (refreshCatalog || (!existsSync(CATALOG) && !existsSync(CATALOG_SEED))) {
    console.log("building catalog…");
    catalog = await buildCatalog();
    writeFileSync(CATALOG, JSON.stringify(catalog, null, 2));
    writeFileSync(CATALOG_SEED, JSON.stringify(catalog, null, 2));
  } else if (existsSync(CATALOG)) {
    catalog = JSON.parse(readFileSync(CATALOG, "utf8")) as Catalog;
  } else {
    catalog = JSON.parse(readFileSync(CATALOG_SEED, "utf8")) as Catalog;
    writeFileSync(CATALOG, JSON.stringify(catalog, null, 2));
  }

  const years = Object.keys(catalog).sort();
  const latest = years.at(-1)!;
  const prefKeys = ["foreign_pref_pop", "total_pref_pop", "foreign_pref_age"] as const;
  const cityKeys = ["foreign_city_pop", "total_city_pop", "foreign_city_age"] as const;

  for (const y of years) {
    for (const key of prefKeys) {
      const id = catalog[y]![key];
      if (!id) {
        console.warn("missing", y, key);
        continue;
      }
      await download(y, key, id, force);
    }
  }

  for (const key of cityKeys) {
    const id = catalog[latest]![key];
    if (!id) throw new Error(`最新年 ${latest} に ${key} がない`);
    await download(latest, key, id, force);
  }

  console.log(`done. years ${years[0]}–${latest}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
