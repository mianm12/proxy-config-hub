interface TagMatch {
  readonly configured: string;
  readonly value: string;
}

/** 按 profile 声明顺序匹配标签，大小写不敏感但保留输入中的实际拼写。 */
function extractTags(name: string, configuredTags: readonly string[]): readonly TagMatch[] {
  const lowerName = name.toLocaleLowerCase("en-US");
  const seen = new Set<string>();
  const matches: TagMatch[] = [];

  for (const configured of configuredTags) {
    const normalized = configured.toLocaleLowerCase("en-US");
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const index = lowerName.indexOf(normalized);
    if (index === -1) continue;
    matches.push({ configured, value: name.slice(index, index + configured.length) });
  }

  return matches;
}

export { extractTags };
export type { TagMatch };
