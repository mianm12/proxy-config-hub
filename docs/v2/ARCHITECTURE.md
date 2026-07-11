# proxy-config-hub v2 架构设计

> 状态：已确认，待实施
>
> 范围：架构与边界设计；不代表 v2 已完成实现

## 1. 结论

v2 将项目重构为一个**单包、双应用、共享纯领域核心**的 TypeScript 项目：

- `override`：把宿主提供的 Mihomo 基础配置编译成个人使用的完整配置。
- `rename`：在 Sub-Store 中把不同来源的节点统一命名。
- `node-domain`：供两个应用共享的节点名称解析、地区识别、标签和倍率提取能力。
- `config compiler`：在构建期读取人类友好的模块化 YAML，完成结构校验、语义校验和 IR 规范化。

人写配置继续使用 YAML；编译器、领域模型、校验器、适配器和工具使用严格模式 TypeScript。构建产物仍是宿主可直接执行的无依赖单文件 JavaScript。

## 2. 产品定位

### 2.1 服务对象

项目只服务维护者自己的 Mihomo 配置，不建设通用 SaaS、插件市场、多租户系统或面向第三方的任意配置框架。

这意味着 v2 可以保留强约定：

- 只有一套 Mihomo 主配置。
- 只有维护者需要的策略组、规则源和链路模型。
- 配置 DSL 以减少维护成本为目标，不追求表达 Mihomo 的所有可能配置。
- 新能力优先通过明确的领域模型加入，不设计任意脚本插件系统。

### 2.2 正式运行宿主

| Artifact | 宿主 | 入口契约 |
|---|---|---|
| `override.js` | Mihomo Party | `main(config)` |
| `override.js` | Clash Verge Rev | `main(config, profileName)` |
| `override.js` | Sub-Store 文件/Mihomo 配置覆写 | `main(config)` |
| `rename.js` | Sub-Store 节点脚本操作 | `operator(proxies, targetPlatform, context)` |

三种 override 宿主共享同一个 `main` 核心契约。Clash Verge Rev 多出的 `profileName` 为可选上下文，v2 首期不使用。

`rename` 与 `override` 是独立应用；Sub-Store 的节点 `operator` 契约不得混入 override 核心。

### 2.3 非目标

v2 首期不包含：

- 任意深度多跳代理配置。
- 通用插件机制或用户自定义代码执行。
- 私有 provider 凭据注入。
- 多套 Mihomo profile。
- 正式 QuickJS 执行测试。
- 远程规则内容镜像或自建规则 CDN。

## 3. 当前实现评估

### 3.1 已验证基线

设计阶段已执行 `npm run verify`，当前 v1 构建与全部自制验证通过，工作区无构建后差异。

当前规模：

| 项目 | 数量/规模 |
|---|---:|
| 手写 YAML | 12 个 |
| 策略组 | 34 个 |
| rule providers | 93 个 |
| 地区 | 28 个（含 `OTHER`） |
| 主验证脚本 | 1777 行 |
| override bundle | 约 79 KB |
| rename 脚本 | 约 20 KB / 305 行 |

### 3.2 应保留的优点

- 声明数据与主要运行算法已经初步分离。
- override 运行时不访问网络或文件系统。
- 规则顺序明确采用 first-match-wins。
- 最终输出存在完整性校验。
- bundle 单文件交付，宿主使用简单。
- CI 已覆盖构建、验证、发布。

### 3.3 核心维护问题

1. **真相源分散**

   领域约束同时存在于 YAML、`yaml-to-js.js`、运行时代码、`validate-output.js` 和 `verify-main.js`。例如 context placeholder 白名单需要构建期与运行时手工同步。

2. **生成层没有提供足够价值**

   `definitions/*.yaml` 先生成并提交 `scripts/config/*.js`，再由 esbuild 打包。生成模块只是 JSON 包装，却形成第二套需同步审阅的产物。

