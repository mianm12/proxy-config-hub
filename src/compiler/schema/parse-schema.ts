import { z } from "zod";

import { ConfigCompilationError, type Diagnostic } from "../../domain/diagnostics/diagnostic.js";
import type { SourcePath, YamlSource } from "../yaml/yaml-source.js";

function issuePath(issue: z.core.$ZodIssue): SourcePath {
  const base = issue.path.filter(
    (segment): segment is string | number =>
      typeof segment === "string" || typeof segment === "number",
  );

  if (issue.code === "unrecognized_keys") {
    const firstKey = issue.keys[0];
    if (firstKey !== undefined) {
      return [...base, firstKey];
    }
  }

  return base;
}

/** 使用指定 raw schema 解析 YAML，并把 Zod issue 映射回 YAML 字段位置。 */
function parseYamlSchema<T>(source: YamlSource, schema: z.ZodType<T>): T {
  const result = schema.safeParse(source.value);
  if (result.success) {
    return result.data;
  }

  const diagnostics: Diagnostic[] = result.error.issues.map((issue) => ({
    code: "CFG_SCHEMA_INVALID",
    severity: "error",
    message: issue.message,
    source: source.locate(issuePath(issue)),
    context: { issueCode: issue.code },
  }));

  throw new ConfigCompilationError(diagnostics);
}

export { parseYamlSchema };
