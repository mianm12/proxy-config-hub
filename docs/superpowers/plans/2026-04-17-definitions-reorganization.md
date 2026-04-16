# definitions/ 目录重组实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `definitions/` 顶层切成"按产出"的三个语义目录（`mihomo-preset/`、`proxy-groups/`、`rules/`）外加一个非装配资产目录（`assets/`），同步重写编译产物路径与所有 import；移除 legacy `rules/` 兜底与 `verify-yaml-migration.js`。

**Architecture:** 纯结构重组，运行时行为零改变。源 YAML 移动 → `tools/lib/paths.js` 命名空间重定义 → `tools/yaml-to-js.js` 删 legacy 分支 → `scripts/override/*` import 路径批量更新 → 验证脚本删除 migration、调整 custom 资产断言 → 文档更新。验收以 `npm run verify` + `npm run example:config` 字节级等价为准。

**Tech Stack:** Node.js >= 24, ESM, esbuild, js-yaml；无新增依赖。

参考规范：`docs/superpowers/specs/2026-04-17-definitions-reorganization-design.md`

---

## 关键约束（贯穿全程）

- `dist/example-full-config.yaml` 必须与重组前**字节级等价**。先在重组前固化基线，最后比对。
- `scripts/config/` 是 git-tracked 产物；旧路径下的 `.js` 文件必须用 `git rm` 显式移除，否则会留在仓库里。
- `definitions/` 目录改动 + `tools/lib/paths.js` 改动 + `tools/yaml-to-js.js` 改动必须在同一 commit 完成才能让 `npm run rules:build` 通过；本计划允许这一段是单个较大的原子 commit。
- 每完成一组改动后运行 `npm run verify` 是发现遗漏 import 的最快路径。

---

## Task 0: 固化基线产物（用于最后字节级比对）

**Files:**
- Create: `/tmp/baseline-example-full-config.yaml`（一次性临时文件，不入库）

- [ ] **Step 1: 重新生成当前 main 上的示例配置作为基线**

```bash
cd /Users/ghstlnx/Workspace/proxy-config-hub/.claude/worktrees/condescending-mirzakhani-fdf425
npm run example:config
cp dist/example-full-config.yaml /tmp/baseline-example-full-config.yaml
wc -l /tmp/baseline-example-full-config.yaml
```

预期：`dist/example-full-config.yaml` 已生成，`wc -l` 输出非零行数。

- [ ] **Step 2: 不要 commit。这是只读基线，最后 §10 比对时用**

---

## Task 1: 移动 `definitions/` 源 YAML 到新结构

**Files (move):**
- `definitions/runtime/base.yaml` → `definitions/mihomo-preset/base.yaml`
- `definitions/runtime/dns.yaml` → `definitions/mihomo-preset/dns.yaml`
- `definitions/runtime/geodata.yaml` → `definitions/mihomo-preset/geodata.yaml`
- `definitions/runtime/profile.yaml` → `definitions/mihomo-preset/profile.yaml`
- `definitions/runtime/sniffer.yaml` → `definitions/mihomo-preset/sniffer.yaml`
- `definitions/runtime/tun.yaml` → `definitions/mihomo-preset/tun.yaml`
- `definitions/runtime/chains.yaml` → `definitions/proxy-groups/chains.yaml`
- `definitions/runtime/placeholders.yaml` → `definitions/proxy-groups/placeholders.yaml`
- `definitions/runtime/regions.yaml` → `definitions/proxy-groups/regions.yaml`
- `definitions/rules/registry/groupDefinitions.yaml` → `definitions/proxy-groups/groupDefinitions.yaml`
- `definitions/rules/registry/inlineRules.yaml` → `definitions/rules/inlineRules.yaml`
- `definitions/rules/registry/ruleProviders.yaml` → `definitions/rules/ruleProviders.yaml`
- `definitions/rules/custom/_template.yaml` → `definitions/assets/custom/_template.yaml`

**Files (rmdir, must end up empty):**
- `definitions/runtime/`
- `definitions/rules/registry/`
- `definitions/rules/custom/`

- [ ] **Step 1: 创建新目录并 git mv 全部 YAML**

