# 代码优化重构设计

> 日期: 2026-04-15
> 方案: 渐进式抽取（方案一）

## 背景

当前代码库存在以下主要问题:

- **代码重复**: `pathExists` 在 build.js 和 yaml-to-js.js 中各有一份; `cloneData` 在 proxy-groups.js 和 runtime-preset.js 中各有一份
- **硬编码泛滥**: 区域匹配模式(29条)、占位符映射、路径常量、文件列表散落在各 JS 文件中
- **每次新增配置都需要改代码**: 添加 region/placeholder/资产目录等都需要修改 JS 源码
- **工具脚本中文件列表重复**: verify-yaml-migration.js 中同一批文件路径出现三次
- **注释不足**: 部分关键逻辑缺少解释

## 不在范围内

- `scripts/sub-store/rename.js` -- 第三方脚本，保持原样
- `scripts/config/` -- 自动生成产物，不手动修改
- TypeScript 迁移、测试框架引入
- `definitions/` 下已有 YAML 内容（仅新增 regions.yaml 和 placeholders.yaml）

## 验证策略

每一阶段完成后执行 `npm run verify`，确保功能不退化。

---

## 阶段一: 共享工具层抽取

### 目标

消除跨文件重复的工具函数，建立统一的底层模块。

### 新增文件

#### `tools/lib/fs-helpers.js` -- 文件系统工具函数

从现有代码中抽取:

- `pathExists(targetPath)` -- 来自 build.js 和 yaml-to-js.js
- `listEntries(dir)` -- 来自 yaml-to-js.js
- `copyDirectory(sourceDir, targetDir)` -- 来自 build.js
- `copyFile(sourcePath, targetPath)` -- 来自 verify-yaml-migration.js

#### `tools/lib/paths.js` -- 集中管理路径常量

所有工具脚本统一从此处读取路径:

- `REPO_ROOT` -- 项目根目录
- `DEFINITIONS_DIR` -- definitions/ 目录
- `SCRIPTS_CONFIG_DIR` -- scripts/config/ 输出目录
- `DIST_DIR` -- dist/ 输出目录
- `BUNDLE_PATH` -- 打包产物路径
- `TEMPLATE_PATH` -- 模板配置路径
- `COPY_ASSETS` -- 资产复制映射表（source -> target）
- 各命名空间的源/目标路径映射
- `resolve(...segments)` 便捷方法基于 `REPO_ROOT` 拼接

#### `scripts/override/lib/utils.js` -- override 脚本内部共享

- `cloneData(value)` -- 来自 proxy-groups.js 和 runtime-preset.js

### 影响范围

| 文件 | 改动 |
|------|------|
| `build.js` | 删除 `pathExists`、`copyDirectory`，引用 fs-helpers.js 和 paths.js |
| `yaml-to-js.js` | 删除 `pathExists`、`listEntries`，引用 fs-helpers.js 和 paths.js |
| `verify-yaml-migration.js` | 删除 `copyFile`，引用 fs-helpers.js |
| `proxy-groups.js` | 删除 `cloneData`，引用 utils.js |
| `runtime-preset.js` | 删除 `cloneData`，引用 utils.js |
| `bundle-runtime.js` | 路径常量引用 paths.js |
| `verify-main.js` | 路径常量引用 paths.js |

---

## 阶段二: 硬编码数据配置化

### 目标

将散落在 JS 代码中的硬编码数据移入 `definitions/`，纳入现有 YAML->JS 编译管线。

### 新增 YAML 定义文件

#### `definitions/runtime/regions.yaml` -- 区域匹配模式

当前 `proxy-groups.js` 中 29 条 `REGION_PATTERNS` 硬编码在代码里，移入 YAML:

```yaml
- id: hongkong
  name: 香港
  icon: "\U0001F1ED\U0001F1F0"
  pattern: "港|HK|Hong\\s*Kong|HongKong"
  flags: "i"
- id: taiwan
  name: 台湾
  icon: "\U0001F1E8\U0001F1F3"
  pattern: "台|TW|Taiwan"
  flags: "i"
# ... 其余 27 条
```

编译为 `scripts/config/runtime/regions.js`，`proxy-groups.js` 直接 import。

#### `definitions/runtime/placeholders.yaml` -- 占位符映射

当前 `proxy-groups.js` 中 `PLACEHOLDER_GROUP_IDS`、`RESERVED_GROUP_IDS`、`FALLBACK_GROUP_ID` 硬编码，移入 YAML:

```yaml
reserved:
  - proxy_select
  - manual_select
  - auto_select
fallback: fallback
mappings:
  "@all-nodes": all_named_proxies
  "@region-groups": all_region_groups
  "@proxy-select": proxy_select
```

编译为 `scripts/config/runtime/placeholders.js`。

### 编译管线影响

- `yaml-to-js.js` **不需要改动** -- 已递归处理 `definitions/runtime/` 下所有 `.yaml` 文件
- `verify-yaml-migration.js` 的文件列表需更新（但阶段三会将其自动化）

### 不移入配置的内容

| 内容 | 原因 |
|------|------|
| `BUILTIN_RULE_TARGETS` (DIRECT, REJECT 等) | Mihomo 协议内建目标，不随用户配置变化 |
| `RULE_TRAILING_OPTIONS` (no-resolve) | 同上 |
| esbuild 构建参数 | 构建层面固定 |

---

## 阶段三: tools/ 脚本重构

### 目标

消除文件列表重复，减少硬编码，改善错误处理，使新增定义文件时不需要改动工具脚本。

### 3.1 verify-yaml-migration.js -- 消除文件列表重复

