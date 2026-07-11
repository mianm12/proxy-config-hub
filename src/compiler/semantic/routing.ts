import type { GroupIr, ProviderConfigIr, ProviderIr, RuleIr } from "../ir/project-ir.ts";
import type { LoadedYaml, RawProject } from "../load-raw-project.ts";
import type { RawRoutingModule } from "../schema/raw/index.ts";
import type { DiagnosticCollector } from "./diagnostic-collector.ts";

type RawRuleBlock = RawRoutingModule["rule-blocks"][number];
type RawProviderReference = NonNullable<RawRuleBlock["providers"]>[number];

interface BlockReference {
  readonly module: LoadedYaml<RawRoutingModule>;
  readonly block: RawRuleBlock;
  readonly blockIndex: number;
}

interface RoutingCompilationResult {
  readonly providers: readonly ProviderIr[];
  readonly rules: readonly RuleIr[];
  readonly fallbackGroup: string;
}

const BUILTIN_TARGETS = new Set(["COMPATIBLE", "DIRECT", "DNS", "PASS", "REJECT", "REJECT-DROP"]);
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9_!+.-]*$/;
const PROVIDER_OWNED_MIHOMO_KEYS = new Set([
  "type",
  "behavior",
  "format",
  "url",
  "path",
  "interval",
  "target-group",
]);

function renderTemplate(
  template: string,
  variables: Readonly<Record<string, string>>,
  allowedVariables: ReadonlySet<string>,
  diagnostics: DiagnosticCollector,
  source: ReturnType<RawProject["providerSources"]["source"]["locate"]>,
): string {
  let rendered = template;
  const matches = [...template.matchAll(/\{([^{}]+)\}/g)];

  for (const match of matches) {
    const variable = match[1];
    if (variable === undefined || !allowedVariables.has(variable)) {
      diagnostics.error(
        "CFG_PROVIDER_TEMPLATE_VARIABLE",
        `provider template 使用了未知变量: ${variable ?? "<empty>"}`,
        source,
      );
      continue;
    }
    rendered = rendered.split(`{${variable}}`).join(variables[variable] ?? "");
  }

  if (/[{}]/.test(rendered)) {
    diagnostics.error("CFG_PROVIDER_TEMPLATE_VARIABLE", "provider template 含未解析花括号", source);
  }
  return rendered;
}

function validateProviderUrl(
  url: string | undefined,
  diagnostics: DiagnosticCollector,
  source: ReturnType<RawProject["modules"][number]["source"]["locate"]>,
): void {
  if (url === undefined) return;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      diagnostics.error("CFG_PROVIDER_URL_INVALID", `provider URL 只允许 HTTP(S): ${url}`, source);
    }
  } catch {
    diagnostics.error("CFG_PROVIDER_URL_INVALID", `provider URL 非法: ${url}`, source);
  }
}

function validateProviderMihomo(
  options: Readonly<Record<string, unknown>>,
  diagnostics: DiagnosticCollector,
  source: ReturnType<RawProject["modules"][number]["source"]["locate"]>,
): void {
  for (const key of Object.keys(options)) {
    if (PROVIDER_OWNED_MIHOMO_KEYS.has(key)) {
      diagnostics.error(
        "CFG_MIHOMO_OWNED_FIELD",
        `provider mihomo 透传不能覆盖领域字段: ${key}`,
        source,
      );
    }
  }
}

function makeProviderConfig(
  provider: {
    readonly type: "http" | "file" | "inline";
    readonly behavior: "domain" | "ipcidr" | "classical";
    readonly format?: "yaml" | "text" | "mrs" | undefined;
    readonly url?: string | undefined;
    readonly path?: string | undefined;
    readonly interval?: number | undefined;
  },
  mihomo: Readonly<Record<string, unknown>>,
): ProviderConfigIr {
  return {
    type: provider.type,
    behavior: provider.behavior,
    ...(provider.format === undefined ? {} : { format: provider.format }),
    ...(provider.url === undefined ? {} : { url: provider.url }),
    ...(provider.path === undefined ? {} : { path: provider.path }),
    ...(provider.interval === undefined ? {} : { interval: provider.interval }),
    mihomo,
  };
}

function inferRawRuleTarget(raw: string): string | undefined {
  const fields = raw.split(",").map((field) => field.trim());
  let targetIndex = fields.length - 1;
  if (fields[targetIndex]?.toLocaleLowerCase("en-US") === "no-resolve") targetIndex -= 1;
  return targetIndex >= 2 && fields[targetIndex] !== "" ? fields[targetIndex] : undefined;
}

