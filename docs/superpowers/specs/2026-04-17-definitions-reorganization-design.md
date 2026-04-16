# definitions/ 目录重组设计

- 日期：2026-04-17
- 状态：Approved
- 范围：按"产出什么"切的语义轴重组 `definitions/` 与 `scripts/config/`；移除 legacy `rules/` 兜底

## 1. 背景与目标

现有 `definitions/` 顶层分为 `rules/` 和 `runtime/` 两块。这个划分是沿项目演化历史"先有什么就往哪里塞"形成的，不是按语义切的轴。新增声明式文件（`regions.yaml`、`placeholders.yaml`、`chains.yaml`）被塞进 `runtime/`，但它们并不是"Mihomo 顶层键预设"——只是给覆写脚本内部消费的元数据。结果是四个相互关联的问题：

- **P1**：`runtime/` 混合了两种完全不同的语义——"直接合并到 Mihomo 顶层键的预设"（base/dns/sniffer/tun/profile/geodata）和"仅脚本内部消费的元数据"（regions/placeholders/chains）。
- **P2**：同为"策略组构建规则"的 `groupDefinitions.yaml` 和 `chains.yaml` 被拆分到 `rules/registry/` 与 `runtime/` 两处。
- **P3**：`rules/` 这个命名覆盖不了其中的 `groupDefinitions.yaml`（策略组不是 rule）。
- **P4**：`rules/custom/`（仅复制到 dist 的模板资源）与 `rules/registry/`（active 装配入口）语义完全不同，却因 "rules" 共同父目录被误导为 registry 的补充。

目标：把顶层轴改为"按产出什么切"——每个顶层目录对应 Mihomo 最终配置的一个独立 output 部分，命名自带文档。

顺带清理：legacy `rules/` 兜底（项目维护者已全部迁移到 canonical 布局）。

## 2. 最终目录结构

### 2.1 源目录 `definitions/`

```
definitions/
├── mihomo-preset/                 # 直接合并到 Mihomo 顶层键的预设
│   ├── base.yaml
│   ├── dns.yaml
│   ├── geodata.yaml
│   ├── profile.yaml
│   ├── sniffer.yaml
│   └── tun.yaml
├── proxy-groups/                  # 策略组 / 链式代理 构建数据
│   ├── chains.yaml
│   ├── groupDefinitions.yaml
│   ├── placeholders.yaml
│   └── regions.yaml
├── rules/                         # 分流规则装配
│   ├── inlineRules.yaml
│   └── ruleProviders.yaml
└── assets/                        # 仅复制到 dist，不参与脚本装配
    └── custom/
        └── _template.yaml
```

- `mihomo-preset/` 的 YAML 每一个整体对应一个 Mihomo 顶层键（或顶级键集合，如 `base.yaml` 对应多个顶层键）。
- `proxy-groups/` 的 YAML 集合决定最终 `proxy-groups:` 数组与（对 chains 而言）`proxies:` 中 landing 节点的 `dialer-proxy` 字段。
- `rules/` 的 YAML 决定最终 `rules:` 与 `rule-providers:`。
- `assets/` 保留 `custom/` 子目录：与 dist 路径 `dist/assets/custom/` 一一对应；`custom` 在 Mihomo 语境里本身是"用户自定义规则集"的命名空间；未来该子目录可能容纳更多模板。

### 2.2 编译产物 `scripts/config/`

源与产物结构严格镜像：

```
scripts/config/
├── mihomo-preset/     # base.js, dns.js, geodata.js, profile.js, sniffer.js, tun.js
├── proxy-groups/      # chains.js, groupDefinitions.js, placeholders.js, regions.js
└── rules/             # inlineRules.js, ruleProviders.js
```

`assets/` 不编译，`COPY_ASSETS` 直接复制到 `dist/assets/`。

### 2.3 dist 发布路径

| 类型 | 旧路径 | 新路径 |
| --- | --- | --- |
| 主 bundle | `dist/scripts/override/main.js` | 不变 |
| Sub-Store 脚本 | `dist/scripts/sub-store/` | 不变 |
| 自定义模板 | `dist/rules/custom/*.yaml` | **`dist/assets/custom/*.yaml`**（破坏性变更） |
| 示例配置 | `dist/example-full-config.yaml` | 不变 |

`dist/rules/custom/` 不再存在。README 的公开引用 URL 随之更新。

## 3. 工具链改动

### 3.1 `tools/lib/paths.js`