3. **schema 覆盖不完整**

   构建期主要深度校验 `placeholders.yaml`。策略组、93 个 provider、链路、地区和 runtime 配置的大量错误只能在运行时或自制测试中发现。

4. **水平分层导致业务修改分散**

   新增一个服务通常需要同时修改 group definitions、rule providers 和规则顺序。组与其规则不在同一维护单元内。

5. **重复配置过多**

   大多数业务策略组拥有相同成员列表；所有现有 providers 又使用相同的 MetaCubeX URL、path、格式和刷新字段模板。

6. **两个节点真相源漂移**

   `rename.js` 与 override 地区识别分别维护国家、地区、旗帜、别名和正则，重命名结果与区域分类没有统一契约。

7. **核心逻辑与副作用耦合**

   当前核心直接修改输入对象并调用 `console.log`。计算结果、告警、宿主适配和错误策略无法独立测试。

8. **测试脚本承担过多职责**

   一个 1777 行脚本同时承担单元、集成、构建、临时工作区、bundle 和快照式断言，没有测试框架提供的隔离、fixture、快照与覆盖率能力。

9. **兼容性结论缺少真实契约建模**

   Node VM 能加载 CommonJS bundle 不等于宿主兼容。v2 必须按四种正式入口分别测试，而不是用一个 VM 测试代表所有宿主。

### 3.4 v1 实际构建数据流

当前构建链以 `definitions/` 为声明源：

```text
definitions/**/*.yaml
  → tools/yaml-to-js.js
  → scripts/config/**/*.js（export default JSON）
  → scripts/override/main.js 静态 import
  → esbuild IIFE
  → dist/scripts/override/main.js
```

其中：

- `mihomo-preset`、`proxy-groups`、`rules` 三个命名空间参与 YAML → JS。
- `assets` 不参与编译，只按 `COPY_ASSETS` 复制。
- `scripts/sub-store/rename.js` 不参与领域构建，原样复制到 dist。
- `yaml-to-js.js` 会拒绝未知 definitions 顶层目录，但深度 schema 主要只覆盖 placeholders。
- `build.js` 给 IIFE 注入 `globalThis.main` 与 CommonJS bridge。
- `verify-main.js` 在 Node VM 中加载 bundle，并同时测试源码函数、临时 YAML 工作区、产物复制和完整示例。
- main 分支 CI 重复执行一次 build，随后把 dist 推到 orphan `dist` 分支，再逐文件 purge jsDelivr。

这条链的主要冗余不是“使用了 YAML”，而是 YAML 与 bundle 中间存在一套被提交的纯 JSON JS 镜像。

### 3.5 v1 实际运行数据流

`main(config)` 当前顺序：

```text
读取 config.proxies 并过滤有效 name
→ applyRuntimePreset（就地覆盖输入）
→ 空节点时返回只含 runtime preset 的部分配置
→ 从节点中 first-match 提取 landing 节点
→ 用 remainingProxies 构建 transit groups
→ 两端非空时认定 chainsEffective
→ 构建 reserved / chain / transit / custom / region / fallback groups
→ 给 landing 原节点注入 dialer-proxy
→ prepend rules + provider RULE-SET + fallback MATCH
→ validateOutput
→ 返回同一个 config 引用
```

关键点：

- landing 节点从普通节点池和地区组中移除，防止落地节点同时作为中转候选。
- `chainsEffective` 要求至少一个 chain group 与一个 transit group 同时非空，否则整套链路退化。
- `applyProxyChains` 遍历原始 `config.proxies` 注入字段，因此分类阶段的 remaining 数组与最终代理对象仍共享引用。
- 规则 provider 的 YAML 对象键顺序就是最终匹配顺序。
- provider 的 `target-group` 与 `no-resolve` 是项目扩展字段，输出前被剥离。
- output validator 同时验证项目不变量和部分 Mihomo 引用合法性。

