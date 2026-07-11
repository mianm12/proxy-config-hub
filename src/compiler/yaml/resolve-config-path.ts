import fs from "node:fs";
import path from "node:path";

import {
  ConfigCompilationError,
  type DiagnosticSource,
} from "../../domain/diagnostics/diagnostic.js";

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== "..";
}

function pathError(code: string, message: string, source: DiagnosticSource): never {
  throw new ConfigCompilationError([{ code, severity: "error", message, source }]);
}

/**
 * 解析 manifest 中的 config 相对路径，并阻止词法越界与 symlink 越界。
 * 路径统一使用 `/`，不接受依赖运行平台解释差异的写法。
 */
function resolveConfigPath(
  configRoot: string,
  requestedPath: string,
  source: DiagnosticSource,
): string {
  if (
    requestedPath.length === 0 ||
    requestedPath.includes("\\") ||
    requestedPath.includes("\0") ||
    path.posix.isAbsolute(requestedPath) ||
    path.win32.isAbsolute(requestedPath) ||
    requestedPath.split("/").includes("..")
  ) {
    pathError("CFG_PATH_INVALID", `config source 路径非法: ${requestedPath}`, source);
  }

  const absoluteRoot = path.resolve(configRoot);
  const candidate = path.resolve(absoluteRoot, requestedPath);
  if (!isInside(absoluteRoot, candidate)) {
    pathError("CFG_PATH_OUTSIDE_ROOT", `config source 越界: ${requestedPath}`, source);
  }

  if (fs.existsSync(candidate)) {
    const realRoot = fs.realpathSync(absoluteRoot);
    const realCandidate = fs.realpathSync(candidate);
    if (!isInside(realRoot, realCandidate)) {
      pathError(
        "CFG_PATH_SYMLINK_OUTSIDE_ROOT",
        `config source 通过 symlink 越界: ${requestedPath}`,
        source,
      );
    }
  }

  return candidate;
}

export { resolveConfigPath };
