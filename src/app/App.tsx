import { Suspense } from "react";
import { EraView } from "./views/EraView.tsx";
import { AgeView } from "./views/AgeView.tsx";
import { GeoView } from "./views/GeoView.tsx";
import { useUrlState } from "./hooks/useUrlState.ts";
import { SeriesBar, SeriesFooter } from "./components/Brand.tsx";

const VIEWS = [
  { id: "era", label: "時代", hint: "2013–2026" },
  { id: "age", label: "年齢", hint: "年齢階級" },
  { id: "geo", label: "地域", hint: "都道府県・市区町村" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

export function App() {
  const [view, setView] = useUrlState<ViewId>("view", "era", (v) =>
    VIEWS.some((x) => x.id === v),
  );

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule bg-paper/85 backdrop-blur-sm">
        <SeriesBar />
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-end justify-between gap-4 px-6 pt-5">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">
              日本の外国人住民はどこにいるか
            </h1>
            <p className="text-[11px] text-muted">
              総務省「住民基本台帳に基づく人口、人口動態及び世帯数」
            </p>
          </div>
          <nav className="flex gap-1 -mb-px" aria-label="ビュー">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-current={view === v.id ? "page" : undefined}
                className={`cursor-pointer border-b-2 px-3 pt-1 pb-2 text-[13px] transition-colors duration-150 ${
                  view === v.id
                    ? "border-accent font-semibold text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {v.label}
                <span className="ml-1.5 text-[10px] font-normal text-faint">{v.hint}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <Suspense key={view} fallback={<Loading />}>
        {view === "era" && <EraView />}
        {view === "age" && <AgeView />}
        {view === "geo" && <GeoView />}
      </Suspense>

      <footer className="mx-auto w-full max-w-[1240px] px-6 pt-2 pb-10 text-[11px] leading-relaxed text-faint">
        出典: 総務省「住民基本台帳に基づく人口、人口動態及び世帯数」（e-Stat
        経由で取得）。外国人比率は外国人住民人口 ÷ 総計人口。
        <SeriesFooter />
      </footer>
    </div>
  );
}

function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-6 py-16 text-[12px] text-faint">
      読み込み中
    </div>
  );
}
