/** 図上の注記。基準日の断絶など。 */

export const SPANS: readonly {
  from: number;
  to: number;
  label: string;
  detail: string;
  kind: "missing" | "scope";
}[] = [];

export const MARKS: { year: number; label: string; detail: string }[] = [
  {
    year: 2013,
    label: "3/31",
    detail: "平成25年のみ基準日が3月31日。以降は1月1日現在。",
  },
];

export const NOTES: string[] = [
  "外国人比率は外国人住民人口 ÷ 総計人口。",
  "年齢階級の一部市区町村は秘匿のため、内訳と総数が一致しない場合がある。",
];