```bash
mkdir -p definitions/mihomo-preset definitions/proxy-groups definitions/assets/custom

git mv definitions/runtime/base.yaml      definitions/mihomo-preset/base.yaml
git mv definitions/runtime/dns.yaml       definitions/mihomo-preset/dns.yaml
git mv definitions/runtime/geodata.yaml   definitions/mihomo-preset/geodata.yaml
git mv definitions/runtime/profile.yaml   definitions/mihomo-preset/profile.yaml
git mv definitions/runtime/sniffer.yaml   definitions/mihomo-preset/sniffer.yaml
git mv definitions/runtime/tun.yaml       definitions/mihomo-preset/tun.yaml

git mv definitions/runtime/chains.yaml        definitions/proxy-groups/chains.yaml
git mv definitions/runtime/placeholders.yaml  definitions/proxy-groups/placeholders.yaml
git mv definitions/runtime/regions.yaml       definitions/proxy-groups/regions.yaml
git mv definitions/rules/registry/groupDefinitions.yaml definitions/proxy-groups/groupDefinitions.yaml

git mv definitions/rules/registry/inlineRules.yaml   definitions/rules/inlineRules.yaml
git mv definitions/rules/registry/ruleProviders.yaml definitions/rules/ruleProviders.yaml

git mv definitions/rules/custom/_template.yaml definitions/assets/custom/_template.yaml
```

- [ ] **Step 2: 删除留下的空目录（git mv 不会自动清理）**

```bash
rmdir definitions/runtime definitions/rules/registry definitions/rules/custom
```

- [ ] **Step 3: 校验新结构**

```bash
ls definitions/
ls definitions/mihomo-preset/
ls definitions/proxy-groups/
ls definitions/rules/
ls definitions/assets/custom/
```

预期输出（顺序无关）：
- `definitions/`：`assets`、`mihomo-preset`、`proxy-groups`、`rules`
- `mihomo-preset/`：6 个 yaml（base/dns/geodata/profile/sniffer/tun）
- `proxy-groups/`：4 个 yaml（chains/groupDefinitions/placeholders/regions）
- `rules/`：2 个 yaml（inlineRules/ruleProviders）
- `assets/custom/`：`_template.yaml`

- [ ] **Step 4: 暂不 commit，与 Task 2、Task 3 合并为一个原子 commit（构建必须能通过）**

---

## Task 2: 重写 `tools/lib/paths.js`

**Files:**
- Modify: `tools/lib/paths.js`（整体替换 namespaces / COPY_ASSETS / 常量集合）

- [ ] **Step 1: 替换文件内容**

把 `tools/lib/paths.js` 中以下区块整段改写：

第 35 行 `RULE_PROVIDERS_YAML_PATH`：

```js
const RULE_PROVIDERS_YAML_PATH = resolve("definitions", "rules", "ruleProviders.yaml");
```

第 42-45 行 `COPY_ASSETS`：

```js
const COPY_ASSETS = [
  { source: resolve("definitions", "assets", "custom"), target: resolve("dist", "assets", "custom") },
  { source: resolve("scripts", "sub-store"), target: resolve("dist", "scripts", "sub-store") },
];
```

第 52-65 行 `CANONICAL_NAMESPACES`：

```js
const CANONICAL_NAMESPACES = [
  {
    name: "mihomo-preset",
    type: "directory",
    sourceSubdir: "mihomo-preset",
    outputSubdir: "mihomo-preset",
  },
  {
    name: "proxy-groups",
    type: "directory",
    sourceSubdir: "proxy-groups",
    outputSubdir: "proxy-groups",
  },
  {
    name: "rules",
    type: "directory",
    sourceSubdir: "rules",
    outputSubdir: "rules",
  },
];
```

第 71-78 行 `LEGACY_NAMESPACES`：**整段删除**。

第 84 行 `LEGACY_ROOT_NAME`：**整段删除**。

第 90 行 `CANONICAL_TOP_LEVEL_NAMES`：

```js
const CANONICAL_TOP_LEVEL_NAMES = new Set(["mihomo-preset", "proxy-groups", "rules", "assets"]);
```

第 93 行 `CANONICAL_RULES_NAMES`：**整段删除**。

第 96 行 `LEGACY_ALLOWED_ENTRIES`：**整段删除**。

第 98-116 行 `export {}` 块，删除 `LEGACY_NAMESPACES`、`LEGACY_ROOT_NAME`、`CANONICAL_RULES_NAMES`、`LEGACY_ALLOWED_ENTRIES` 四个导出名。最终 export 列表：

```js
export {
  REPO_ROOT,
  resolve,
  DEFINITIONS_DIR,
  SCRIPTS_CONFIG_DIR,
  BUNDLE_PATH,
  TEMPLATE_PATH,
  DEFAULT_EXAMPLE_OUTPUT_PATH,
  RULE_PROVIDERS_YAML_PATH,
  COPY_ASSETS,
  CANONICAL_NAMESPACES,
  CANONICAL_ROOT_NAME,
  GENERATED_ROOT_NAME,
  CANONICAL_TOP_LEVEL_NAMES,
};
```