### 3.6 v1 主要数据结构与隐含约束

| 数据 | 当前表示 | 隐含约束 |
|---|---|---|
| runtime preset | 6 个独立 YAML 对象 | 文件名/导入代码决定应用位置与覆盖方式 |
| group definitions | `groupDefinitions` 对象字典 | 对象声明顺序影响自定义组展示；`category` 仅文档用途 |
| placeholders | reserved/fallback/placeholders 三段 | context source 同时硬编码在构建器与运行时 |
| regions | 有序数组 + regex 字符串 | first-match-wins；最后一项必须匹配空字符串 |
| chains | transit/chain 两个数组 | chain.entry 引用 transit ID；只表达一层 entry |
| providers | provider ID → 完整 Mihomo 字段 | 对象顺序是规则顺序；目标组使用稳定 ID |
| inline rules | 单一 prependRules 数组 | 目标从逗号字符串倒数段推断 |
| rename | 四套等长地区数组 + 多组正则 | 数组下标必须永久对齐；与 override 地区表无交叉校验 |

当前 34 个策略组中，绝大多数业务组只是同一成员模板的重复；93 个 provider 全部使用 `mrs`，并共享相同的基本下载字段。v2 的模板化针对的是这些已被数据证明的重复，而不是为未知需求提前抽象。

### 3.7 已知顺序约束

当前规则并不能简单按目标策略组聚合：

- `steam-cn → steam` 必须保持前后关系，且前者目标是 `DIRECT`。
- `azure → microsoft`，因为广义 Microsoft 规则会覆盖 Azure 专用规则。
- `aws → amazon`，因为 Amazon 规则会覆盖 AWS 专用规则。
- 地理兜底按 `geolocation-cn → geolocation-!cn → cn → cn-ip` 收尾。
- group 展示顺序与 rule 匹配顺序明显不同，例如 education 组靠后展示，但教育规则在前段匹配。

这正是 v2 分离 `group-layout` 与 `rule-pipeline`、并允许 pipeline 引用 module block 的依据。

## 4. 技术选型

### 4.1 基础工具链

| 能力 | 选择 | 用途 |
|---|---|---|
| Runtime / tools | Node.js 24 | 本地工具、构建、测试、CI |
| 包管理 | npm | 依赖、锁文件、所有命令入口 |
| 实现语言 | TypeScript strict | 编译器、领域核心、适配器、工具 |
| YAML | `yaml` | AST、源范围、行列错误、解析与输出 |
| 结构 schema | Zod 4 | 原始 YAML 结构校验与类型推导 |
| 测试 | Vitest | 单元、集成、golden、契约与 coverage |
| bundle | esbuild | `override.js` 与 `rename.js` 多入口构建 |
| lint | ESLint + typescript-eslint | 类型感知的代码问题检查 |
| format | Prettier | TypeScript、YAML、Markdown、JSON 统一格式 |

不引入 Makefile。`npm run` 是唯一公开命令层；复杂编排使用 TypeScript CLI，而不是把 shell 流程塞进 `package.json`。

### 4.2 为什么 YAML 不迁移为 TypeScript 配置

TypeScript 适合实现编译器，但不适合承载当前大量人工编辑的数据：

- DNS、规则清单和 provider 以 YAML 更易扫描。
- `satisfies` 只能处理静态结构，不能自动解决跨文件引用、顺序、正则冲突和链路拓扑。
- 将 93 个 provider 直接改成 TypeScript 对象会增加标点与代码噪声。

因此 v2 使用：

```text
人写 YAML → 构建期校验/规范化 → 类型化 IR → bundle 内只读数据
```

`yaml`、Zod 和构建工具不得进入最终运行 bundle。

### 4.3 单包而非 workspaces

两个应用和共享领域代码都在一个 npm package 中。当前没有独立发布内部库的需求，引入 workspaces 只会增加多个 manifest、依赖图和构建边界。

