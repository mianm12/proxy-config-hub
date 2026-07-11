interface MultiplierMatch {
  readonly value: number;
  readonly label: string;
}

const MULTIPLIER_PATTERNS = [
  /(?:倍率|[x×])\s*[:：]?\s*((?:\d{1,3}\.)?\d+)/iu,
  /((?:\d{1,3}\.)?\d+)\s*(?:倍|[x×])/iu,
] as const;

/** 提取首个倍率；1 倍视为默认值，不写入重命名结果。 */
function extractMultiplier(name: string): MultiplierMatch | undefined {
  for (const pattern of MULTIPLIER_PATTERNS) {
    const match = pattern.exec(name);
    const raw = match?.[1];
    if (raw === undefined) continue;

    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value === 1) {
      return undefined;
    }
    return { value, label: `${raw}×` };
  }
  return undefined;
}

export { extractMultiplier };
export type { MultiplierMatch };