- [ ] **Step 2: 验证语法**

```bash
node --check tools/lib/paths.js
```

预期：无输出（语法正确）。

---

## Task 3: 简化 `tools/yaml-to-js.js`

**Files:**
- Modify: `tools/yaml-to-js.js`

- [ ] **Step 1: 更新顶部 import（删除已不存在的导出名）**

把第 7-16 行 import 改为：

```js
import {
  CANONICAL_NAMESPACES,
  CANONICAL_ROOT_NAME,
  GENERATED_ROOT_NAME,
  CANONICAL_TOP_LEVEL_NAMES,
} from "./lib/paths.js";
```

（去掉 `LEGACY_NAMESPACES`、`LEGACY_ROOT_NAME`、`CANONICAL_RULES_NAMES`、`LEGACY_ALLOWED_ENTRIES`。）

- [ ] **Step 2: 简化 `validateCanonicalLayout`**

把第 53-71 行整个函数改为：

```js
/**
 * 校验 canonical（definitions/）布局的目录结构是否合法。
 * @param {string} rootDir - definitions/ 根目录的绝对路径。
 * @returns {Promise<void>}
 */
async function validateCanonicalLayout(rootDir) {
  const rootEntries = await listEntries(rootDir);

  for (const entry of rootEntries) {
    if (!CANONICAL_TOP_LEVEL_NAMES.has(entry.name)) {
      throw new Error(`definitions/ 下存在不支持的条目: ${entry.name}`);
    }
  }
}
```

- [ ] **Step 3: 删除 `validateLegacyLayout` 函数**

删除第 73-86 行整个函数（含上方 JSDoc）。

- [ ] **Step 4: 简化 `resolveSourceTree`**

把第 88-125 行整个函数改为：

```js
/**
 * 探测并返回当前工作目录下的源定义树信息。
 * @param {string} cwd - 项目根目录。
 * @returns {Promise<{kind: string, rootDir: string, namespaces: object[]}>}
 */
async function resolveSourceTree(cwd) {
  const canonicalRoot = path.join(cwd, CANONICAL_ROOT_NAME);

  if (!(await pathExists(canonicalRoot))) {
    throw new Error("未找到 definitions/ 源定义树");
  }

  await validateCanonicalLayout(canonicalRoot);
  return {
    kind: "canonical",
    rootDir: canonicalRoot,
    namespaces: CANONICAL_NAMESPACES,
  };
}
```

- [ ] **Step 5: 更新 `buildYamlModules` 中的 namespace 默认与清理列表**

第 192-209 行（`buildYamlModules` 函数体起始至 `Promise.all` 块结束）。把：

```js
  const activeTree = await resolveSourceTree(cwd);
  const required = new Set(
    requiredNamespaces ?? (activeTree.kind === "canonical" ? ["rules", "runtime"] : ["rules"]),
  );

  if (activeTree.warning) {
    log(activeTree.warning);
  }

  await Promise.all(
    ["rules", "runtime"].map((namespaceName) =>
      fs.rm(path.join(cwd, GENERATED_ROOT_NAME, namespaceName), {
        recursive: true,
        force: true,
      }),
    ),
  );
```

改为：

```js
  const activeTree = await resolveSourceTree(cwd);
  const required = new Set(
    requiredNamespaces ?? ["mihomo-preset", "proxy-groups", "rules"],
  );

  // 清理本次会重建的命名空间产物，以及历史遗留的 runtime/ 目录。
  await Promise.all(
    ["mihomo-preset", "proxy-groups", "rules", "runtime"].map((namespaceName) =>
      fs.rm(path.join(cwd, GENERATED_ROOT_NAME, namespaceName), {
        recursive: true,
        force: true,
      }),
    ),
  );
```

> 说明：清理列表里保留 `runtime` 一项，是为了在第一次跑 `rules:build` 时把已被 git 追踪的旧 `scripts/config/runtime/*.js` 一并 `fs.rm` 掉（之后 Task 4 还会用 `git rm` 把它们从索引里移除）。

- [ ] **Step 6: 验证语法**

```bash
node --check tools/yaml-to-js.js
```

预期：无输出。

---

## Task 4: 重新生成 `scripts/config/` 并清理旧产物

**Files (auto-generated, will appear after build):**
- Create via build: `scripts/config/mihomo-preset/{base,dns,geodata,profile,sniffer,tun}.js`
- Create via build: `scripts/config/proxy-groups/{chains,groupDefinitions,placeholders,regions}.js`
- Create via build: `scripts/config/rules/{inlineRules,ruleProviders}.js`

