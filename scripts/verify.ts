/**
 * 配信 JSON の健全性チェック。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA = resolve(import.meta.dirname, "../public/data");

function load(name: string): unknown {
  return JSON.parse(readFileSync(resolve(DATA, name), "utf8"));
}

interface CubeFile {
  dims: { name: string; codes: string[] }[];
  measures: Record<string, (number | null)[]>;
  areas?: { code: string; label: string }[];
  years?: string[];
}

function offset(
  dims: { name: string; codes: string[] }[],
  coords: Record<string, string>,
): number {
  let off = 0;
  for (let i = 0; i < dims.length; i++) {
    const d = dims[i]!;
    const code = coords[d.name];
    if (code === undefined) throw new Error(`missing ${d.name}`);
    const idx = d.codes.indexOf(code);
    if (idx < 0) throw new Error(`bad ${d.name}=${code}`);
    const stride = dims.slice(i + 1).reduce((n, x) => n * x.codes.length, 1);
    off += idx * stride;
  }
  return off;
}

let failed = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("FAIL", msg);
    failed++;
  } else {
    console.log("ok", msg);
  }
}

const era = load("era.json") as CubeFile;
const meta = load("meta.json") as { years: string[]; latestYear: string };
const geo = load("geo.json") as {
  year: string;
  prefs: CubeFile;
  cities: { code: string }[];
  citiesCube: CubeFile;
};

check(era.years!.length === meta.years.length, "era years == meta years");
check(meta.latestYear === "2026" || meta.years.includes(meta.latestYear), "latest year present");

const nat2026 = era.measures.pop![
  offset(era.dims, { area: "00", sex: "total", year: meta.latestYear })
];
check(typeof nat2026 === "number" && nat2026! > 3_000_000, `national pop ~4M got ${nat2026}`);

const share = era.measures.share![
  offset(era.dims, { area: "00", sex: "total", year: meta.latestYear })
];
check(typeof share === "number" && share! > 0.01 && share! < 0.1, `national share got ${share}`);

// 全国 ≈ 47県合計（最新年・総数）
let sum = 0;
for (const pref of era.dims.find((d) => d.name === "area")!.codes) {
  if (pref === "00") continue;
  const v = era.measures.pop![offset(era.dims, { area: pref, sex: "total", year: meta.latestYear })];
  if (typeof v === "number") sum += v;
}
check(Math.abs(sum - (nat2026 as number)) < 1, `pref sum ${sum} == national ${nat2026}`);

check(geo.cities.length > 1700, `city count ${geo.cities.length}`);
check(geo.year === meta.latestYear, "geo year == latest");

if (failed > 0) {
  console.error(`${failed} checks failed`);
  process.exit(1);
}
console.log("all checks passed");
