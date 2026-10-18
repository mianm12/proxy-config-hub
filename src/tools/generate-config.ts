import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { stringify } from "yaml";

import { CONFIG_ROOT, REPO_ROOT } from "../build/paths.ts";
import { compileProject } from "../compiler/compile-project.ts";
import { compileStandaloneConfig, ConfigGenerationError } from "./standalone-config.ts";

function resolveOutput(outputFile: string): string {
  let parent: string;
  try {
    parent = fs.realpathSync(path.dirname(path.resolve(outputFile)));
  } catch {
    throw new ConfigGenerationError("输出目录必须已存在且可访问");
  }
  const target = path.join(parent, path.basename(outputFile));
  const relative = path.relative(fs.realpathSync(REPO_ROOT), target);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
    throw new ConfigGenerationError("完整配置可能包含节点凭据，输出必须位于仓库之外");
  }
  return target;
}

function writePrivateConfig(target: string, yaml: string): void {
  let staging: string | undefined;
  try {
    staging = fs.mkdtempSync(path.join(path.dirname(target), ".mihomo-config-"));
    const temporary = path.join(staging, "config.yaml");
    fs.writeFileSync(temporary, yaml, { encoding: "utf8", mode: 0o600, flag: "wx" });
    // 同目录硬链接发布完整文件：目标已存在时失败，绝不截断或覆盖。
    fs.linkSync(temporary, target);
  } catch {
    throw new ConfigGenerationError("无法写入完整配置：目标不得已存在，目录须可写且支持硬链接");
  } finally {
    if (staging !== undefined) fs.rmSync(staging, { recursive: true, force: true });
  }
}

function generateConfig(
  inputFile: string,
  outputFile: string,
): { path: string; warnings: readonly string[] } {
  const target = resolveOutput(outputFile);
  if (fs.existsSync(target)) throw new ConfigGenerationError("输出文件已存在，请使用新的输出路径");
  let text: string;
  try {
    text = fs.readFileSync(inputFile, "utf8");
  } catch {
    throw new ConfigGenerationError("无法读取节点文件，请检查输入路径与权限");
  }
  const result = compileStandaloneConfig(text, compileProject(CONFIG_ROOT));
  writePrivateConfig(target, stringify(result.config, { lineWidth: 0 }));
  return { path: target, warnings: result.diagnostics.map(({ code }) => code) };
}

function main(args: string[]): number {
  let values;
  try {
    ({ values } = parseArgs({
      args,
      options: {
        input: { type: "string" },
        output: { type: "string" },
        help: { type: "boolean" },
      },
    }));
  } catch {
    console.error(
      "参数无效。用法：npm run config:generate -- --input /路径/nodes.yaml --output /路径/config.yaml",
    );
    return 1;
  }
  if (values.help === true) {
    console.log(
      "用法：npm run config:generate -- --input /路径/nodes.yaml --output /仓库外路径/config.yaml\n只读取 proxies，输出目录须存在，拒绝覆盖已有文件；不启动内核。",
    );
    return 0;
  }
  if (values.input === undefined || values.output === undefined) {
    console.error(
      "必须同时指定 --input 与 --output；运行 npm run config:generate -- --help 查看用法",
    );
    return 1;
  }
  try {
    const result = generateConfig(values.input, values.output);
    console.log(`完整配置已生成：${result.path}`);
    for (const code of result.warnings) console.warn(`配置装配警告：${code}`);
    return 0;
  } catch (error) {
    console.error(
      error instanceof ConfigGenerationError
        ? error.message
        : "生成失败；业务配置请运行 npm run config:check 检查，原始节点内容未输出",
    );
    return 1;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));

export { generateConfig, main };