**Files (delete from git index after build):**
- 旧 `scripts/config/runtime/*.js`（9 个）
- 旧 `scripts/config/rules/{groupDefinitions,inlineRules,ruleProviders}.js`（3 个，将在新位置重建，但由于 outputSubdir 仍然是 `rules`，`inlineRules.js` 和 `ruleProviders.js` 实际位置不变，需要 diff 内容；`groupDefinitions.js` 在 rules/ 下不再生成，搬到 proxy-groups/）

- [ ] **Step 1: 跑构建**

```bash
npm run rules:build
```

预期日志：12 条 "已转换" 行；末尾 "完成，共转换 12 个文件。"

- [ ] **Step 2: 校验生成产物**

```bash
ls scripts/config/
ls scripts/config/mihomo-preset/
ls scripts/config/proxy-groups/
ls scripts/config/rules/
test ! -d scripts/config/runtime && echo OK_no_runtime || echo FAIL_runtime_exists
test ! -d scripts/config/assets && echo OK_no_assets || echo FAIL_assets_exists
```

预期：
- `scripts/config/`：`mihomo-preset`、`proxy-groups`、`rules`（无 runtime、无 assets）
- `mihomo-preset/`：6 个 .js
- `proxy-groups/`：4 个 .js
- `rules/`：`inlineRules.js`、`ruleProviders.js`（**注意：`groupDefinitions.js` 不在这里**）
- 两条 OK_

- [ ] **Step 3: 把不再生成的旧文件从 git 索引中删除**

```bash
# rules/groupDefinitions.js 已搬到 proxy-groups/
git rm -f scripts/config/rules/groupDefinitions.js 2>/dev/null || true

# 整个 runtime/ 目录已被 fs.rm 清理；从 git 索引里移除
git rm -rf scripts/config/runtime 2>/dev/null || true
```

- [ ] **Step 4: 检查 git status，确认新增/删除/修改集合合理**

```bash
git status --short scripts/config/
```

预期：
- `D scripts/config/rules/groupDefinitions.js`
- `D scripts/config/runtime/*.js`（9 个）
- `?? scripts/config/mihomo-preset/`（6 个新）
- `?? scripts/config/proxy-groups/`（4 个新）
- `M scripts/config/rules/inlineRules.js`、`scripts/config/rules/ruleProviders.js`（如果格式化或顺序碰巧一致也可能没有 `M`，无需关心）

- [ ] **Step 5: 暂不 commit。下一个 Task 更新 import 后才能跑 verify。**

---

## Task 5: 更新 `scripts/override/**` 与 `tools/verify-main.js` 的 import 路径

**Files:**
- Modify: `scripts/override/main.js`（4 处 import）
- Modify: `scripts/override/lib/runtime-preset.js`（6 处 import）
- Modify: `scripts/override/lib/proxy-groups.js`（2 处 import）
- Modify: `tools/verify-main.js`（9 处 import）

按下表替换字符串（每个文件都是字面量替换，`replace_all` 可一次完成）：

| 旧 import | 新 import |
| --- | --- |
| `"../config/runtime/base.js"` | `"../config/mihomo-preset/base.js"` |
| `"../config/runtime/dns.js"` | `"../config/mihomo-preset/dns.js"` |
| `"../config/runtime/sniffer.js"` | `"../config/mihomo-preset/sniffer.js"` |
| `"../config/runtime/tun.js"` | `"../config/mihomo-preset/tun.js"` |
| `"../config/runtime/profile.js"` | `"../config/mihomo-preset/profile.js"` |
| `"../config/runtime/geodata.js"` | `"../config/mihomo-preset/geodata.js"` |
| `"../config/runtime/regions.js"` | `"../config/proxy-groups/regions.js"` |
| `"../config/runtime/placeholders.js"` | `"../config/proxy-groups/placeholders.js"` |
| `"../config/runtime/chains.js"` | `"../config/proxy-groups/chains.js"` |
| `"../config/rules/groupDefinitions.js"` | `"../config/proxy-groups/groupDefinitions.js"` |

`runtime-preset.js` 与 `proxy-groups.js` 在 `lib/` 子目录下，相对路径要多一级 `../`：

| `runtime-preset.js` / `proxy-groups.js` 旧 import | 新 import |
| --- | --- |
| `"../../config/runtime/base.js"` | `"../../config/mihomo-preset/base.js"` |
| `"../../config/runtime/dns.js"` | `"../../config/mihomo-preset/dns.js"` |
| `"../../config/runtime/geodata.js"` | `"../../config/mihomo-preset/geodata.js"` |
| `"../../config/runtime/profile.js"` | `"../../config/mihomo-preset/profile.js"` |
| `"../../config/runtime/sniffer.js"` | `"../../config/mihomo-preset/sniffer.js"` |
| `"../../config/runtime/tun.js"` | `"../../config/mihomo-preset/tun.js"` |
| `"../../config/runtime/regions.js"` | `"../../config/proxy-groups/regions.js"` |
| `"../../config/runtime/placeholders.js"` | `"../../config/proxy-groups/placeholders.js"` |