未来只有在共享领域库需要独立发布时，才考虑拆分 package。

## 5. 总体架构

```text
config/*.yaml                 public/rules/*
      │                              │
      ▼                              │ 原样复制
 YAML parser + source map            │
      │                              │
      ▼                              │
 Zod structural validation           │
      │                              │
      ▼                              │
 semantic validation                 │
      │                              │
      ▼                              │
 normalized Project IR               │
      │                              │
      ├──────────────┐               │
      ▼              ▼               │
 override core    rename core        │
      │              │               │
 host adapter     Sub-Store adapter  │
      │              │               │
      └───────┬──────┘               │
              ▼                      ▼
             esbuild multi-entry bundle
              │
              ▼
 dist/v2/{override.js,rename.js,rules,manifest.json}
```

### 5.1 建议源码结构

```text
src/
├── apps/
│   ├── override/
│   │   ├── entry.ts
│   │   └── adapter.ts
│   └── rename/
│       ├── entry.ts
│       └── adapter.ts
├── domain/
│   ├── node/
│   ├── routing/
│   ├── topology/
│   └── diagnostics/
├── compiler/
│   ├── yaml/
│   ├── schema/
│   ├── semantic/
│   └── ir/
├── runtime/
│   ├── override/
│   └── rename/
└── tools/
    ├── build.ts
    ├── check.ts
    ├── setup-mihomo.ts
    └── audit-rules.ts
```

目录表达依赖方向：

```text
apps/adapters → runtime use cases → domain
compiler      → domain IR
tools         → compiler/build/test helpers
domain        → 不依赖宿主、文件系统、console
```

禁止 `domain` 反向导入 `apps`、`tools` 或 Node 文件系统 API。

## 6. 核心领域模型

### 6.1 Project IR

所有 YAML 先编译为统一 IR。IR 不是 Mihomo 输出对象，也不是 YAML 原始对象，而是已经完成默认值展开和引用解析的项目领域模型。

概念结构：

```ts
interface ProjectIr {
  schemaVersion: 2;
  runtimePlan: RuntimeSectionIr[];
  nodeCatalog: NodeCatalogIr;
  regionPlan: RegionPlanIr;
  topology: TopologyIr;
  groupTemplates: GroupTemplateIr[];
  groups: GroupIr[];
  providers: ProviderIr[];
  groupLayout: GroupLayoutItemIr[];
  rulePipeline: RulePipelineItemIr[];
  renameProfiles: RenameProfileIr[];
  deployment: DeploymentIr;
}
```

所有 ID 在 IR 内使用稳定的 ASCII ID；emoji 和中文只出现在显示名称中。

### 6.2 节点领域

共享节点解析器输出规范化元数据：

```ts
interface NodeMetadata {
  originalName: string;
  region: string | "OTHER";
  multiplier?: number;
  tags: string[];
  confidence: "flag" | "name" | "code" | "alias" | "fallback";
  diagnostics: Diagnostic[];
}
```

地区识别优先级固定为：

```text
国旗 → 完整中文/英文名 → 有边界的地区代码 → 显式城市/别名 → OTHER
```

不再依赖 YAML 数组 first-match-wins。冲突信号产生诊断，并按固定优先级选择。

`rename` 使用 metadata 生成显示名称；`override` 直接使用 metadata 分类。override 不要求节点先经过 rename。

### 6.3 路由领域

业务模块纵向包含：

- 一个或多个相关策略组。
- 对应规则 block。
- provider 引用或自定义 provider。
- 只属于该模块的顺序约束。

全局配置单独维护两个真实维度：

- `group-layout`：客户端中的策略组展示顺序。
- `rule-pipeline`：Mihomo first-match-wins 的规则顺序。

两者不得由同一个隐式模块顺序推导。

