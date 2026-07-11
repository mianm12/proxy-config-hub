import type { RuntimeSectionIr } from "../ir/project-ir.ts";
import type { RawProject } from "../load-raw-project.ts";
import type { DiagnosticCollector } from "./diagnostic-collector.ts";

function compileRuntimePlan(
  project: RawProject,
  diagnostics: DiagnosticCollector,
): readonly RuntimeSectionIr[] {
  const loadedByIndex = new Map(
    project.runtime.map((loaded) => [loaded.manifestIndex, loaded.data]),
  );
  const seenTargets = new Set<string>();

  return project.manifest.data.runtime.map((item, index) => {
    const source = project.manifest.source.locate(["runtime", index]);
    if (seenTargets.has(item.target)) {
      diagnostics.error(
        "CFG_DUPLICATE_ID",
        `runtime target 重复: ${item.target}`,
        project.manifest.source.locate(["runtime", index, "target"]),
      );
    }
    seenTargets.add(item.target);

    if (item.apply === "overlay" && item.target !== "root") {
      diagnostics.error("CFG_RUNTIME_APPLY_INVALID", "overlay 只允许用于 root target", source);
    }
    if (item.apply === "replace" && item.target === "root") {
      diagnostics.error("CFG_RUNTIME_APPLY_INVALID", "root target 不允许 replace", source);
    }
    if ("value" in item && item.apply !== "if-absent") {
      diagnostics.error("CFG_RUNTIME_APPLY_INVALID", "runtime value item 只允许 if-absent", source);
    }

    const value = "source" in item ? loadedByIndex.get(index) : item.value;
    if (value === undefined) {
      diagnostics.error("CFG_UNKNOWN_REFERENCE", "runtime source 未加载", source);
    }

    return { target: item.target, apply: item.apply, value };
  });
}

export { compileRuntimePlan };