`tools/verify-main.js` 在 `tools/` 下，相对路径以 `../scripts/...` 起头：

| `verify-main.js` 旧 import | 新 import |
| --- | --- |
| `"../scripts/config/runtime/base.js"` | `"../scripts/config/mihomo-preset/base.js"` |
| `"../scripts/config/runtime/dns.js"` | `"../scripts/config/mihomo-preset/dns.js"` |
| `"../scripts/config/runtime/geodata.js"` | `"../scripts/config/mihomo-preset/geodata.js"` |
| `"../scripts/config/runtime/profile.js"` | `"../scripts/config/mihomo-preset/profile.js"` |
| `"../scripts/config/runtime/sniffer.js"` | `"../scripts/config/mihomo-preset/sniffer.js"` |
| `"../scripts/config/runtime/tun.js"` | `"../scripts/config/mihomo-preset/tun.js"` |
| `"../scripts/config/rules/groupDefinitions.js"` | `"../scripts/config/proxy-groups/groupDefinitions.js"` |

- [ ] **Step 1: 更新 `scripts/override/main.js`**

逐字面量替换上述适用 9 项 import（main.js 在 `scripts/override/` 下，相对路径以 `../config/...` 起头）。
当前需要改的具体行：

```
1:  import ruleProvidersConfig from "../config/rules/ruleProviders.js";        // ← 不变
2:  import groupDefinitionsConfig from "../config/rules/groupDefinitions.js";  // ← 改为 proxy-groups
3:  import inlineRulesConfig from "../config/rules/inlineRules.js";            // ← 不变
4:  import chainsConfig from "../config/runtime/chains.js";                    // ← 改为 proxy-groups
```

只需改第 2 行和第 4 行。

- [ ] **Step 2: 更新 `scripts/override/lib/runtime-preset.js`**

把 6 行 `../../config/runtime/{base,dns,geodata,profile,sniffer,tun}.js` 全部改成 `../../config/mihomo-preset/...`。

- [ ] **Step 3: 更新 `scripts/override/lib/proxy-groups.js`**

把 2 行 `../../config/runtime/{regions,placeholders}.js` 改成 `../../config/proxy-groups/...`。

- [ ] **Step 4: 更新 `tools/verify-main.js` 的 imports**

把第 4-12 行的 import 按上表更新。`ruleProviders` / `inlineRules` 两行**保持不变**（rules/ 下文件未移动）。

- [ ] **Step 5: 同时更新 verify-main.js 中的硬编码路径检查与 custom 资产路径**

第 184-195 行 `assertCustomAssetCopy()`：把：

```js
  const sourcePath = path.join(REPO_ROOT, "definitions", "rules", "custom", "_template.yaml");
  const distPath = path.join(REPO_ROOT, "dist", "rules", "custom", "_template.yaml");
```

改为：

```js
  const sourcePath = path.join(REPO_ROOT, "definitions", "assets", "custom", "_template.yaml");
  const distPath = path.join(REPO_ROOT, "dist", "assets", "custom", "_template.yaml");
```

并把 JSDoc 中的 "definitions/rules/custom" 改为 "definitions/assets/custom"。

第 178-180 行 `assertGeneratedFiles()` 末尾的旧断言：

```js
  assert.ok(
    !fs.existsSync(path.join(SCRIPTS_CONFIG_DIR, "rules", "custom", "_template.js")),
    "custom 模板不得被转换到 scripts/config",
  );
```

替换为：

```js
  assert.ok(
    !fs.existsSync(path.join(SCRIPTS_CONFIG_DIR, "assets")),
    "assets 命名空间不得被编译到 scripts/config",
  );
  assert.ok(
    !fs.existsSync(path.join(SCRIPTS_CONFIG_DIR, "runtime")),
    "旧 runtime 命名空间已废弃，scripts/config/ 下不应再存在 runtime 目录",
  );
```

第 254-255 行 bundle 字符串黑名单：

```js
  assert.ok(!bundleCode.includes("definitions/rules/registry"), "bundle 不得引用 definitions/rules/registry 路径");
  assert.ok(!bundleCode.includes("definitions/runtime"), "bundle 不得引用 definitions/runtime 路径");
```

