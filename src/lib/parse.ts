/**
 * 住基 Excel（外国人／総計）の読み取り。
 * 年次でヘッダ行数が違うため、列は見出し文字列から探す。
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import XLSX from "xlsx";
import {
  AGE_BANDS,
  NATIONAL,
  normalizeAgeLabel,
  prefFromJichi,
  sexFromLabel,
  type SexCode,
} from "./labels.ts";

const RAW = resolve(import.meta.dirname, "../../data/raw");

export type SheetKind =
  | "foreign_pref_pop"
  | "total_pref_pop"
  | "foreign_pref_age"
  | "foreign_city_pop"
  | "total_city_pop"
  | "foreign_city_age";

export interface PopRow {
  area: string;
  label: string;
  pref: string | null;
  level: "national" | "pref" | "city";
  male: number | null;
  female: number | null;
  total: number | null;
  households: number | null;
  growth: number | null;
  growthRate: number | null;
  naturalGrowth: number | null;
  socialGrowth: number | null;
  inDomestic: number | null;
  inForeign: number | null;
  outDomestic: number | null;
  outForeign: number | null;
  births: number | null;
  deaths: number | null;
}

export interface AgeRow {
  area: string;
  label: string;
  pref: string | null;
  level: "national" | "pref" | "city";
  sex: SexCode;
  total: number | null;
  bands: Record<string, number | null>;
}

function loadSheet(year: string, kind: SheetKind): (string | number | null)[][] {
  const path = resolve(RAW, `${year}_${kind}.xlsx`);
  if (!existsSync(path)) throw new Error(`Excel がない: ${path}`);
  const wb = XLSX.read(readFileSync(path));
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (ws === undefined) throw new Error(`シートがない: ${path}`);
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  });
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.replace(/,/g, "").trim();
    if (t === "" || t === "-" || t === "…") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function findHeaderRow(rows: (string | number | null)[][]): number {
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const a = cellStr(rows[i]?.[0]);
    if (a.includes("団体コード")) return i;
  }
  throw new Error("団体コード行が見つからない");
}

function findCol(
  headerRows: (string | number | null)[][],
  predicates: ((cell: string, col: number, rows: (string | number | null)[][]) => boolean)[],
): number {
  const width = Math.max(...headerRows.map((r) => r.length));
  for (let c = 0; c < width; c++) {
    if (predicates.every((p) => p(cellStr(headerRows.map((r) => r[c]).join("|")), c, headerRows))) {
      return c;
    }
  }
  return -1;
}

function colHas(text: string) {
  return (joined: string) => joined.includes(text);
}

function pickPopColumns(headerRows: (string | number | null)[][]) {
  // 人口の男/女/計は「人口」ブロック先頭。世帯数は独立列。
  const male = findCol(headerRows, [colHas("人口"), colHas("男")]);
  const female = findCol(headerRows, [colHas("人口"), colHas("女")]);
  // 「計」は人口・転入計など複数ある。人口行に載る計を取る。
  let total = -1;
  const width = Math.max(...headerRows.map((r) => r.length));
  for (let c = 0; c < width; c++) {
    const joined = headerRows.map((r) => cellStr(r[c])).join("|");
    if (joined.includes("人口") && (joined.includes("|計") || joined.endsWith("計") || /人口.*計|計.*人口/.test(joined) || joined === "人口|計" || joined.includes("人口") && cellStr(headerRows.at(-1)?.[c]) === "計")) {
      // prefer exact 計 under 人口
      const last = cellStr(headerRows.at(-1)?.[c]);
      const mid = headerRows.map((r) => cellStr(r[c]));
      if (last === "計" && mid.some((x) => x.includes("人口"))) {
        total = c;
        break;
      }
    }
  }
  if (total < 0) {
    // fallback: male+2
    total = male >= 0 ? male + 2 : -1;
  }
  const households = findCol(headerRows, [(j) => j.includes("世帯")]);
  const growth = findCol(headerRows, [(j) => j.includes("増減数")]);
  const growthRate = findCol(headerRows, [(j) => j.includes("増減率") && !j.includes("自然") && !j.includes("社会")]);
  const naturalGrowth = findCol(headerRows, [(j) => j.includes("自然増減数")]);
  const socialGrowth = findCol(headerRows, [(j) => j.includes("社会増減数")]);
  const inDomestic = findCol(headerRows, [(j) => j.includes("転入者数（国内）") || j.includes("転入者数(国内)")]);
  const inForeign = findCol(headerRows, [(j) => j.includes("転入者数（国外）") || j.includes("転入者数(国外)")]);
  const outDomestic = findCol(headerRows, [(j) => j.includes("転出者数（国内）") || j.includes("転出者数(国内)")]);
  const outForeign = findCol(headerRows, [(j) => j.includes("転出者数（国外）") || j.includes("転出者数(国外)")]);
  const births = findCol(headerRows, [(j) => j.includes("出生")]);
  const deaths = findCol(headerRows, [(j) => j.includes("死亡")]);

  if (male < 0 || female < 0 || total < 0) {
    // 旧形式: 団体コード, 都道府県名, 男, 女, 計, 世帯数
    return {
      male: 2,
      female: 3,
      total: 4,
      households: 5,
      growth,
      growthRate,
      naturalGrowth,
      socialGrowth,
      inDomestic,
      inForeign,
      outDomestic,
      outForeign,
      births,
      deaths,
      nameCol: 1,
      cityCol: -1,
    };
  }

  return {
    male,
    female,
    total,
    households,
    growth,
    growthRate,
    naturalGrowth,
    socialGrowth,
    inDomestic,
    inForeign,
    outDomestic,
    outForeign,
    births,
    deaths,
    nameCol: 1,
    cityCol: headerRows[0] && cellStr(headerRows[0][2]).includes("市区町村") ? 2 : -1,
  };
}

function at(row: (string | number | null)[], col: number): number | null {
  if (col < 0) return null;
  return num(row[col]);
}

function isNationalRow(code: string, name: string): boolean {
  return code === "-" || code === "" || name === "合計" || name === "全国";
}

export function readPop(year: string, kind: SheetKind): PopRow[] {
  const rows = loadSheet(year, kind);
  const headerIdx = findHeaderRow(rows);
  // 団体コード行の前後を見る。旧形式は団体コードの「下」に増減率などの見出しがある。
  const headerRows = rows.slice(
    Math.max(0, headerIdx - 4),
    Math.min(rows.length, headerIdx + 4),
  );
  const cols = pickPopColumns(headerRows);
  // city files: 団体コード行の col2 が市区町村名
  if (kind.includes("city")) {
    cols.cityCol = 2;
  }

  const out: PopRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const rawCode = cellStr(row[0]);
    const name = cellStr(row[cols.nameCol]).replace(/\*$/, "");
    if (!name && !rawCode) continue;

    const cityName = cols.cityCol >= 0 ? cellStr(row[cols.cityCol]) : "";
    const isCitySheet = cols.cityCol >= 0;

    if (isNationalRow(rawCode, name) && (!isCitySheet || cityName === "" || cityName === "-")) {
      out.push({
        area: NATIONAL.code,
        label: NATIONAL.label,
        pref: null,
        level: "national",
        male: at(row, cols.male),
        female: at(row, cols.female),
        total: at(row, cols.total),
        households: at(row, cols.households),
        growth: at(row, cols.growth),
        growthRate: at(row, cols.growthRate),
        naturalGrowth: at(row, cols.naturalGrowth),
        socialGrowth: at(row, cols.socialGrowth),
        inDomestic: at(row, cols.inDomestic),
        inForeign: at(row, cols.inForeign),
        outDomestic: at(row, cols.outDomestic),
        outForeign: at(row, cols.outForeign),
        births: at(row, cols.births),
        deaths: at(row, cols.deaths),
      });
      continue;
    }

    const pref = prefFromJichi(rawCode);
    if (pref === null) continue;

    if (isCitySheet) {
      // 都道府県計行（市区町村名が空 or -）は pref として扱う（city キューブには載せない）
      if (cityName === "" || cityName === "-") {
        out.push({
          area: pref,
          label: name || pref,
          pref,
          level: "pref",
          male: at(row, cols.male),
          female: at(row, cols.female),
          total: at(row, cols.total),
          households: at(row, cols.households),
          growth: at(row, cols.growth),
          growthRate: at(row, cols.growthRate),
          naturalGrowth: at(row, cols.naturalGrowth),
          socialGrowth: at(row, cols.socialGrowth),
          inDomestic: at(row, cols.inDomestic),
          inForeign: at(row, cols.inForeign),
          outDomestic: at(row, cols.outDomestic),
          outForeign: at(row, cols.outForeign),
          births: at(row, cols.births),
          deaths: at(row, cols.deaths),
        });
        continue;
      }
      const code = String(rawCode).replace(/\D/g, "").padStart(6, "0");
      out.push({
        area: code,
        label: cityName,
        pref,
        level: "city",
        male: at(row, cols.male),
        female: at(row, cols.female),
        total: at(row, cols.total),
        households: at(row, cols.households),
        growth: at(row, cols.growth),
        growthRate: at(row, cols.growthRate),
        naturalGrowth: at(row, cols.naturalGrowth),
        socialGrowth: at(row, cols.socialGrowth),
        inDomestic: at(row, cols.inDomestic),
        inForeign: at(row, cols.inForeign),
        outDomestic: at(row, cols.outDomestic),
        outForeign: at(row, cols.outForeign),
        births: at(row, cols.births),
        deaths: at(row, cols.deaths),
      });
      continue;
    }

    out.push({
      area: pref,
      label: name || pref,
      pref,
      level: "pref",
      male: at(row, cols.male),
      female: at(row, cols.female),
      total: at(row, cols.total),
      households: at(row, cols.households),
      growth: at(row, cols.growth),
      growthRate: at(row, cols.growthRate),
      naturalGrowth: at(row, cols.naturalGrowth),
      socialGrowth: at(row, cols.socialGrowth),
      inDomestic: at(row, cols.inDomestic),
      inForeign: at(row, cols.inForeign),
      outDomestic: at(row, cols.outDomestic),
      outForeign: at(row, cols.outForeign),
      births: at(row, cols.births),
      deaths: at(row, cols.deaths),
    });
  }
  return out;
}

export function readAge(year: string, kind: SheetKind): AgeRow[] {
  const rows = loadSheet(year, kind);
  // 年齢表は「団体コード」行がヘッダ
  let headerIdx = -1;
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    if (cellStr(rows[i]?.[0]).includes("団体コード")) {
      headerIdx = i;
      break;
    }
  }
  // 旧形式は行1がヘッダで団体コードがある
  if (headerIdx < 0) throw new Error(`年齢表ヘッダがない: ${year} ${kind}`);

  const header = rows[headerIdx]!.map(cellStr);
  // ひとつ上に年齢ラベルがある場合（2021+）
  const ageHeader =
    headerIdx > 0 && rows[headerIdx - 1]!.some((c) => normalizeAgeLabel(cellStr(c)))
      ? rows[headerIdx - 1]!.map(cellStr)
      : header;

  const sexCol = header.findIndex((h) => h.includes("性別"));
  const nameCol = 1;
  const cityCol = header.some((h) => h.includes("市区町村")) ? 2 : -1;

  const bandCols: { code: string; col: number }[] = [];
  let totalCol = -1;
  for (let c = 0; c < ageHeader.length; c++) {
    const label = ageHeader[c] || header[c] || "";
    if (/総数|^計$/.test(label.replace(/\s/g, ""))) {
      totalCol = c;
      continue;
    }
    const band = normalizeAgeLabel(label);
    if (band && (AGE_BANDS as readonly string[]).includes(band)) {
      bandCols.push({ code: band, col: c });
    }
  }

  const out: AgeRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const rawCode = cellStr(row[0]);
    const name = cellStr(row[nameCol]).replace(/\*$/, "");
    const sexLabel = sexCol >= 0 ? cellStr(row[sexCol]) : "計";
    const sex = sexFromLabel(sexLabel) ?? (sexCol < 0 ? "total" : null);
    if (sex === null) continue;

    const bands: Record<string, number | null> = {};
    for (const b of AGE_BANDS) bands[b] = null;
    for (const { code, col } of bandCols) bands[code] = num(row[col]);
    const total = totalCol >= 0 ? num(row[totalCol]) : null;

    const cityName = cityCol >= 0 ? cellStr(row[cityCol]) : "";

    if (isNationalRow(rawCode, name) && (cityCol < 0 || cityName === "" || cityName === "-")) {
      out.push({
        area: NATIONAL.code,
        label: NATIONAL.label,
        pref: null,
        level: "national",
        sex,
        total,
        bands,
      });
      continue;
    }

    const pref = prefFromJichi(rawCode);
    if (pref === null) continue;

    if (cityCol >= 0) {
      if (cityName === "" || cityName === "-") {
        out.push({
          area: pref,
          label: name || pref,
          pref,
          level: "pref",
          sex,
          total,
          bands,
        });
        continue;
      }
      out.push({
        area: String(rawCode).replace(/\D/g, "").padStart(6, "0"),
        label: cityName,
        pref,
        level: "city",
        sex,
        total,
        bands,
      });
      continue;
    }

    out.push({
      area: pref,
      label: name || pref,
      pref,
      level: "pref",
      sex,
      total,
      bands,
    });
  }
  return out;
}

export function listAvailableYears(): string[] {
  const years = new Set<string>();
  for (const f of readdirSync(RAW)) {
    const m = /^(\d{4})_foreign_pref_pop\.xlsx$/.exec(f);
    if (m) years.add(m[1]!);
  }
  return [...years].sort();
}