- `CANONICAL_NAMESPACES` 改为 3 项；`name`、`sourceSubdir`、`outputSubdir` 一致：
  ```js
  [
    { name: "mihomo-preset", type: "directory", sourceSubdir: "mihomo-preset", outputSubdir: "mihomo-preset" },
    { name: "proxy-groups",  type: "directory", sourceSubdir: "proxy-groups",  outputSubdir: "proxy-groups" },
    { name: "rules",         type: "directory", sourceSubdir: "rules",         outputSubdir: "rules" },
  ]
  ```
- `CANONICAL_TOP_LEVEL_NAMES` 改为 `new Set(["mihomo-preset", "proxy-groups", "rules", "assets"])`。
- **删除** `CANONICAL_RULES_NAMES`（`registry` / `custom` 二级概念消亡）。
- **删除** `LEGACY_NAMESPACES`、`LEGACY_ROOT_NAME`、`LEGACY_ALLOWED_ENTRIES`。
- `COPY_ASSETS`：
  ```js
  [
    { source: resolve("definitions", "assets", "custom"), target: resolve("dist", "assets", "custom") },
    { source: resolve("scripts", "sub-store"),            target: resolve("dist", "scripts", "sub-store") },
  ]
  ```
- `RULE_PROVIDERS_YAML_PATH` 改为 `resolve("definitions", "rules", "ruleProviders.yaml")`。

### 3.2 `tools/yaml-to-js.js`

- **删除** `validateLegacyLayout` 函数。
- **删除** `resolveSourceTree` 中的 legacy 分支，该函数简化为仅校验 canonical 布局。不再抛 "definitions/ and rules/ cannot coexist" 错误；仅在 `definitions/` 缺失时抛 "未找到 definitions/ 源定义树"。
- `validateCanonicalLayout`：改为只校验 `CANONICAL_TOP_LEVEL_NAMES` 白名单；删除对 `definitions/rules/` 下 `registry`/`custom` 二级子目录的要求。
- `buildYamlModules` 的 `requiredNamespaces` 默认值由 `["rules", "runtime"]` 改为 `["mihomo-preset", "proxy-groups", "rules"]`。
- 构建开始时清理生成目录的集合由 `["rules", "runtime"]` 改为 `["mihomo-preset", "proxy-groups", "rules"]`。

### 3.3 `tools/verify-main.js`

- 顶部 import 路径迁移到新 namespace（完整映射见 §4）。
- `assertGeneratedFiles()` 已是动态扫描 `CANONICAL_NAMESPACES`，自动适配 paths.js 的更新，无需手工修改扫描列表。
- 删除对 `SCRIPTS_CONFIG_DIR/rules/custom/_template.js` 的断言（该目录不再存在）。可选替换为新断言："`scripts/config/` 下不存在名为 `assets` 的子目录"，确保 assets 命名空间绝不被编译。

### 3.4 `tools/verify-yaml-migration.js`

**整个文件删除**。

### 3.5 `package.json`

- 删除 `scripts.verify:migration`。
- `scripts.verify` 由 `npm run verify:main && npm run verify:migration` 改为 `npm run verify:main`（前置 `npm run build` 保留）。

### 3.6 `tools/check-rule-overlap.js`

自动跟随 `RULE_PROVIDERS_YAML_PATH` 的改动。需要检查该文件是否有对 `definitions/rules/registry/` 或 `definitions/rules/custom/` 的其他硬编码；若有，改为通过 paths.js 的常量或新路径。

### 3.7 `build.js`

仅间接通过 `paths.js` 引用；无需直接修改。

## 4. 运行时脚本 import 路径迁移

所有 `scripts/override/*.js` 文件的 import 路径按下表逐一更新：

| 旧路径 | 新路径 |
| --- | --- |
| `../config/runtime/base.js` | `../config/mihomo-preset/base.js` |
| `../config/runtime/dns.js` | `../config/mihomo-preset/dns.js` |
| `../config/runtime/sniffer.js` | `../config/mihomo-preset/sniffer.js` |
| `../config/runtime/tun.js` | `../config/mihomo-preset/tun.js` |
| `../config/runtime/profile.js` | `../config/mihomo-preset/profile.js` |
| `../config/runtime/geodata.js` | `../config/mihomo-preset/geodata.js` |
| `../config/runtime/regions.js` | `../config/proxy-groups/regions.js` |
| `../config/runtime/placeholders.js` | `../config/proxy-groups/placeholders.js` |
| `../config/runtime/chains.js` | `../config/proxy-groups/chains.js` |
| `../config/rules/groupDefinitions.js` | `../config/proxy-groups/groupDefinitions.js` |
| `../config/rules/ruleProviders.js` | `../config/rules/ruleProviders.js`（不变） |
| `../config/rules/inlineRules.js` | `../config/rules/inlineRules.js`（不变） |