替换为：

```js
  assert.ok(!bundleCode.includes("definitions/runtime"), "bundle 不得引用旧 definitions/runtime 路径");
  assert.ok(!bundleCode.includes("definitions/rules/registry"), "bundle 不得引用旧 definitions/rules/registry 路径");
  assert.ok(!bundleCode.includes("definitions/rules/custom"), "bundle 不得引用旧 definitions/rules/custom 路径");
```

（这些断言只是回滚保险；新路径如 `definitions/mihomo-preset` 不会出现在 bundle 中——bundle 引用的是 `scripts/config/...`，不是源 YAML 路径。）

- [ ] **Step 6: grep 整个仓库确认没有遗漏**

```bash
```

```
Grep tool:
  pattern: "config/runtime|config/rules/groupDefinitions|definitions/runtime|definitions/rules/registry|definitions/rules/custom"
  glob: "*.{js,mjs,cjs}"
```

预期：仅命中 docs/ 下的历史文档（spec/plan）；`scripts/`、`tools/`、`build.js` 下应**零**命中。
若 `scripts/` 或 `tools/` 下还有命中，回到对应 Task 修补。

- [ ] **Step 7: 跑构建+验证（完整链路第一次跑通）**

```bash
npm run rules:build
node --check scripts/override/main.js
node --check tools/verify-main.js
```

预期：rules:build 12 个文件成功；两个 `node --check` 无输出。

---

## Task 6: 删除 `verify-yaml-migration` 与相关 npm script

**Files:**
- Delete: `tools/verify-yaml-migration.js`
- Modify: `package.json`（删除 `scripts.verify:migration`、改 `scripts.verify`）

- [ ] **Step 1: 删除文件**

```bash
git rm tools/verify-yaml-migration.js
```

- [ ] **Step 2: 修改 `package.json`**

把：

```json
    "verify:migration": "node tools/verify-yaml-migration.js",
    "verify": "npm run build && npm run verify:main && npm run verify:migration"
```

改为：

```json
    "verify": "npm run build && npm run verify:main"
```

（删掉 `verify:migration` 整行；把 `verify` 末尾的 ` && npm run verify:migration` 去掉。注意保留前一行末尾的逗号语法正确。）

- [ ] **Step 3: 校验 JSON 合法**

```bash
node -e "JSON.parse(require('node:fs').readFileSync('package.json','utf8'))" && echo OK
```

预期：`OK`。

---

## Task 7: 跑完整 `npm run verify`

- [ ] **Step 1: 完整 build + verify**

```bash
npm run verify
```

预期：
- "完成，共转换 12 个文件。"
- esbuild 打包成功
- "主 bundle 验证通过"
- 进程退出码 0

- [ ] **Step 2: 若失败按错误信息修补**

常见错误：
- `Cannot find module ../config/runtime/...` → Task 5 漏改某个 import；grep 定位
- `缺少生成产物文件: scripts/config/...` → Task 4 没跑 `rules:build` 或 namespace 配置错
- `dialer-proxy` / chain 相关测试失败 → 不应发生（运行时零改变），重读 `chains.js` 是否真的搬到了 `proxy-groups/`
- `definitions/ 下存在不支持的条目` → Task 1 残留旧目录或 Task 2 的 `CANONICAL_TOP_LEVEL_NAMES` 漏了 `assets`

---

## Task 8: 验证 `dist/` 产物路径与字节级等价

- [ ] **Step 1: 确认 dist 新路径**

```bash
test -f dist/assets/custom/_template.yaml && echo OK_new_template_path || echo FAIL
test ! -e dist/rules && echo OK_no_old_rules_dir || echo FAIL
```

预期：两条 `OK_`。

- [ ] **Step 2: 字节级比对示例配置**

```bash
diff -q /tmp/baseline-example-full-config.yaml dist/example-full-config.yaml
```

预期：无输出（文件完全一致）。

若有差异：
- `diff /tmp/baseline-example-full-config.yaml dist/example-full-config.yaml | head -50` 看具体行
- 任何运行时差异都意味着代码语义意外改变，必须回头排查。本次纯重构，**不接受**任何输出差异。

- [ ] **Step 3: 校验源 custom 与 dist custom 字节一致**

```bash
diff -q definitions/assets/custom/_template.yaml dist/assets/custom/_template.yaml
```

预期：无输出。

---

## Task 9: 更新文档

**Files:**
- Modify: `README.md`（第 36 行 URL、第 70-94 行目录树、第 109-113 行说明、第 56 行 `npm run verify` 说明）
- Modify: `CLAUDE.md`（项目根，第 26-32 行 build pipeline、第 50 行 proxy-groups.js 描述、第 58-61 行 data model）
- Modify: `docs/DESIGN.md`（多处提到旧路径，按 grep 定位逐处更新）

