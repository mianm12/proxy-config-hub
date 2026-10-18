import { parse } from "yaml";
import { z } from "zod";

import type { ProjectIr } from "../compiler/ir/project-ir.ts";
import { compileOverride } from "../runtime/override/index.ts";
import type { OverrideResult } from "../runtime/override/types.ts";

const nodeSchema = z.looseObject({
  name: z.string().refine((value) => value.trim().length > 0),
  type: z.string().refine((value) => value.trim().length > 0),
});
const inputSchema = z.object({ proxies: z.array(nodeSchema).min(1) });

class ConfigGenerationError extends Error {}

function compileStandaloneConfig(text: string, project: ProjectIr): OverrideResult {
  let input: unknown;
  try {
    input = parse(text, { maxAliasCount: 0, prettyErrors: false }) as unknown;
  } catch {
    throw new ConfigGenerationError("输入 YAML 无效，或包含不支持的别名；原始内容未输出");
  }
  const result = inputSchema.safeParse(input);
  if (!result.success) {
    throw new ConfigGenerationError("输入必须包含非空 proxies 列表，每个节点须有非空 name 和 type");
  }
  const names = result.data.proxies.map(({ name }) => name);
  if (new Set(names).size !== names.length) {
    throw new ConfigGenerationError("输入节点存在重名，请先完成节点重命名");
  }

  try {
    // 只提取节点，所有运行配置均来自同一份业务 YAML 和 override 装配器。
    return compileOverride(result.data, project);
  } catch {
    throw new ConfigGenerationError("节点装配失败，请检查节点与策略组引用；原始节点内容未输出");
  }
}

export { compileStandaloneConfig, ConfigGenerationError };