function compileRawRuleTarget(
  rule: { readonly raw: string; readonly target?: string | undefined },
  groupsById: ReadonlyMap<string, GroupIr>,
  groupIdsByName: ReadonlyMap<string, string>,
  diagnostics: DiagnosticCollector,
  source: ReturnType<RawProject["modules"][number]["source"]["locate"]>,
): string | undefined {
  const ruleType = rule.raw.split(",", 1)[0]?.trim().toLocaleUpperCase("en-US");
  if (ruleType === "MATCH" || ruleType === "FINAL" || ruleType === "RULE-SET") {
    diagnostics.error(
      "CFG_RAW_RULE_STRUCTURED_REQUIRED",
      `${ruleType} 已有结构化装配能力，不允许使用 raw`,
      source,
    );
    return rule.target;
  }

  const inferred = inferRawRuleTarget(rule.raw);
  if (rule.target !== undefined) {
    const expected = groupsById.get(rule.target)?.name ?? rule.target;
    if (inferred !== undefined && inferred !== expected) {
      diagnostics.error(
        "CFG_RAW_RULE_TARGET_MISMATCH",
        `raw 规则目标 ${inferred} 与显式 target ${rule.target}（输出名 ${expected}）不一致`,
        source,
      );
    }
    return rule.target;
  }

  if (inferred === undefined) {
    diagnostics.error(
      "CFG_RAW_RULE_TARGET_REQUIRED",
      "无法从 raw 规则可靠解析目标，必须显式声明 target",
      source,
    );
    return undefined;
  }

  const groupId = groupIdsByName.get(inferred);
  if (groupId !== undefined) return groupId;
  if (BUILTIN_TARGETS.has(inferred)) return inferred;

  diagnostics.error("CFG_UNKNOWN_REFERENCE", `raw 规则 target 不存在: ${inferred}`, source);
  return undefined;
}

function expandProvider(
  reference: RawProviderReference,
  target: string,
  sourcePath: ReturnType<RawProject["modules"][number]["source"]["locate"]>,
  project: RawProject,
  diagnostics: DiagnosticCollector,
): ProviderIr | undefined {
  if ("source" in reference) {
    const sourceDefinition = project.providerSources.data.sources[reference.source];
    if (sourceDefinition === undefined) {
      diagnostics.error(
        "CFG_UNKNOWN_REFERENCE",
        `引用了未知 provider source: ${reference.source}`,
        sourcePath,
      );
      return undefined;
    }

    const templateSource = project.providerSources.source.locate(["sources", reference.source]);
    const id =
      reference.id ??
      renderTemplate(
        sourceDefinition["id-template"],
        { name: reference.name },
        new Set(["name"]),
        diagnostics,
        templateSource,
      );
    const variables = { name: reference.name, id };
    const url = renderTemplate(
      sourceDefinition["url-template"],
      variables,
      new Set(["name", "id"]),
      diagnostics,
      templateSource,
    );
    const providerPath = renderTemplate(
      sourceDefinition["path-template"],
      variables,
      new Set(["name", "id"]),
      diagnostics,
      templateSource,
    );
    validateProviderMihomo(sourceDefinition.mihomo ?? {}, diagnostics, templateSource);
    const config = makeProviderConfig(
      { ...sourceDefinition.provider, url, path: providerPath },
      sourceDefinition.mihomo ?? {},
    );
    validateProviderUrl(url, diagnostics, sourcePath);
    return {
      id,
      target,
      noResolve: reference["no-resolve"] ?? false,
      config,
    };
  }

  validateProviderMihomo(reference.mihomo ?? {}, diagnostics, sourcePath);
  const config = makeProviderConfig(reference.provider, reference.mihomo ?? {});
  if (config.type === "http" && (config.url === undefined || config.path === undefined)) {
    diagnostics.error(
      "CFG_PROVIDER_INCOMPLETE",
      `http provider ${reference.id} 必须声明 url 与 path`,
      sourcePath,
    );
  }
  if (config.type === "file" && config.path === undefined) {
    diagnostics.error(
      "CFG_PROVIDER_INCOMPLETE",
      `file provider ${reference.id} 必须声明 path`,
      sourcePath,
    );
  }
  if (
    config.type === "inline" &&
    (!Array.isArray(config.mihomo["payload"]) || config.mihomo["payload"].length === 0)
  ) {
    diagnostics.error(
      "CFG_PROVIDER_INCOMPLETE",
      `inline provider ${reference.id} 必须在 mihomo.payload 声明非空规则`,
      sourcePath,
    );
  }
  if (
    config.type !== "http" &&
    (config.url !== undefined ||
      config.interval !== undefined ||
      (config.type === "inline" && config.path !== undefined))
  ) {
    diagnostics.error(
      "CFG_PROVIDER_FIELD_INVALID",
      `${config.type} provider ${reference.id} 包含不适用的远程字段`,
      sourcePath,
    );
  }
  if (config.format === "mrs" && config.behavior === "classical") {
    diagnostics.error(
      "CFG_PROVIDER_FIELD_INVALID",
      `provider ${reference.id} 的 mrs format 不支持 classical behavior`,
      sourcePath,
    );
  }
  validateProviderUrl(config.url, diagnostics, sourcePath);
  return {
    id: reference.id,
    target,
    noResolve: reference["no-resolve"] ?? false,
    config,
  };
}

