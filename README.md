# 日本の外国人住民はどこにいるか

総務省「住民基本台帳に基づく人口、人口動態及び世帯数」をもとに、
外国人住民の人口・年齢・地域を時代／年齢／地域の3つの切り口で探索するダッシュボード。

- 公開: https://japan-data-foreign-residents.visualizing.jp/
- リポジトリ: https://github.com/visualizing-jp/japan-data-foreign-residents

visualizing.jp スタンドアロン（dataviz.jp サブスクツールではない）。

## 開発

```bash
npm install
npm run fetch          # e-Stat から Excel を data/raw/ へ
npm run data           # public/data/*.json を生成
npm run verify
npm run dev
```

| スクリプト | 内容 |
| --- | --- |
| `npm run fetch` | e-Stat Excel 取得（`--force` で再取得、`--catalog` でカタログ更新） |
| `npm run data` | 配信用 Cube 構築 |
| `npm run verify` | 健全性チェック |
| `npm run dev` | Vite 開発サーバ |
| `npm run build` | 本番ビルド |
| `npm run typecheck` | TypeScript 検査 |

データ設計の正本は [`docs/data-sources.md`](docs/data-sources.md)。

## デプロイ

`main` への push で GitHub Pages にデプロイ（`.github/workflows/pages.yml`）。
カスタムドメインは `public/CNAME`（`japan-data-foreign-residents.visualizing.jp`）。
Netlify 用設定も `netlify.toml` にあり。