- [ ] **Step 1: 更新 `README.md`**

第 36 行：把 `dist/rules/custom/<文件名>` 改成 `dist/assets/custom/<文件名>`。

第 56 行：`npm run verify | 运行打包验证和 YAML 迁移验证` → `npm run verify | 运行打包验证`。

第 70-94 行的目录树：

```text
definitions/
  mihomo-preset/   直接合并到 Mihomo 顶层键的预设 YAML（base/dns/sniffer/tun/profile/geodata）
  proxy-groups/    策略组与链式代理构建数据 YAML（groupDefinitions/regions/placeholders/chains）
  rules/           分流规则装配 YAML（inlineRules/ruleProviders）
  assets/          仅复制到 dist 的资产，不参与脚本装配
    custom/        自定义规则模板

scripts/
  config/
    mihomo-preset/  从 definitions/mihomo-preset/ 生成的 JS 模块
    proxy-groups/   从 definitions/proxy-groups/ 生成的 JS 模块
    rules/          从 definitions/rules/ 生成的 JS 模块
  override/
    main.js     Mihomo 覆写单入口
    lib/        运行时预设、代理分组、规则装配、输出验证等辅助模块
  sub-store/
    rename.js   Sub-Store 节点重命名脚本

dist/               构建产物（发布到 dist 分支）
  scripts/
    override/
      main.js       自包含的 IIFE bundle，暴露 globalThis.main
    sub-store/
      rename.js     原样复制的 Sub-Store 脚本
  assets/
    custom/         复制的自定义规则资源
```

第 96-101 行 tools 列表：删除 `verify-yaml-migration.js  YAML 迁移兼容性验证` 一行。

第 109-113 行整段替换为：

```markdown
- `definitions/` 是唯一的声明式 YAML 源目录；`scripts/config/` 是生成产物，不应手动编辑
- `definitions/mihomo-preset/` 中每个 YAML 对应一个 Mihomo 顶层键（或顶层键集合）的预设
- `definitions/proxy-groups/` 决定最终 `proxy-groups:` 数组与（对 chains 而言）`proxies:` 中 landing 节点的 `dialer-proxy` 字段
- `definitions/rules/` 决定最终 `rules:` 与 `rule-providers:`
- `definitions/assets/` 仅按 `tools/lib/paths.js:COPY_ASSETS` 原样复制到 `dist/assets/`，不参与脚本装配
```

- [ ] **Step 2: 更新 `CLAUDE.md`（项目根）**

第 26-32 行 Build pipeline 第 1 节：

