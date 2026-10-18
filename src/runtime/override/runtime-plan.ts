import type { RuntimeSectionIr } from "../../compiler/ir/project-ir.ts";
import { ConfigCompilationError } from "../../domain/diagnostics/diagnostic.ts";
import { cloneValue, isRecord } from "./value-utils.ts";

function fillAbsentFields(target: string, existing: unknown, defaults: unknown): unknown {
  if (!isRecord(existing) || !isRecord(defaults)) {
    throw new ConfigCompilationError([
      {
        code: "OVERRIDE_RUNTIME_SECTION_INVALID",
        severity: "error",
        message: `配置节 ${target} 必须是对象，才能按字段补全`,
      },
    ]);
  }

  const output = { ...existing };
  for (const [key, value] of Object.entries(defaults)) {
    if (output[key] === undefined) output[key] = cloneValue(value);
  }
  return output;
}

function applyRuntimePlan(
  input: Readonly<Record<string, unknown>>,
  runtimePlan: readonly RuntimeSectionIr[],
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...input };

  for (const section of runtimePlan) {
    if (section.target === "root") {
      const root = section.value as Readonly<Record<string, unknown>>;
      for (const [key, value] of Object.entries(root)) output[key] = cloneValue(value);
      continue;
    }

    if (section.apply === "if-absent" && output[section.target] !== undefined) {
      if (section.perField === true) {
        output[section.target] = fillAbsentFields(
          section.target,
          output[section.target],
          section.value,
        );
      }
      continue;
    }
    output[section.target] = cloneValue(section.value);
  }

  return output;
}

export { applyRuntimePlan };
