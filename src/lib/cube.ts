/**
 * 配信用の多次元データ。軸コード辞書 + 行優先フラット配列。
 */

export interface Dim {
  name: string;
  codes: string[];
}

export interface CubeJson {
  dims: Dim[];
  measures: Record<string, (number | null)[]>;
}

export class Cube {
  private readonly dims: Dim[];
  private readonly indexOf: Map<string, number>[];
  private readonly strides: number[];
  private readonly measures = new Map<string, (number | null)[]>();
  readonly size: number;

  constructor(dims: Dim[], measureNames: string[]) {
    this.dims = dims;
    this.indexOf = dims.map((d) => new Map(d.codes.map((c, i) => [c, i])));
    this.strides = dims.map((_, i) =>
      dims.slice(i + 1).reduce((n, d) => n * d.codes.length, 1),
    );
    this.size = dims.reduce((n, d) => n * d.codes.length, 1);
    for (const name of measureNames) {
      this.measures.set(name, new Array<number | null>(this.size).fill(null));
    }
  }

  set(measure: string, coords: string[], value: number | null): void {
    const target = this.measures.get(measure);
    if (target === undefined) throw new Error(`指標 ${measure} は未定義`);
    let offset = 0;
    for (let i = 0; i < this.dims.length; i++) {
      const idx = this.indexOf[i]!.get(coords[i]!);
      if (idx === undefined) {
        throw new Error(`軸 ${this.dims[i]!.name} にコード ${coords[i]} がない`);
      }
      offset += idx * this.strides[i]!;
    }
    target[offset] = value;
  }

  filled(measure: string): number {
    return this.measures.get(measure)!.filter((v) => v !== null).length;
  }

  toJSON(): CubeJson {
    return { dims: this.dims, measures: Object.fromEntries(this.measures) };
  }
}

export function round(value: number | null, digits: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