- 运行时扫描 `definitions/runtime/` 和 `definitions/rules/registry/` 目录，动态获取文件列表
- 用循环替代逐行 `copyFile` 调用
- 新增 YAML 文件时无需修改此脚本

### 3.2 verify-main.js -- 动态发现生成产物

- `assertGeneratedFiles()` 改为扫描 `definitions/` 目录结构，推导出期望的 `scripts/config/` 产物列表
- 与 `yaml-to-js.js` 使用相同的命名空间映射（来自 paths.js），保证一致性

### 3.3 build.js -- 解耦资产复制逻辑

- 遍历 `paths.js` 中的 `COPY_ASSETS` 映射表执行复制
- 不再硬编码具体资产路径
- 新增资产只需在 paths.js 加一行

### 3.4 check-rule-overlap.js -- 改善错误处理

- `fetchRuleSet` 加入重试逻辑和明确错误信息（URL、HTTP 状态码）
- `main()` 顶层加 try-catch，输出诊断信息并以非零状态退出
- `parseIpv6` 拆分为更小的辅助函数（段解析、嵌入 IPv4 检测）

### 3.5 generate-example-config.js

仅将路径常量改为引用 paths.js，无重大改动。

### 3.6 bundle-runtime.js

- 路径常量改为引用 paths.js
- VM 上下文构造部分补充注释

---

## 阶段四: override 脚本改善

### 4.1 proxy-groups.js

- 删除硬编码的 `REGION_PATTERNS`(29条)、`RESERVED_GROUP_IDS`、`PLACEHOLDER_GROUP_IDS`、`FALLBACK_GROUP_ID`，改为 import 编译产物
- `cloneData` 改为引用 utils.js
- `expandGroupTarget` 补充注释说明每种占位符的语义
- 新增 `compileRegionPatterns(rawRegions)` 函数，在模块加载时将 YAML 字符串编译为 RegExp 对象

### 4.2 rule-assembly.js

- `extractRuleTarget` 补充注释说明 Mihomo 规则格式 `TYPE,PAYLOAD,TARGET[,no-resolve]`
- 增加防御性检查: `parts.length` 不足时给出明确错误信息
- 不做过度改动，当前结构合理

### 4.3 runtime-preset.js

- `cloneData` 改为引用 utils.js
- 补充注释说明 `allow-lan` 默认值原因、tun 条件覆盖 vs dns/sniffer 强制覆盖的设计意图
- 考虑在 `applyRuntimeSection` 中加入可选的 `skipIfExists` 参数（如果语义合理）

### 4.4 validate-output.js

- 规则解析改为引用 `rule-assembly.js` 的 `extractRuleTarget`，消除重复解析逻辑
- fallback group 不存在时增加 null safety 检查和明确错误

### 4.5 scripts/utils/logger.js

- 删除 -- 5 行代码，仅包装 console.log，无人使用

### 4.6 main.js

- 无重大改动，仅随 import 路径变化做相应调整

---

## 阶段五: 注释与代码规范收尾

### 5.1 函数注释

对所有被修改过的 JS 文件，补充缺失的函数注释:

```js
/**
 * 将代理节点按区域分类
 * @param {Array<{name: string}>} proxies - 代理节点列表
 * @returns {Map<string, Array>} 区域 ID 到节点数组的映射
 */
```

不对未修改的文件做注释补充。

### 5.2 关键逻辑注释

以下位置需要补充行内注释解释"为什么":

- `runtime-preset.js` -- tun 条件覆盖 vs dns/sniffer 强制覆盖的原因
- `proxy-groups.js` -- region pattern 匹配策略（first-match-wins）
- `bundle-runtime.js` -- VM 上下文为什么需要自定义 console 和 module/exports
- `rule-assembly.js` -- Mihomo 规则格式说明

### 5.3 错误信息规范

- 所有错误信息使用中文
- 错误信息包含上下文（哪个文件、哪个字段、期望什么值）
- 不使用空 catch 块

---

## 文件变更汇总

### 新增 (5 个)

| 文件 | 用途 |
|------|------|
| `tools/lib/fs-helpers.js` | 文件系统共享工具 |
| `tools/lib/paths.js` | 路径常量集中管理 |
| `scripts/override/lib/utils.js` | override 脚本共享工具 |
| `definitions/runtime/regions.yaml` | 区域匹配模式配置 |
| `definitions/runtime/placeholders.yaml` | 占位符映射配置 |

### 修改 (9 个)

| 文件 | 改动要点 |
|------|----------|
| `build.js` | 引用共享模块，资产复制改为遍历映射表 |
| `tools/yaml-to-js.js` | 引用共享模块 |
| `tools/verify-main.js` | 动态发现产物，引用路径常量 |
| `tools/verify-yaml-migration.js` | 动态扫描文件列表，引用共享模块 |
| `tools/check-rule-overlap.js` | 改善错误处理，拆分 parseIpv6 |
| `tools/lib/bundle-runtime.js` | 引用路径常量，补充注释 |
| `scripts/override/lib/proxy-groups.js` | 数据层剥离，引用编译产物和共享模块 |
| `scripts/override/lib/rule-assembly.js` | 补充注释和防御性检查 |
| `scripts/override/lib/runtime-preset.js` | 引用共享模块，补充注释 |
| `scripts/override/lib/validate-output.js` | 引用 extractRuleTarget，增加 null safety |

### 删除 (1 个)

| 文件 | 原因 |
|------|------|
| `scripts/utils/logger.js` | 仅包装 console.log，无人使用 |

### 自动生成 (随编译管线自动产出)

| 文件 | 来源 |
|------|------|
| `scripts/config/runtime/regions.js` | definitions/runtime/regions.yaml |
| `scripts/config/runtime/placeholders.js` | definitions/runtime/placeholders.yaml |
