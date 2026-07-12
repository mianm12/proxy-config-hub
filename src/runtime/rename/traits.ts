interface TraitRule {
  readonly label: string;
  readonly aliases: readonly string[];
}

const ORDERED_TRAITS: readonly TraitRule[] = [
  { label: "IPv6", aliases: ["IPv6", "V6"] },
  { label: "家宽", aliases: ["家宽"] },
  { label: "住宅", aliases: ["住宅"] },
  { label: "原生", aliases: ["原生"] },
  { label: "电信", aliases: ["电信"] },
  { label: "联通", aliases: ["联通"] },
  { label: "移动", aliases: ["移动"] },
  { label: "三网优化", aliases: ["三网优化"] },
] as const;

const ROUTE_TRAITS: readonly TraitRule[] = [
  { label: "IPLC", aliases: ["IPLC"] },
  { label: "IEPL", aliases: ["IEPL"] },
  { label: "专线", aliases: ["专线"] },
  { label: "中转", aliases: ["中转"] },
  { label: "直连", aliases: ["直连"] },
] as const;

const TRAILING_TRAITS: readonly TraitRule[] = [
  { label: "游戏", aliases: ["游戏"] },
  { label: "测试", aliases: ["测试"] },
  { label: "XHTTP", aliases: ["XHTTP"] },
  { label: "REALITY", aliases: ["REALITY"] },
  { label: "Vision", aliases: ["Vision"] },
  { label: "TLS", aliases: ["TLS"] },
  { label: "CDN", aliases: ["CDN"] },
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesLiteral(name: string, literal: string): boolean {
  if (/^[a-z0-9]+$/i.test(literal)) {
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(literal)}(?=$|[^a-z0-9])`, "iu").test(name);
  }
  return name.toLocaleLowerCase("en-US").includes(literal.toLocaleLowerCase("en-US"));
}

function matchesRule(name: string, rule: TraitRule): boolean {
  return rule.aliases.some((alias) => includesLiteral(name, alias));
}

function extractTraits(name: string, extraTraits: readonly string[]): readonly string[] {
  const traits = ORDERED_TRAITS.filter((rule) => matchesRule(name, rule)).map(({ label }) => label);
  const route = ROUTE_TRAITS.find((rule) => matchesRule(name, rule));
  if (route !== undefined) traits.push(route.label);
  traits.push(
    ...TRAILING_TRAITS.filter((rule) => matchesRule(name, rule)).map(({ label }) => label),
  );

  const seen = new Set(traits.map((trait) => trait.toLocaleLowerCase("en-US")));
  for (const trait of extraTraits) {
    const normalized = trait.toLocaleLowerCase("en-US");
    if (seen.has(normalized) || !includesLiteral(name, trait)) continue;
    seen.add(normalized);
    traits.push(trait);
  }
  return traits;
}

export { extractTraits };