迁移期 `group-layout` 显式列出稳定 group ID，因为现有展示顺序会把同一业务模块的组放在不同位置；`rule-pipeline` 在连续时可展开整个 module，存在跨模块交错时引用具体 rule block。

### 6.4 Provider 领域

provider source 模板只决定数据获取方式：

- URL/path 模板。
- type、behavior、format、interval 等默认值。

source 模板不得决定：

- 目标策略组。
- 全局规则顺序。
- fallback 行为。

标准来源使用简写，自定义 provider 使用完整声明。任何带凭据或 secret 的 provider 均不允许进入公开构建。

### 6.5 策略组领域

常见组使用少量命名模板，减少重复成员列表。模板不是通用继承系统：

- 不支持任意多层继承。
- 不支持隐式深度 merge。
- 特殊组可以完整覆盖 members。

组成员使用结构化引用，区分：

- 策略组引用。
- 动态节点池。
- 生成的地区/链式组。
- Mihomo 内置目标。
- 必要时的字面节点名。

当前 `@all-nodes` 等魔法字符串与 `placeholders.yaml` 在 v2 中删除。

### 6.6 链路拓扑

v2 首期正式支持：

```text
客户端 → 中转组 → 落地节点 → 目标
```

YAML 只暴露一跳模型；内部使用有向边表示 `landing uses transit`，并校验：

- selector 与组 ID 唯一。
- 中转池和落地池互斥。
- landing 引用存在的 transit。
- 生成组非空规则。
- 任意 `dialer-proxy` 指向存在的组。
- 拓扑无环。

未来两跳中转通过扩展 IR path/edge 表达，不需要重写节点分类与策略组系统。

## 7. 编译期与运行时边界

### 7.1 构建期负责

- 读取全部 YAML。
- 保留文件、行、列和字段路径。
- Zod 结构校验。
- 跨文件 ID、引用和唯一性校验。
- 模块覆盖完整性校验。
- group layout/rule pipeline 精确一次装配校验。
- provider 模板展开。
- 策略组模板展开。
- 链路拓扑和防环校验。
- 正则编译校验。
- 生成规范化 IR。
- 构建 bundle、静态资产和 manifest。

手写配置错误必须在构建期失败，不得留到用户客户端执行时发现。

### 7.2 运行时负责

- 校验宿主输入的最小契约。
- 解析实际代理节点名称。
- 根据节点集合构建地区、链式和中转组。
- 按 runtime plan 应用配置。
- 组装 providers/rules/groups。
- 验证最终动态引用。
- 返回新配置与结构化 diagnostics。

运行时不得访问网络、文件系统或构建工具。

### 7.3 配置所有权

override 明确拥有并覆盖：

- `proxies` 中由链路功能写入的字段。
- `proxy-groups`。
- `rule-providers`。
- `rules`。
- runtime manifest 明确声明的字段。

其他输入字段默认透传，避免删除 Mihomo Party、Clash Verge Rev 或 Sub-Store 注入的宿主字段。

核心不就地修改输入；仅克隆和替换实际受管结构。

## 8. 错误与诊断模型

### 8.1 结构化诊断

核心返回稳定诊断对象，不直接 `console.log`：

```ts
interface Diagnostic {
  code: string;
  severity: "warning" | "error";
  message: string;
  source?: {
    file: string;
    line?: number;
    column?: number;
    path?: string;
  };
  context?: Record<string, unknown>;
}
```

adapter 负责把 warning 转为宿主可见日志，把 fatal error 转为抛出的 `Error`。

### 8.2 失败策略

| 情况 | 策略 |
|---|---|
| YAML/schema/引用/拓扑错误 | 构建失败 |
| 无任何有效代理节点 | override 抛错，禁止返回不完整配置 |
| 链式 selector 无匹配 | warning，退化为普通代理配置 |
| 某个中转池为空 | warning；对应链路不生效 |
| 未知组/provider/生成项引用 | fatal error |
| 节点地区无法识别 | 归入 `OTHER`，可选 warning |
| 已有 `dialer-proxy` | 保留原值并 warning，与 v1 兼容 |

