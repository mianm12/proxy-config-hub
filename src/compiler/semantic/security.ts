import type { LoadedYaml, RawProject } from "../load-raw-project.ts";
import type { DiagnosticCollector } from "./diagnostic-collector.ts";

const SENSITIVE_KEY =
  /^(?:access[_-]?key|access[_-]?token|api[_-]?key|authorization|client[_-]?secret|cookie|password|private[_-]?key|secret|token)$/i;
const SENSITIVE_QUERY_KEY =
  /^(?:access[_-]?key|access[_-]?token|api[_-]?key|apikey|auth|authorization|client[_-]?secret|password|private[_-]?key|secret|signature|token)$/i;

function hasSensitiveValue(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function scanValue(
  loaded: LoadedYaml<unknown>,
  value: unknown,
  path: readonly (string | number)[],
  diagnostics: DiagnosticCollector,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      scanValue(loaded, item, [...path, index], diagnostics);
    });
    return;
  }
  if (typeof value === "string" && /^https?:\/\//iu.test(value)) {
    try {
      const url = new URL(value);
      if (url.username !== "" || url.password !== "") {
        diagnostics.error(
          "CFG_SECRET_LIKE_URL",
          "公开 URL 不得包含凭据",
          loaded.source.locate(path),
        );
      }
      for (const key of url.searchParams.keys()) {
        if (!SENSITIVE_QUERY_KEY.test(key)) continue;
        diagnostics.error(
          "CFG_SECRET_LIKE_URL",
          `公开 URL 包含疑似凭据 query: ${key}`,
          loaded.source.locate(path),
        );
      }
    } catch {
      // URL 的结构合法性由对应领域 schema/semantic validator 负责。
    }
  }
  if (value === null || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    if (SENSITIVE_KEY.test(key) && hasSensitiveValue(child)) {
      diagnostics.error(
        "CFG_SECRET_LIKE_VALUE",
        `公开配置不得包含非空敏感字段: ${key}`,
        loaded.source.locate(childPath),
      );
    }
    scanValue(loaded, child, childPath, diagnostics);
  }
}

function validateNoSecrets(project: RawProject, diagnostics: DiagnosticCollector): void {
  const loadedFiles: readonly LoadedYaml<unknown>[] = [
    project.manifest,
    ...project.runtime,
    project.nodeCatalog,
    project.routingRegions,
    project.chains,
    project.groupTemplates,
    project.providerSources,
    ...project.modules,
    project.renameProfiles,
  ];

  for (const loaded of loadedFiles) scanValue(loaded, loaded.data, [], diagnostics);
}

export { validateNoSecrets };
