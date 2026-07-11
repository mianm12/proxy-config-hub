import type { GroupIr, ProviderIr, RuleIr } from "../../compiler/ir/project-ir.ts";

interface RoutingOutput {
  readonly providers: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly rules: readonly string[];
}

function resolveTarget(target: string, groupNames: ReadonlyMap<string, string>): string {
  return groupNames.get(target) ?? target;
}

function buildRouting(
  providers: readonly ProviderIr[],
  rules: readonly RuleIr[],
  groups: readonly GroupIr[],
  fallbackGroup: string,
): RoutingOutput {
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const providerOutput = Object.fromEntries(
    providers.map((provider) => {
      const { mihomo, ...standard } = provider.config;
      return [provider.id, { ...standard, ...mihomo }];
    }),
  );
  const ruleOutput = rules.map((rule) => {
    if (rule.kind === "raw") return rule.value;
    const target = resolveTarget(rule.target, groupNames);
    return `RULE-SET,${rule.provider},${target}${rule.noResolve ? ",no-resolve" : ""}`;
  });
  ruleOutput.push(`MATCH,${resolveTarget(fallbackGroup, groupNames)}`);

  return { providers: providerOutput, rules: ruleOutput };
}

export { buildRouting };
export type { RoutingOutput };