空节点的严格失败属于迁移完成后的独立行为变更；并行迁移期先保持 v1 语义以完成等价对比。

## 9. 宿主适配器

### 9.1 override adapter

内部统一签名：

```ts
function compileOverride(
  input: MihomoConfig,
  context?: { profileName?: string },
): OverrideResult;
```

bundle 暴露：

```js
function main(config, profileName) {
  // adapter → compileOverride → diagnostics → return config
}
```

迁移首期保留当前 global/CommonJS 双导出，直到 Sub-Store 文件覆写 harness 证明可以安全删除 CommonJS 桥。

### 9.2 rename adapter

内部统一签名：

```ts
function renameProxies(
  proxies: ProxyNode[],
  profile: RenameProfile,
  context: RenameContext,
): RenameResult;
```

Sub-Store adapter 负责读取 `$arguments.profile`、兼容旧参数，并暴露 `operator`。

### 9.3 QuickJS 状态

Clash Verge Rev 使用独立 JavaScript 引擎。v2 首期：

- bundle 目标使用保守 ES2020。
- 避免新增明显依赖单一 V8 API 的实现。
- 保留 `main(config, profileName)` 契约测试。
- 不把真实 QuickJS 执行加入首期 `npm run check`。

真实 QuickJS 测试是明确的后续增强项。

## 10. 测试架构

```text
tests/
├── unit/
│   ├── node-domain/
│   ├── routing/
│   ├── topology/
│   └── compiler/
├── integration/
│   ├── config-compile/
│   ├── override/
│   └── rename/
├── contracts/
│   ├── mihomo-party/
│   ├── clash-verge-rev/
│   ├── sub-store-override/
│   └── sub-store-rename/
├── fixtures/
└── golden/
```

测试层次：

1. **单元测试**：纯函数与单一不变量。
2. **schema 测试**：无效 YAML、精确错误路径与 source location。
3. **集成测试**：多个配置模块编译成 IR，再生成输出。
4. **golden 测试**：代表性输入下 v1/v2 结构化输出对比。
5. **宿主契约测试**：四种入口分别加载 bundle。
6. **官方 Mihomo 验证**：完整示例运行 `mihomo -t -f`。
7. **联网规则审计**：独立手动/定时 workflow。

快照只用于稳定、可审阅的结构；核心不变量仍使用明确断言，避免把错误输出机械更新成新快照。

## 11. Mihomo 工具解析

本地与 CI 使用同一解析顺序：

1. `MIHOMO_BIN` 指定的显式路径。
2. `PATH` 中已有的 `mihomo`。
3. 项目缓存中按锁定版本下载并校验 checksum 的官方二进制。

`npm run tools:setup` 负责准备第三层工具；`npm run verify:mihomo` 只负责解析并执行。不得在 GitHub workflow 中另写一套下载逻辑。

## 12. 构建与命令

建议公开命令：

```text
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run verify:mihomo
npm run check
npm run tools:setup
npm run audit:rules
```

`npm run check` 是本地和 CI 的统一确定性入口：

```text
format:check
→ lint
→ typecheck
→ tests
→ build
→ bundle contracts
→ Mihomo config validation
```

联网的 `audit:rules` 不进入 `check`。

## 13. 发布架构

### 13.1 Pages 稳定通道

主分支通过检查后构建：

```text
dist/
└── v2/
    ├── override.js
    ├── rename.js
    ├── manifest.json
    └── rules/
```

使用 GitHub Actions Pages artifact 部署，不提交 `dist`、`gh-pages` 或 `v2` 发布分支。

推荐 URL 形态：

```text
<pages-base>/v2/override.js
<pages-base>/v2/rename.js
<pages-base>/v2/rules/<id>.yaml
<pages-base>/v2/manifest.json
```

