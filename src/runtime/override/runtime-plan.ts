import type { RuntimeSectionIr } from "../../compiler/ir/project-ir.ts";
import { cloneValue } from "./value-utils.ts";

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

    if (section.apply === "if-absent" && output[section.target] !== undefined) continue;
    output[section.target] = cloneValue(section.value);
  }

  return output;
}

export { applyRuntimePlan };