function compileRouting(
  project: RawProject,
  groups: readonly GroupIr[],
  diagnostics: DiagnosticCollector,
): RoutingCompilationResult {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const groupIds = new Set(groupsById.keys());
  const groupIdsByName = new Map(groups.map((group) => [group.name, group.id]));
  const modules = new Map<string, LoadedYaml<RawRoutingModule>>();
  const allBlocks = new Map<string, BlockReference>();

  for (const module of project.modules) {
    if (!modules.has(module.data.id)) modules.set(module.data.id, module);
    const localBlockIds = new Set<string>();
    module.data["rule-blocks"].forEach((block, blockIndex) => {
      if (localBlockIds.has(block.id)) {
        diagnostics.error(
          "CFG_DUPLICATE_ID",
          `module ${module.data.id} 内 rule block ID 重复: ${block.id}`,
          module.source.locate(["rule-blocks", blockIndex, "id"]),
        );
      }
      localBlockIds.add(block.id);
      allBlocks.set(`${module.data.id}/${block.id}`, { module, block, blockIndex });
    });
  }

  const selectedBlocks: BlockReference[] = [];
  const selectedCounts = new Map<string, number>();
  let fallbackGroup: string | undefined;
  const pipeline = project.manifest.data.routing["rule-pipeline"];

  pipeline.forEach((item, pipelineIndex) => {
    if ("fallback" in item) {
      if (fallbackGroup !== undefined) {
        diagnostics.error(
          "CFG_FALLBACK_POSITION",
          "rule-pipeline fallback 只能出现一次",
          project.manifest.source.locate(["routing", "rule-pipeline", pipelineIndex]),
        );
      }
      if (pipelineIndex !== pipeline.length - 1) {
        diagnostics.error(
          "CFG_FALLBACK_POSITION",
          "rule-pipeline fallback 必须位于末尾",
          project.manifest.source.locate(["routing", "rule-pipeline", pipelineIndex]),
        );
      }
      fallbackGroup = item.fallback;
      return;
    }

    const module = modules.get(item.module);
    if (module === undefined) {
      diagnostics.error(
        "CFG_UNKNOWN_REFERENCE",
        `rule-pipeline 引用了未知 module: ${item.module}`,
        project.manifest.source.locate(["routing", "rule-pipeline", pipelineIndex]),
      );
      return;
    }

    const blocks =
      item.block === undefined
        ? module.data["rule-blocks"].map((block, blockIndex) => ({ module, block, blockIndex }))
        : [allBlocks.get(`${item.module}/${item.block}`)].filter(
            (block): block is BlockReference => block !== undefined,
          );
    if (item.block !== undefined && blocks.length === 0) {
      diagnostics.error(
        "CFG_UNKNOWN_REFERENCE",
        `rule-pipeline 引用了未知 block: ${item.module}/${item.block}`,
        project.manifest.source.locate(["routing", "rule-pipeline", pipelineIndex]),
      );
    }

    for (const block of blocks) {
      const key = `${block.module.data.id}/${block.block.id}`;
      selectedCounts.set(key, (selectedCounts.get(key) ?? 0) + 1);
      selectedBlocks.push(block);
    }
  });

  if (fallbackGroup === undefined) {
    diagnostics.error(
      "CFG_FALLBACK_POSITION",
      "rule-pipeline 缺少末尾 fallback",
      project.manifest.source.locate(["routing", "rule-pipeline"]),
    );
    fallbackGroup = "fallback";
  }
  if (!groupIds.has(fallbackGroup)) {
    diagnostics.error(
      "CFG_UNKNOWN_REFERENCE",
      `fallback 引用了未知 group: ${fallbackGroup}`,
      project.manifest.source.locate(["routing", "rule-pipeline"]),
    );
  }

  for (const [key, block] of allBlocks) {
    const count = selectedCounts.get(key) ?? 0;
    if (count !== 1) {
      diagnostics.error(
        count === 0 ? "CFG_PIPELINE_MISSING_BLOCK" : "CFG_PIPELINE_DUPLICATE_BLOCK",
        `rule block ${key} 应精确出现一次，实际 ${String(count)} 次`,
        block.module.source.locate(["rule-blocks", block.blockIndex, "id"]),
      );
    }
  }

  const providers: ProviderIr[] = [];
  const rules: RuleIr[] = [];
  const providerIds = new Set<string>();
  const providerPaths = new Set<string>();

  for (const { module, block, blockIndex } of selectedBlocks) {
    const targetSource = module.source.locate(["rule-blocks", blockIndex, "target"]);
    if (!groupIds.has(block.target) && !BUILTIN_TARGETS.has(block.target)) {
      diagnostics.error(
        "CFG_UNKNOWN_REFERENCE",
        `rule block ${module.data.id}/${block.id} target 不存在: ${block.target}`,
        targetSource,
      );
    }

    (block.providers ?? []).forEach((reference, providerIndex) => {
      const source = module.source.locate(["rule-blocks", blockIndex, "providers", providerIndex]);
      const provider = expandProvider(reference, block.target, source, project, diagnostics);
      if (provider === undefined) return;

      if (!PROVIDER_ID_PATTERN.test(provider.id)) {
        diagnostics.error(
          "CFG_PROVIDER_ID_INVALID",
          `展开后的 provider ID 非法: ${provider.id}`,
          source,
        );
      }
      if (providerIds.has(provider.id)) {
        diagnostics.error("CFG_DUPLICATE_ID", `provider ID 重复: ${provider.id}`, source);
      }
      providerIds.add(provider.id);

      if (provider.config.path !== undefined) {
        if (providerPaths.has(provider.config.path)) {
          diagnostics.error(
            "CFG_PROVIDER_PATH_COLLISION",
            `provider path 重复: ${provider.config.path}`,
            source,
          );
        }
        providerPaths.add(provider.config.path);
      }

      providers.push(provider);
      rules.push({
        kind: "provider",
        provider: provider.id,
        target: provider.target,
        noResolve: provider.noResolve,
      });
    });

    for (const [ruleIndex, rule] of (block.rules ?? []).entries()) {
      if ("raw" in rule) {
        const source = module.source.locate(["rule-blocks", blockIndex, "rules", ruleIndex]);
        const target = compileRawRuleTarget(rule, groupsById, groupIdsByName, diagnostics, source);
        rules.push({
          kind: "raw",
          value: rule.raw,
          ...(target === undefined ? {} : { target }),
        });
      } else {
        rules.push({
          kind: "provider",
          provider: rule.provider,
          target: rule.target ?? block.target,
          noResolve: rule["no-resolve"] ?? false,
        });
      }
    }
  }

  const providerIndex = new Map(providers.map((provider, index) => [provider.id, index]));
  for (const module of project.modules) {
    for (const constraint of module.data.constraints ?? []) {
      const before = providerIndex.get(constraint.before);
      const after = providerIndex.get(constraint.after);
      if (before === undefined || after === undefined) {
        diagnostics.error(
          "CFG_UNKNOWN_REFERENCE",
          `顺序约束引用未知 provider: ${constraint.before} -> ${constraint.after}`,
          module.source.locate(["constraints"]),
        );
      } else if (before >= after) {
        diagnostics.error(
          "CFG_PIPELINE_ORDER",
          `provider 顺序约束未满足: ${constraint.before} 必须早于 ${constraint.after}`,
          module.source.locate(["constraints"]),
        );
      }
    }
  }

  for (const rule of rules) {
    if (rule.kind === "provider" && !providerIds.has(rule.provider)) {
      diagnostics.error(
        "CFG_UNKNOWN_REFERENCE",
        `规则引用未知 provider: ${rule.provider}`,
        project.manifest.source.locate(["routing", "rule-pipeline"]),
      );
    }
    if (
      rule.target !== undefined &&
      !groupIds.has(rule.target) &&
      !BUILTIN_TARGETS.has(rule.target)
    ) {
      diagnostics.error(
        "CFG_UNKNOWN_REFERENCE",
        `规则 target 不存在: ${rule.target}`,
        project.manifest.source.locate(["routing", "rule-pipeline"]),
      );
    }
  }

  return { providers, rules, fallbackGroup };
}

export { compileRouting };
export type { RoutingCompilationResult };