自定义域名可后续配置。发布基址作为部署配置注入，不硬编码在业务模块中。

### 13.2 Release 不可变通道

人为创建并推送 `v2.x.y` tag 后，tag workflow：

1. 执行完整 `npm run check`。
2. 构建 release assets。
3. 自动创建 GitHub Release。
4. 上传 `override.js`、`rename.js`、`manifest.json`、`checksums.txt` 和自定义规则资产包。

推送 main 只更新 Pages；不会自动创建 Release。

### 13.3 manifest

发布 manifest 至少包含：

```json
{
  "version": "2.0.0",
  "schemaVersion": 2,
  "commit": "<git-sha>",
  "builtAt": "<iso-8601>",
  "mihomoVersion": "<tested-version>",
  "artifacts": {
    "override.js": { "sha256": "..." },
    "rename.js": { "sha256": "..." }
  }
}
```

## 14. CI/CD

建议拆分 workflow：

| Workflow | 触发 | 网络依赖 | 作用 |
|---|---|---:|---|
| `ci` | PR、push | Mihomo 工具下载可缓存 | 执行 `npm run check` |
| `pages` | main 且 ci 成功 | GitHub Pages | 构建并部署 `/v2/` |
| `release` | `v*` tag | GitHub Releases | 验证、创建 Release、上传资产 |
| `rule-audit` | weekly、手动 | 远程 providers | URL、内容重叠与遮蔽审计 |

远程 provider 暂时不可用不得阻塞普通 Pages 发布。定时 audit 自身失败并保留报告，以便维护者处理。

## 15. 安全边界

- 不在仓库、环境模板、bundle、Pages 或 Release 中放置密钥。
- 不支持将 CI secret 注入公开 provider URL。
- 所有发布后的 provider 配置均视为公开信息。
- 自定义 provider 必须可公开访问；私有规则源应由独立鉴权代理或内网发布系统解决。
- 下载 Mihomo 二进制必须锁定版本并校验官方 checksum。
- GitHub Pages 自定义域名后续启用时应验证域名并使用精确 DNS 记录，不使用 wildcard。
- 原始订阅代理对象只在内存中处理，不写入测试快照或日志；fixtures 必须脱敏。

## 16. 已确认的架构决策

1. 个人专用、强约定配置编译器。
2. 严格 TypeScript 实现，人写 YAML 配置。
3. 单 npm package，不引入 workspaces 或 Makefile。
4. 两个应用共享窄的 node-domain，不互相依赖。
5. 单一 manifest 作为配置装配入口。
6. 业务域纵向模块，约 10–12 个文件。
7. group layout 与 rule pipeline 分离。
8. provider source 模板不控制目标组与顺序。
9. 标准 provider 简写与完整自定义 provider 并存。
10. 少量命名策略组模板，不实现通用继承。
11. 结构化成员引用替代 `@placeholder`。
12. runtime YAML 使用显式 `overlay/replace/if-absent`。
13. 一跳链路首期支持，IR 为未来两跳保留拓扑边界。
14. 三宿主共享一份 override bundle；rename 独立 bundle。
15. 显式管理字段，其余宿主字段透传。
16. 严格 DSL；原生新字段通过显式 `mihomo` 区透传。
17. 本地与 GitHub Actions 使用同一个 `npm run check`。
18. Pages artifact 作为稳定主通道，Release 作为不可变回滚通道。
19. 远程规则审计独立运行，不阻塞普通构建发布。
20. v1/v2 并行迁移，等价验证后一次切换。

## 17. 延后决策

- Pages 是否绑定独立子域名。
- QuickJS 真实执行测试的具体实现。
- 两跳中转的用户 YAML 语法。
- 是否删除 override bundle 的 CommonJS 桥。
- 是否为定时规则审计增加自动通知或 Issue 创建。
- v3 出现后，v2 Pages 通道的长期冻结/维护策略。