```
1. **`tools/yaml-to-js.js`** compiles YAML from three namespaces under `definitions/` into JS modules under `scripts/config/`:
   - `definitions/mihomo-preset/*.yaml` → `scripts/config/mihomo-preset/*.js` (base, dns, sniffer, tun, profile, geodata)
   - `definitions/proxy-groups/*.yaml` → `scripts/config/proxy-groups/*.js` (groupDefinitions, regions, placeholders, chains)
   - `definitions/rules/*.yaml` → `scripts/config/rules/*.js` (inlineRules, ruleProviders)
```

第 50 行：`scripts/config/runtime/regions.js`、`scripts/config/runtime/placeholders.js` → `scripts/config/proxy-groups/regions.js`、`scripts/config/proxy-groups/placeholders.js`。

第 58-61 行 data model：

```
- `definitions/rules/` is the active rule-set assembly entrypoint (inlineRules + ruleProviders)
- `definitions/proxy-groups/` holds proxy-group / chain construction data (groupDefinitions, regions, placeholders, chains)
- `definitions/mihomo-preset/` holds Mihomo top-level key presets (base, dns, sniffer, tun, profile, geodata)
- `definitions/assets/custom/` contains template/asset files copied verbatim to `dist/assets/custom/` — they are NOT part of the active assembly
- `definitions/proxy-groups/regions.yaml` defines region matching patterns ...
- `definitions/proxy-groups/placeholders.yaml` defines reserved group IDs ...
- The build rejects unknown top-level entries under `definitions/`.
```

把"verify-yaml-migration"、"legacy `rules/`"等表述删除。

- [ ] **Step 3: 更新 `docs/DESIGN.md`**

```
Grep tool:
  pattern: "definitions/runtime|definitions/rules/registry|definitions/rules/custom|scripts/config/runtime"
  path: "docs/DESIGN.md"
  output_mode: "content"
  -n: true
```

对每处命中按"旧路径 → 新路径"映射逐字面量替换：

| 旧 | 新 |
| --- | --- |
| `definitions/runtime/base.yaml` 等预设 6 项 | `definitions/mihomo-preset/<file>.yaml` |
| `definitions/runtime/regions.yaml` / `placeholders.yaml` / `chains.yaml` | `definitions/proxy-groups/<file>.yaml` |
| `definitions/rules/registry/groupDefinitions.yaml` | `definitions/proxy-groups/groupDefinitions.yaml` |
| `definitions/rules/registry/inlineRules.yaml` / `ruleProviders.yaml` | `definitions/rules/<file>.yaml` |
| `definitions/rules/custom/` | `definitions/assets/custom/` |
| `scripts/config/runtime/` | 按内容判断：preset 类 → `scripts/config/mihomo-preset/`；regions/placeholders/chains → `scripts/config/proxy-groups/` |
| `dist/rules/custom/` | `dist/assets/custom/` |

逐处替换；不要批量正则替换（需按语义判断 `runtime/` 应映射到哪个新目录）。

- [ ] **Step 4: 校验文档无残留旧路径（grep 整个仓库非历史文档）**

```
Grep tool:
  pattern: "definitions/runtime|definitions/rules/registry|definitions/rules/custom"
  glob: "{README.md,CLAUDE.md,docs/DESIGN.md}"
```

预期：零命中。

---

## Task 10: 提交

- [ ] **Step 1: 总览改动**

```bash
git status
git diff --stat
```

预期：包含 `definitions/` 大量重命名、`scripts/config/` 删除+新增、`tools/lib/paths.js` 与 `tools/yaml-to-js.js` 修改、`tools/verify-main.js` 修改、`tools/verify-yaml-migration.js` 删除、`package.json` 修改、`README.md` / `CLAUDE.md` / `docs/DESIGN.md` 修改、`scripts/override/{main.js,lib/runtime-preset.js,lib/proxy-groups.js}` 修改。

- [ ] **Step 2: 最终再跑一次 verify 兜底**

```bash
npm run verify
```

预期：通过。

- [ ] **Step 3: commit**

```bash
git add -A
git commit -m "refactor: definitions/ 按产出语义重组目录结构

- 新顶层目录：mihomo-preset/、proxy-groups/、rules/、assets/
- 移除 legacy rules/ 兜底与 verify-yaml-migration.js
- BREAKING CHANGE: dist/rules/custom/ 已迁移到 dist/assets/custom/"
```

> 提交时**不**加 Claude 署名（按全局 CLAUDE.md 规范）。

---

## 自检清单（写完计划后做的 self-review）

**Spec coverage（spec §2-§7 覆盖核对）：**

- §2.1 源目录新结构 → Task 1 ✓
- §2.2 编译产物镜像 → Task 4（构建后自动产生）✓
- §2.3 dist 路径变更 → Task 8 验证 ✓
- §3.1 paths.js 改动 → Task 2 ✓
- §3.2 yaml-to-js.js 改动 → Task 3 ✓
- §3.3 verify-main.js 改动 → Task 5 step 4-5 ✓
- §3.4 删除 verify-yaml-migration.js → Task 6 ✓
- §3.5 package.json → Task 6 ✓
- §3.6 check-rule-overlap.js → 仅依赖 `RULE_PROVIDERS_YAML_PATH`，由 Task 2 间接覆盖 ✓
- §3.7 build.js → 间接，无需直接改 ✓
- §4 import 路径迁移 → Task 5 ✓
- §5 文档改动 → Task 9 ✓
- §6 YAGNI → 计划无超范围 ✓
- §7.1 12 个 .js → Task 4 step 2 / Task 7 ✓
- §7.2 不存在 runtime/rules/registry/rules/custom/assets → Task 4 step 2 + Task 5 step 5 新断言 ✓
- §7.3 verify 通过 → Task 7 ✓
- §7.4 字节级等价 → Task 0 + Task 8 step 2 ✓
- §7.5 dist custom 一致 → Task 8 step 3 ✓
- §7.6 dist/rules/custom/ 不存在 → Task 8 step 1 ✓
- §7.7 verify-yaml-migration.js + verify:migration 不存在 → Task 6 ✓
- §7.8 definitions 下旧目录不存在 → Task 1 step 2-3 ✓

**占位扫描：** 无 TBD/TODO；所有 import 表都是字面量映射；新增代码块均为完整可执行片段。

**类型一致性：** namespace name/sourceSubdir/outputSubdir 三处一致；`runtime` 一词在产物清理列表中故意保留以兼容历史 git 状态，已加注释解释。