涉及文件（至少）：
- `scripts/override/main.js`
- `scripts/override/lib/runtime-preset.js`
- `scripts/override/lib/proxy-groups.js`

需要扫描整个 `scripts/override/` 目录以免遗漏。

## 5. 文档改动

### 5.1 `README.md`

- **第 36 行**的公开引用 URL：`dist/rules/custom/<文件名>` → `dist/assets/custom/<文件名>`。
- **第 71-80 行**的目录树示意图按新结构重画。
- **第 109-113 行**说明文本：
  - 删除对 `definitions/rules/registry/` 和 `definitions/rules/custom/` 的描述。
  - 新增四段描述，分别说明 `mihomo-preset/`、`proxy-groups/`、`rules/`、`assets/` 的用途。
  - 删除"rules/ 与 definitions/ 并存的混合源树"相关表述（legacy 兜底已删除）。

### 5.2 `docs/DESIGN.md`

检查是否包含源目录的章节或列表，如有则按新结构更新。具体位置在实施期由 Implementer 用 grep 定位。

### 5.3 `CLAUDE.md`（项目根）

检查并更新：
- "Project Overview" 及 "Build pipeline" 章节中对 `definitions/rules/registry/` 与 `definitions/runtime/` 的描述。
- "Data model" 章节对 `definitions/rules/custom/` 的描述。
- 任何提及 legacy `rules/` 兜底的句子直接删除。

### 5.4 本次 spec 与 plan 文档

`docs/superpowers/specs/2026-04-17-chain-proxy-design.md`、`docs/superpowers/plans/2026-04-17-chain-proxy.md` 中涉及 `definitions/runtime/chains.yaml` 的路径仍保留（它们是历史文档，不影响当前代码）。不做 retrofit 改动。

## 6. YAGNI 边界（本次不做）

- 不把 `scripts/sub-store/`（JS 脚本）搬进 `definitions/assets/`——它不是声明式 YAML 资产。
- 不在 `mihomo-preset/` 下再拆子类（6 个 YAML 扁平即可）。
- 不做 legacy `rules/` 过渡兼容——直接删除。
- 不修改 `scripts/override/lib/*.js` 的模块边界或职责（本次只改 import 路径）。
- 不在 `dist/` 保留 `rules/custom/` 的软链或副本——破坏性变更已接受。

## 7. 验收标准

1. `npm run rules:build` 生成 `scripts/config/{mihomo-preset,proxy-groups,rules}/` 共 12 个 `.js` 文件：
   - `mihomo-preset/`: base.js, dns.js, geodata.js, profile.js, sniffer.js, tun.js（6 个）
   - `proxy-groups/`: chains.js, groupDefinitions.js, placeholders.js, regions.js（4 个）
   - `rules/`: inlineRules.js, ruleProviders.js（2 个）
2. `scripts/config/` 下**不存在** `runtime/`、`rules/registry/`、`rules/custom/`、`assets/` 任何一个子目录。
3. `npm run verify` 通过（只含 `verify:main`）。
4. `npm run example:config` 产出的 `dist/example-full-config.yaml` 与重组前字节级等价（本次纯结构重组，运行时行为零改变）。
5. `dist/assets/custom/_template.yaml` 与源 `definitions/assets/custom/_template.yaml` 内容一致。
6. `dist/rules/custom/` 路径不再存在于最新构建产物。
7. `tools/verify-yaml-migration.js` 文件不存在；`package.json` 中 `verify:migration` 脚本不存在。
8. `definitions/` 下不存在 `runtime/` 目录；`definitions/rules/` 下不存在 `registry/` 或 `custom/` 子目录。

## 8. 风险与回滚

- **外部用户的 URL 收藏**：`dist/rules/custom/*.yaml` 的直接引用失效。缓解：README 更新 + commit message 明确标注 BREAKING CHANGE。
- **重组期间 import 漏改**：任一 `.js` 文件遗漏 import 路径更新，都会在 `npm run verify` 的 build 阶段暴露（模块未找到）。TDD 路径：先改 source 目录名，跑 verify 看错误列表，按错误指引改 import。
- **回滚路径**：本 spec 的所有改动是原子的，单个 commit（或少量原子 commit）；回滚一次 revert 即可。无数据迁移，无持久化状态。
