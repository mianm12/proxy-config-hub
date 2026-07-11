import type { RuntimeSectionIr } from "../ir/project-ir.ts";
import type { RawProject } from "../load-raw-project.ts";
import type { DiagnosticCollector } from "./diagnostic-collector.ts";

const DYNAMIC_OUTPUT_KEYS = new Set(["proxies", "proxy-groups", "rule-providers", "rules"]);

function compileRuntimePlan(
  project: RawProject,
  diagnostics: DiagnosticCollector,
): readonly RuntimeSectionIr[] {
  const loadedByIndex = new Map(project.runtime.map((loaded) => [loaded.manifestIndex, loaded]));
  const seenTargets = new Set<string>();
  const rootKeys = new Set(
    project.runtime
      .filter(
        ({ manifestIndex }) => project.manifest.data.runtime[manifestIndex]?.target === "root",
      )
      .flatMap(({ data }) => Object.keys(data)),
  );

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
    if (item.target !== "root" && rootKeys.has(item.target)) {
      diagnostics.error(
        "CFG_DUPLICATE_ID",
        `runtime target ${item.target} 已在 root source 中声明`,
        project.manifest.source.locate(["runtime", index, "target"]),
      );
    }

    if (item.apply === "overlay" && item.target !== "root") {
      diagnostics.error("CFG_RUNTIME_APPLY_INVALID", "overlay 只允许用于 root target", source);
    }
    if (item.apply === "replace" && item.target === "root") {
      diagnostics.error("CFG_RUNTIME_APPLY_INVALID", "root target 不允许 replace", source);
    }
    if ("value" in item && item.apply !== "if-absent") {
      diagnostics.error("CFG_RUNTIME_APPLY_INVALID", "runtime value item 只允许 if-absent", source);
    }
    if (DYNAMIC_OUTPUT_KEYS.has(item.target)) {
      diagnostics.error(
        "CFG_RUNTIME_OWNED_FIELD",
        `runtime 不得覆盖动态装配字段: ${item.target}`,
        project.manifest.source.locate(["runtime", index, "target"]),
      );
    }

    const loaded = loadedByIndex.get(index);
    const value = "source" in item ? loaded?.data : item.value;
    if (value === undefined) {
      diagnostics.error("CFG_UNKNOWN_REFERENCE", "runtime source 未加载", source);
    }
    if (item.target === "root" && loaded !== undefined) {
      for (const key of Object.keys(loaded.data)) {
        if (!DYNAMIC_OUTPUT_KEYS.has(key)) continue;
        diagnostics.error(
          "CFG_RUNTIME_OWNED_FIELD",
          `runtime root 不得声明动态装配字段: ${key}`,
          loaded.source.locate([key]),
        );
      }
    }

    return { target: item.target, apply: item.apply, value };
  });
}

export { compileRuntimePlan };
