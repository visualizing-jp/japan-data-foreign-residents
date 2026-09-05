import { CubeView, type CubeJson, type DictEntry } from "./cube.ts";

function chunk<T, R>(url: string, map: (raw: T) => R): Promise<R> {
  return fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return map((await res.json()) as T);
  });
}

export interface EraData {
  areas: DictEntry[];
  sexes: DictEntry[];
  years: string[];
  cube: CubeView;
}

export interface AgeData {
  areas: DictEntry[];
  sexes: DictEntry[];
  years: string[];
  ages: DictEntry[];
  cube: CubeView;
}

export interface GeoData {
  year: string;
  areas: DictEntry[];
  cities: { code: string; label: string; pref: string }[];
  sexes: DictEntry[];
  prefs: CubeView;
  citiesCube: CubeView;
}

export interface AgeCityData {
  year: string;
  cities: { code: string; label: string; pref: string }[];
  sexes: DictEntry[];
  ages: DictEntry[];
  cube: CubeView;
}

export interface MetaData {
  latestYear: string;
  years: string[];
  source: string;
  sourceUrl: string;
  notes: { year: string | null; text: string }[];
}

let eraP: Promise<EraData> | undefined;
let ageP: Promise<AgeData> | undefined;
let geoP: Promise<GeoData> | undefined;
let ageCityP: Promise<AgeCityData> | undefined;
let metaP: Promise<MetaData> | undefined;

export function loadEra(): Promise<EraData> {
  eraP ??= chunk<
    CubeJson & { areas: DictEntry[]; sexes: DictEntry[]; years: string[] },
    EraData
  >("/data/era.json", (raw) => ({
    areas: raw.areas,
    sexes: raw.sexes,
    years: raw.years,
    cube: new CubeView(raw),
  }));
  return eraP;
}

export function loadAge(): Promise<AgeData> {
  ageP ??= chunk<
    CubeJson & {
      areas: DictEntry[];
      sexes: DictEntry[];
      years: string[];
      ages: DictEntry[];
    },
    AgeData
  >("/data/age.json", (raw) => ({
    areas: raw.areas,
    sexes: raw.sexes,
    years: raw.years,
    ages: raw.ages,
    cube: new CubeView(raw),
  }));
  return ageP;
}

export function loadGeo(): Promise<GeoData> {
  geoP ??= chunk<
    {
      year: string;
      areas: DictEntry[];
      cities: { code: string; label: string; pref: string }[];
      sexes: DictEntry[];
      prefs: CubeJson;
      citiesCube: CubeJson;
    },
    GeoData
  >("/data/geo.json", (raw) => ({
    year: raw.year,
    areas: raw.areas,
    cities: raw.cities,
    sexes: raw.sexes,
    prefs: new CubeView(raw.prefs),
    citiesCube: new CubeView(raw.citiesCube),
  }));
  return geoP;
}

export function loadAgeCity(): Promise<AgeCityData> {
  ageCityP ??= chunk<
    CubeJson & {
      year: string;
      cities: { code: string; label: string; pref: string }[];
      sexes: DictEntry[];
      ages: DictEntry[];
    },
    AgeCityData
  >("/data/age-city.json", (raw) => ({
    year: raw.year,
    cities: raw.cities,
    sexes: raw.sexes,
    ages: raw.ages,
    cube: new CubeView(raw),
  }));
  return ageCityP;
}

export function loadMeta(): Promise<MetaData> {
  metaP ??= chunk<MetaData, MetaData>("/data/meta.json", (raw) => raw);
  return metaP;
}
