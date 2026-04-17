# proxy-config-hub 设计方案 v1

本文档描述 proxy-config-hub 当前实现（v1）的架构与约束，作为代码之外的唯一事实来源。行为描述以代码实现为准；一旦偏离，以代码为准并回填本文档。

---

## 一、项目目标与范围

**proxy-config-hub** 的唯一交付物是一份可被 Mihomo（Clash.Meta）或 Sub-Store 直接引用的覆写脚本，把一份只含 `proxies` 的裸订阅，扩展成完整的 Mihomo 配置（DNS、嗅探、TUN、策略组、rule-provider、规则列表）。

| 维度 | 当前状态 |
|------|----------|
| 主脚本 | `dist/scripts/override/main.js`（esbuild IIFE，通过 jsDelivr/CDN 分发） |
| 功能脚本 | `dist/scripts/sub-store/rename.js`（Sub-Store 专用节点改名） |
| 自定义规则集 | `dist/assets/custom/*.yaml`（占位模板 `_template.yaml`） |
| 声明式源数据 | `definitions/**.yaml`（唯一手编位置） |
| 编译产物 | `scripts/config/**.js`（`tools/yaml-to-js.js` 生成，**不得手改**） |
| 发布渠道 | GitHub Actions 将 `dist/` 推送到 `dist` 分支并刷新 jsDelivr 缓存 |
| 运行时兼容 | Mihomo Party / Clash Verge Rev（V8 / QuickJS）；Sub-Store 在 V8 环境下亦可加载（经 `module.exports = { main }` 兼容） |

v1 的范围**不含**：早期设计中设想的 `routing-only.js` / `dns-leak-fix.js` 轻量入口（仅 `main.js` 存在）、远程规则回退、自建 CDN。这些未来可扩展的方向见 §13 与附录 B。

---

## 二、架构总览

### 2.1 分层

```
┌──────────────────────────────────────────────────────────────┐
│ definitions/            源定义（人写 YAML，单一事实来源）     │
├──────────────────────────────────────────────────────────────┤
│ tools/yaml-to-js.js     编译 + 模式校验 + 交叉引用校验        │
├──────────────────────────────────────────────────────────────┤
│ scripts/config/         生成产物（纯数据 ES 模块）            │
├──────────────────────────────────────────────────────────────┤
│ scripts/override/       覆写脚本源码（main + lib/*.js）       │
├──────────────────────────────────────────────────────────────┤
│ build.js / esbuild      打包为 IIFE bundle                    │
├──────────────────────────────────────────────────────────────┤
│ dist/                   交付目录（含资产复制）                │
└──────────────────────────────────────────────────────────────┘
```

**设计取舍**：把"声明"（YAML）与"逻辑"（JS 函数）彻底分离，定义新区域、新策略组、新 rule-provider 只改 YAML，不改 JS；反之，算法演进只改 `scripts/override/lib/`，不影响数据。

### 2.2 顶层数据流

1. 用户订阅解析后得到 `{ proxies: [...] }`。
2. 订阅工具（Mihomo Party / Sub-Store）加载 `dist/scripts/override/main.js`，把上述对象作为 `config` 传入 `main(config)`。
3. `main` 同步返回补全后的 Mihomo 配置对象；上层应用按原流程渲染或推送。

整个过程是纯函数性的：没有网络、没有文件系统访问（规则集 URL 的拉取由 Mihomo 运行时执行，脚本本身不联网）。

---

## 三、构建与发布管线

### 3.1 源定义目录（`definitions/`）

| 子目录 | 文件 | 作用 |
|--------|------|------|
| `mihomo-preset/` | `base.yaml`, `profile.yaml`, `geodata.yaml`, `sniffer.yaml`, `dns.yaml`, `tun.yaml` | Mihomo 顶层键预设（6 份，1:1 映射到最终配置字段） |
| `proxy-groups/` | `groupDefinitions.yaml`, `regions.yaml`, `placeholders.yaml`, `chains.yaml` | 策略组 / 区域 / 占位符 / 链式代理声明 |
| `rules/` | `inlineRules.yaml`, `ruleProviders.yaml` | prepend 规则 + rule-provider 清单 |
| `assets/custom/` | `_template.yaml` 等 | 自定义规则集，**不参与编译**，仅复制到 `dist/assets/custom/` |

`definitions/` 顶层允许的子目录被硬编码在 `tools/lib/paths.js:CANONICAL_TOP_LEVEL_NAMES`（`mihomo-preset` / `proxy-groups` / `rules` / `assets`），新增未注册目录会让构建失败。

### 3.2 YAML → JS 编译（`tools/yaml-to-js.js`）

- 根据 `CANONICAL_NAMESPACES`（3 个：`mihomo-preset` / `proxy-groups` / `rules`）扫描 `definitions/`。
- 每个 YAML 编译为对应位置的 `scripts/config/**/name.js`（内容形如 `export default <JSON>;`）。
- 每次构建只清理**参与本次构建**的命名空间输出目录，以支持增量；历史遗留目录（当前列表：`runtime/`）无条件清理。
- `assets/` 命名空间不会被编译，任何被复制到 `scripts/config/assets` 的产物会被 `verify-main.js` 阻止。

**模式校验**在 `convertOne` 内触发，当前仅对 `proxy-groups/placeholders.yaml` 做深度校验：

1. 根对象必须是对象。
2. `reserved`：非空字符串数组，无重复，全部在 `groupDefinitions` 中已定义。
3. `fallback`：非空字符串，不能与 `reserved` 重复，且在 `groupDefinitions` 中已定义。
4. `placeholders`：非空对象；每个键必须以 `@` 开头。
5. 每个 entry：`kind ∈ {ref, context}`；`kind=ref` 要求 `target` 非空且在 `groupDefinitions` 里；`kind=context` 要求 `source ∈ {allNodes, regionGroups, chainGroups}`。

`kind=context` 的 source 白名单集中在 `tools/yaml-to-js.js` 的 `PLACEHOLDER_ALLOWED_CONTEXT_SOURCES`，必须与 `scripts/override/lib/proxy-groups.js` 的 `CONTEXT_SOURCES` 对象手动同步。

### 3.3 打包（`build.js`）

```
npm run build
  = npm run rules:build (yaml-to-js)
  + node build.js (esbuild + 资产复制)
```

esbuild 产物特征：

| 选项 | 值 |
|------|----|
| `entryPoints` | `scripts/override/main.js` |
| `format` | `iife` |
| `globalName` | `__proxyConfigHub` |
| `target` | `es2020` |
| 输出 | `dist/scripts/override/main.js` |

Footer 注入一段桥接代码：

```js
if (typeof globalThis !== "undefined" && __proxyConfigHub && typeof __proxyConfigHub.main === "function") {
  globalThis.main = __proxyConfigHub.main;
}
if (typeof module !== "undefined" && module && module.exports && __proxyConfigHub && typeof __proxyConfigHub.main === "function") {
  module.exports = { main: __proxyConfigHub.main };
}
```

这保证了 bundle 既能在 `globalThis.main` 风格的加载环境（Mihomo Party、Clash Verge Rev）运行，也能被 Sub-Store 的 CommonJS loader 以 `require` 方式载入。

打包完成后，`build.js` 遍历 `tools/lib/paths.js:COPY_ASSETS` 复制静态资产（当前包含 `definitions/assets/custom/ → dist/assets/custom/` 与 `scripts/sub-store/ → dist/scripts/sub-store/`）。

### 3.4 运行时注意事项

- ESM 贯通（`package.json` `"type": "module"`），Node.js ≥ 24。
- 覆写脚本源码中使用了 ES2018 负向后行断言（`(?<![A-Z])..(?![A-Z])`，主要在 `regions.yaml`），V8 与 QuickJS 支持；若未来需支持 iOS JSC，需替换为前向等价写法。
- 脚本运行时不访问文件系统、不联网。rule-provider URL 的拉取由 Mihomo 运行时自行完成。

---

## 四、占位符机制

### 4.1 动机

`groupDefinitions.yaml` 声明策略组时，常需要引用"所有节点"、"全部区域组"或"手动选择组的名字"。硬编码节点名会随订阅漂移，硬编码组名会随本仓库文案调整而失效。占位符把这两类动态值抽象为 `@`-前缀关键字，在运行时由 `expandGroupTarget` 展开。

### 4.2 声明（`definitions/proxy-groups/placeholders.yaml`）

```yaml
reserved:
  - proxy_select
  - manual_select
  - auto_select

fallback: fallback

placeholders:
  "@proxy-select":  { kind: ref, target: proxy_select }
  "@manual-select": { kind: ref, target: manual_select }
  "@auto-select":   { kind: ref, target: auto_select }
  "@all-nodes":     { kind: context, source: allNodes }
  "@region-groups": { kind: context, source: regionGroups }
  "@chain-groups":  { kind: context, source: chainGroups }
```

| 字段 | 含义 |
|------|------|
| `reserved` | 需要在 `proxy-groups` 输出最前部强制出现的组 ID（构建顺序 = 声明顺序） |
| `fallback` | 用于最终 `MATCH,<name>` 规则的组 ID，也是兜底组 |
| `placeholders` | `@`-前缀占位符全集。**不在此表内的 `@*` 值一律被拒绝**（`expandGroupTarget` 抛错） |

### 4.3 两类 entry

- `kind: ref` — 引用另一个已定义的保留组，`expandGroupTarget(target)` 返回 `[groupDefinitions[entry.target].name]`。
- `kind: context` — 引用运行时计算的集合；`expandGroupTarget(target, context)` 调用 `CONTEXT_SOURCES[entry.source](context)`。当前支持的三种 source：

| source | 返回 |
|--------|------|
| `allNodes` | `context.allProxyNames`（调用 `buildProxyGroups` 时传入的 `proxies` 的 `name` 列表） |
| `regionGroups` | 当前运行中已生成的区域组名数组 |
| `chainGroups` | `extras.chainGroups` 传入的组名数组（未启用链式代理时为空数组） |

### 4.4 扩展一个新占位符

- **新增 `kind=ref` 占位符**：只改 `placeholders.yaml`，指向 `groupDefinitions.yaml` 已有 ID 即可。
- **新增 `kind=context` 占位符，复用现有 source**：同样只改 `placeholders.yaml`。
- **新增一种 source**（例如 `@premium-nodes`）：
  1. 在 `placeholders.yaml` 中声明 `source: premiumNodes`。
  2. 在 `scripts/override/lib/proxy-groups.js` 的 `CONTEXT_SOURCES` 添加对应解析函数。
  3. 在 `tools/yaml-to-js.js` 的 `PLACEHOLDER_ALLOWED_CONTEXT_SOURCES` 同步加入白名单。
  4. 调用端在 `buildProxyGroups` 的 `context` 对象上提供数据源字段。

---

## 五、策略组生成

### 5.1 区域识别（`definitions/proxy-groups/regions.yaml`）

每个条目：

```yaml
- id: HK
  name: 香港
  icon: "🇭🇰"
  pattern: 🇭🇰|香港|(?<![A-Z])HK(?![A-Z])|Hong\s*Kong
  flags: i
```

- 当前包含 ~29 个国家/地区 + 1 个 `OTHER`（`pattern: ".*"`，`flags: ""`）。
- **最后一项必须是能匹配空字符串的兜底 region**；`compileRegionPatterns` 在模块加载时执行断言，不满足则启动阶段抛错（避免节点静默丢失）。
- 每个节点只会归属首个命中的 region（first-match-wins），所以短 token（`HK` / `US`）使用负向后行断言避开 `HKUS` 这种误匹配。
- 0 节点的 region 不会生成分组。

### 5.2 保留组与兜底组

保留组由 `placeholders.yaml:reserved` 钉死在 `proxy-groups` 数组前部，顺序即声明顺序。当前为：

| ID | 组名 | 类型 | proxies（展开后） |
|----|------|------|-------------------|
| `proxy_select` | 🚀 代理选择 | select | `@manual-select, @auto-select, @chain-groups, @region-groups, DIRECT` |
| `manual_select` | 🔧 手动选择 | select | `@chain-groups, @all-nodes` |
| `auto_select` | ⚡ 自动选择 | url-test | `@all-nodes` + `url: https://www.gstatic.com/generate_204`, `interval: 300`, `lazy: false` |

兜底组 ID 由 `placeholders.yaml:fallback` 指定（当前 = `fallback` → "🐟 漏网之鱼"）。该组会被放在 `proxy-groups` 最末，同时 `assembleRuleSet` 生成的最后一条规则 `MATCH,<fallback.name>` 引用它。

### 5.3 自定义组（`definitions/proxy-groups/groupDefinitions.yaml`）

```yaml
groupDefinitions:
  ai_service:
    name: "🤖 AI 服务"
    type: "select"
    category: "basic"
    proxies:
      - "@proxy-select"
      - "@manual-select"
      - "@auto-select"
      - "DIRECT"
      - "@chain-groups"
      - "@region-groups"
```

关键约束：

- `proxies` 是有序数组，支持混合 `@-占位符`、`DIRECT` / `REJECT` 等 Mihomo 内置目标、以及具体节点/组名字面量。
- `buildConfiguredGroup` 把除 `category` / `proxies` 外的所有字段原样 `cloneData` 复制到输出（因此 `url-test` 的 `url` / `interval` / `lazy`、`select` 的 `icon` 等字段都可直接在 YAML 声明）。
- `category` 是纯文档字段，运行时忽略。
- `name` 与 `type` 缺失会在构建阶段抛错。

早期设计里的 `mode: full/direct/reject` 三值枚举已被**声明式 proxies 数组 + 占位符展开**取代；任何分组的节点来源现在都由 `proxies` 显式列出。

### 5.4 `buildProxyGroups` 输出顺序

`scripts/override/lib/proxy-groups.js:buildProxyGroups(proxies, groupDefinitions, extras)` 的返回数组严格遵循：

```
1. reserved 顺序的保留组（来自 placeholders.yaml:reserved）
2. extras.chainGroups（链式代理落地组，有序）
3. extras.transitGroups（链式代理中转组，有序）
4. 其他自定义组：groupDefinitions 中既不在 reserved 也不是 fallback 的全部条目，遵循 YAML 顺序
5. 区域组（按 regions.yaml 顺序，跳过无节点的区域）
6. 兜底组（placeholders.fallback 指向的组）
```

`context` 对象包含：`allProxyNames`、`regionGroupNames`、`chainGroupNames`、`groupDefinitions`，用于占位符展开。

### 5.5 组名唯一性

函数末尾有一次遍历断言：所有最终组的 `name` 字段互不重复，避免把 chain/transit 的组名与用户自定义组名撞车导致 Mihomo 侧引用错乱。

### 5.6 `getNamedProxies`

`scripts/override/lib/proxy-groups.js` 导出的辅助函数，过滤掉 `name` 为空或非字符串的代理节点。`main.js` 和 `verify-main.js` 在调用 chain/transit/group 构建前都先走这一步。

---

## 六、链式代理系统

`proxy-config-hub` 支持在生成的配置中声明"落地节点经过中转节点出海"的链路；实现集中在 `scripts/override/lib/proxy-chains.js`。

### 6.1 概念

- **chain_group（落地）**：依 `landing_pattern` 从订阅中挑出的落地节点。
- **transit_group（中转）**：依 `transit_pattern` 从剩余节点中挑出的中转候选。
- **entry 绑定**：每个 chain_group 通过 `entry` 字段引用某个 transit_group 的 `id`；运行时会把该 chain 内所有落地节点的 `dialer-proxy` 设为 transit_group 的 `name`。
- **落地与中转互斥**：一旦节点被某 chain_group 捕获，即从 `remainingProxies` 中剔除，`transit_group` 不可能再包含它（§7.2 由 `validateOutput` 兜底断言）。

### 6.2 声明（`definitions/proxy-groups/chains.yaml`）

```yaml
transit_group:
  - id: transit
    name: "🔀 中转"
    transit_pattern: "Transit|中转|自建"  # 空字符串 = 取 remainingProxies 全部；非空 = 在 remainingProxies 上再做正则过滤
    flags: i
    type: select

chain_group:
  - id: landing
    name: "🚪 落地"
    landing_pattern: "Relay|落地|^(?=.*直连)(?=.*家宽)"  # 必填非空
    flags: i
    type: select
    entry: transit  # 必须是 transit_group[*].id 之一
```

### 6.3 `buildChainGroups(namedProxies, chainDefinitions)`

- 每个 chain 的 `landing_pattern` 在模块内部 `compileChainPatterns` 编译为 `RegExp`；非法正则抛 `chain_group <id> 的 landing_pattern 非法正则`。
- `chain.id` 全局唯一（由 `assertUniqueChainIds` 强制）。
- 节点遍历采用 **first-match-wins**：匹配多个 chain 时归属首个，其余命中仅输出 WARN。
- 匹配到 0 节点的 chain_group 被跳过并 WARN，不会出现在输出里。
- 返回 `{ chainGroups, remainingProxies }`。`remainingProxies` 在节点顺序上保持原订阅顺序。

### 6.4 `buildTransitGroups(remainingProxies, transitDefinitions)`

- `transit_pattern` 为空字符串（或非字符串）→ 成员 = `remainingProxies` 全部。
- 非空 → 编译为 RegExp，按名称过滤。
- 成员为空的 transit_group 被跳过并 WARN，**不进入 `idToName` 映射表**，其绑定的 chain 因此在 `applyProxyChains` 阶段也会跳过。
- 返回 `{ groups, idToName }`，`idToName: Map<string, string>` 从 `transit.id` 映射到 `transit.name`，供 `applyProxyChains` 查询。

### 6.5 `applyProxyChains(config, chainDefinitions, transitIdToName)`

对每个 chain：

1. 若 `transitIdToName.get(chain.entry)` 为空 → WARN 并跳过该 chain。
2. 否则遍历 `config.proxies`：
   - 若节点名命中 `landing_pattern` 且该节点尚无 `dialer-proxy`，写入 `proxy["dialer-proxy"] = transit.name`。
   - 若节点已有 `dialer-proxy`，保留原值并 WARN（不覆盖用户/上游已设置的链路）。

### 6.6 `chainsEffective` 与退化

`main.js` 在调用完 `buildChainGroups` / `buildTransitGroups` 后计算：

```js
const chainsEffective = transitGroups.length > 0 && chainGroups.length > 0;
```

只有同时存在至少一个可用的 chain_group 与 transit_group 时才进入链式流程；任一为空都视为"本次订阅无法支撑链路"，退化为普通策略组生成（`extras.chainGroups`/`transitGroups` 都传空数组），此时 `@chain-groups` 占位符展开为空列表。

### 6.7 模块加载期 `validateChainsSchema`

`main.js` 顶层执行一次：

```js
validateChainsSchema(chainDefinitions, transitDefinitions);
```

约束：

- `chainDefinitions` 空数组直接通过。
- 非空时 `transitDefinitions` 必须是数组。
- 每个 chain 必须有非空字符串 `entry`，且该 entry 必须等于某个 transit_group 的 `id`。

这一层把"YAML 拼写错误（entry 写错）"与"运行时 transit 成员过滤为空"两类场景区分开——前者立即抛错，后者运行时 WARN 退化。

### 6.8 防环与非空不变量

`validateOutput` 在链式代理启用时（即 `chainDefinitions` 或 `transitDefinitions` 非空）额外执行：

- **§7.2**：`transit_group` 的任一成员名字若命中**任一** chain_group 的 `landing_pattern`，立即抛错。保证"中转不含落地"，消除链路自回环。
- **§7.3**：`chain_group.proxies` 数组必须非空（理论上 `buildChainGroups` 已过滤空组，本断言用于防止下游手改破坏该约束）。
- **dialer-proxy 一致性**：任何 `proxies[i]["dialer-proxy"]` 必须是一个现存的 `proxy-group.name`。

---

## 七、规则装配

### 7.1 数据源

- `definitions/rules/inlineRules.yaml` —— 仅一个字段 `prependRules: string[] | null`，用于声明需要**前置插入**到规则列表最顶端的 Mihomo 规则。
- `definitions/rules/ruleProviders.yaml` —— 对象字典，键为 provider ID，值为 provider 定义。

### 7.2 provider 字段约定

| 字段 | 必填 | 说明 |
|------|------|------|
| `type` | 是 | `http` / `file` 等，透传给 Mihomo |
| `behavior` | 是 | `domain` / `ipcidr` / `classical`，透传 |
| `url` | 是（http 时） | 远程规则 URL |
| `path` | 是 | Mihomo 本地缓存路径 |
| `interval` | 否 | 刷新间隔（秒） |
| `format` | 是 | `yaml` / `text` / `mrs`（当前仓库全部用 `mrs`） |
| `target-group` | 是（本仓库扩展字段） | `groupDefinitions` 中的稳定 ID；`assembleRuleSet` 读取后从输出中剔除 |
| `no-resolve` | 否（本仓库扩展字段） | 布尔；为真时生成的 RULE-SET 规则带 `,no-resolve` 尾缀，同时从输出 provider 中剔除 |

**扩展字段 `target-group` / `no-resolve` 不会出现在最终 `rule-providers` 里**——`assembleRuleSet` 在构造输出 provider 对象时主动跳过这两个键。

### 7.3 prependRules 规范化（`normalizePrependRules`）

```
rules = normalizePrependRules(inlineRules, groupDefinitions) 作为基础数组
然后逐条 ruleProvider 追加 RULE-SET 规则
最后追加一条 MATCH,<fallback.name>
```

规范化约束：

- `prependRules == null` → 返回空数组（容忍 YAML 空列表 / 省略字段）。
- 否则必须是字符串数组；每条非空且非 `MATCH,*`。
- `extractRuleTarget` 解析出目标组名：规则以 `,` 分割后倒数第一段；若倒数第一段是 `RULE_TRAILING_OPTIONS`（目前仅 `no-resolve`）中的值，则取倒数第二段。
- 目标必须是 `BUILTIN_RULE_TARGETS`（`COMPATIBLE / DIRECT / DNS / PASS / REJECT / REJECT-DROP`）或 `groupDefinitions[*].name` 之一；否则抛 `Prepend rule references unknown target`。

### 7.4 provider → RULE-SET

```js
for (const [providerId, providerDefinition] of Object.entries(ruleProviders)) {
  const targetGroup = groupDefinitions[providerDefinition["target-group"]];
  rules.push(providerDefinition["no-resolve"]
    ? `RULE-SET,${providerId},${targetGroup.name},no-resolve`
    : `RULE-SET,${providerId},${targetGroup.name}`);
}
```

顺序 = `ruleProviders.yaml` 中的 YAML 对象键声明顺序，并等于运行时匹配顺序（先匹配先生效）。

### 7.5 fallback MATCH

函数返回前断言 `groupDefinitions[FALLBACK_GROUP_ID].name` 存在，失败抛错；随后追加 `MATCH,${fallback.name}`。

### 7.6 规则格式选择

当前仓库全部 `format: mrs`，URL 指向 MetaCubeX `meta-rules-dat` 的 `meta` 分支 `.mrs` 二进制文件。选择 mrs 的理由：

- 加载速度明显快于 yaml 明文。
- 规则体积更小，对缓存和带宽都更友好。
- v1 不追求"规则可读性"——规则内容以上游为准，本仓库只决定如何组装。

如果未来需要调试某条规则，可以把个别 provider 切回 `format: yaml` + 同路径的 `.yaml` 文件；字段其余保持不变。

---

## 八、运行时预设（`runtime-preset`）

`scripts/override/lib/runtime-preset.js:applyRuntimePreset(config)` 就地修改传入的 config（返回同一引用）。处理规则：

| 分段 | 合并策略 |
|------|----------|
| `base` / `profile` / `geodata` | 无条件覆盖：所有字段逐键 `cloneData` 写入 |
| `sniffer` | 无条件覆盖：`config.sniffer = cloneData(snifferConfig)` |
| `dns` | 无条件覆盖：`config.dns = cloneData(dnsConfig)` |
| `allow-lan` | 仅当 `config["allow-lan"] === undefined` 时注入 `false` |
| `tun` | 仅当 `config.tun` falsy 时注入预设 |

**设计理由**：

- DNS / sniffer / tun / geodata 的正确性对路由有决定性影响，用户部分覆盖极易导致泄漏或路由失效，因此这些分段采取"订阅工具自带什么，我直接覆盖"的策略。
- `allow-lan` 与 `tun` 牵涉本地网络栈，用户如果已经在订阅工具里手动配置就应被保留。

`cloneData` 在 `scripts/override/lib/utils.js`，实现为 `JSON.parse(JSON.stringify(...))`，是项目中唯一的深拷贝入口。由于 YAML 载荷必然是 JSON 可序列化的，该实现对所有 preset 数据有效。

---

## 九、覆写脚本主函数

### 9.1 入口契约

```js
// dist/scripts/override/main.js 暴露：globalThis.main 与 module.exports.main
function main(config = {}) { ... return workingConfig; }
```

输入：`{ proxies: Array<{ name: string, ... }>, ...任意其它 Mihomo 字段 }`。订阅工具会先帮我们解析完节点列表，`main` 接到的 `config` 至少包含 `proxies`。

输出：原对象被就地扩充后返回（同一引用）。

### 9.2 模块加载期

- `validateChainsSchema(chainDefinitions, transitDefinitions)` 在 `main` 定义**之外**执行一次，让 YAML schema 错误在脚本加载时就抛出，而不是延迟到首次调用 `main`。

### 9.3 运行时 8 步 pipeline

| # | 操作 | 关键对象 |
|---|------|----------|
| 1 | `applyRuntimePreset(workingConfig)` | 写入 base/profile/geodata/sniffer/dns/(tun)/(allow-lan) |
| 2 | `namedProxies = getNamedProxies(workingConfig.proxies)` | 若为空 → 打印错误日志并返回（跳过下列所有步骤） |
| 3 | `{ chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefinitions)` | 抽出落地节点 |
| 4 | `{ groups: transitGroups, idToName: transitIdToName } = buildTransitGroups(remainingProxies, transitDefinitions)` | 抽出中转节点；计算 `chainsEffective` |
| 5 | `workingConfig["proxy-groups"] = buildProxyGroups(remainingProxies, groupDefinitions, { chainGroups: chainsEffective ? chainGroups : [], transitGroups: chainsEffective ? transitGroups : [] })` | 生成策略组；`chainsEffective=false` 时 chain/transit 数组置空，让 `@chain-groups` 展开为空 |
| 6 | `applyProxyChains(workingConfig, chainDefinitions, transitIdToName)`（仅 `chainsEffective` 时） | 注入 `dialer-proxy` |
| 7 | `const { providers, rules } = assembleRuleSet(groupDefinitions, ruleProviders, inlineRulesConfig)` → 写回 `config["rule-providers"]` 与 `config.rules` | |
| 8 | `validateOutput(workingConfig, groupDefinitions, { chainDefinitions, transitDefinitions })` | 生产环境下如果任一断言不过，`main` 直接抛错（fail-fast） |

### 9.4 空节点兜底

当订阅解析后 `namedProxies.length === 0`：

```
[override] ERROR: config.proxies 为空，无法生成策略组和分流规则
[override] 已应用 runtime preset，跳过 proxy-groups、rule-providers 和 rules 生成
```

此时只保留第 1 步的结果，不生成 `proxy-groups` / `rule-providers` / `rules`。下游 Mihomo 会因为缺路由规则跑不起来，但至少 DNS/TUN 预设已注入——这让用户立刻看到"节点列表为空"而不是静默出错。

---

## 十、校验体系

三层校验：

### 10.1 构建时（`tools/yaml-to-js.js`）

- **目录布局**：`validateCanonicalLayout` 拒绝 `definitions/` 下不认识的子目录。
- **placeholders 模式**：`validatePlaceholdersSchema` 按 §3.2 列举的 5 项约束校验 `placeholders.yaml`。
- **交叉引用**：加载 `groupDefinitions.yaml` 的 ID 集合后，验证 `reserved` / `fallback` / 每个 `kind=ref` 的 `target` 都在该集合中。
- **历史目录清理**：`LEGACY_GENERATED_DIRS = ["runtime"]`，旧的 `scripts/config/runtime/` 目录每次构建都会被清掉，避免旧产物干扰。

### 10.2 构建后（`tools/verify-main.js`）

`npm run verify` 会先 `npm run build` 再跑 `tools/verify-main.js`。测试集合包含 30+ 用例，覆盖：

- **单元**：`buildChainGroups` / `buildTransitGroups` / `applyProxyChains` / `validateChainsSchema` 的基本、边界、错误分支；`buildProxyGroups` 的 extras 注入顺序；`@chain-groups` 占位符展开；`remainingProxies` 从 `@all-nodes` 剔除落地节点。
- **端到端**：
  - `testBundlePositivePath` —— 加载 bundle，驱动 `main`，比对 rule-providers 剥离 `target-group`/`no-resolve` 后与生成配置一致；`rules = prependRules + RULE-SET[] + MATCH` 顺序与数量严格匹配；bundle 不得包含历史路径字符串。
  - `testBundleChainsEndToEnd` —— 用 `chains.yaml` 的声明动态派生期望，验证 bundle 内的 chain/transit 组与 dialer-proxy 注入。
  - `testRuntimeInjectionSemantics` / `testNoProxyFallback` —— 覆盖 §8 的条件注入与空节点兜底。
- **构建管线**：`testBuildYamlModules*` 用临时工作区修改 `placeholders.yaml`（删字段、改 fallback、改 ref target），断言构建失败且错误信息定位。
- **生成产物扫描**：`assertGeneratedFiles` 扫描 `definitions/*/*.yaml` 并断言对应的 `scripts/config/*/*.js` 存在；同时拒绝 `scripts/config/assets` 与 `scripts/config/runtime` 的产物泄漏。
- **自定义资产**：`assertCustomAssetCopy` 比对 `definitions/assets/custom/_template.yaml` 与 `dist/assets/custom/_template.yaml` 逐字节一致。

### 10.3 运行时（`scripts/override/lib/validate-output.js`）

`validateOutput(config, groupDefinitions, chainsContext)` 在 `main` 每次返回前执行，断言集合：

1. fallback 组必须在 `groupDefinitions` 中存在且有 `name`。
2. `proxy-groups` 与 `rules` 都非空。
3. `groupDefinitions` 中的每个 `name` 必须出现在最终 `proxy-groups` 中（防止因代码 bug 漏生成）。
4. 每个组的 `proxies` 非空，且不得包含未展开的 `@` 占位符。
5. 链式代理启用时：§7.2 与 §7.3（见 §6.8）。
6. 所有 `rules[i]` 是字符串；`RULE-SET,...` 的 target 在 `proxy-groups.name` 集合中；`MATCH` 只能在末位且必须 `MATCH,<fallback.name>`。
7. 所有 `proxies[i]["dialer-proxy"]`（若存在）必须指向一个现存的 `proxy-group.name`。

---

## 十一、仓库目录结构

### 11.1 源树

```
proxy-config-hub/
├── build.js
├── package.json
├── CLAUDE.md
│
├── definitions/
│   ├── mihomo-preset/
│   │   ├── base.yaml
│   │   ├── dns.yaml
│   │   ├── geodata.yaml
│   │   ├── profile.yaml
│   │   ├── sniffer.yaml
│   │   └── tun.yaml
│   ├── proxy-groups/
│   │   ├── chains.yaml
│   │   ├── groupDefinitions.yaml
│   │   ├── placeholders.yaml
│   │   └── regions.yaml
│   ├── rules/
│   │   ├── inlineRules.yaml
│   │   └── ruleProviders.yaml
│   └── assets/
│       └── custom/
│           └── _template.yaml            # 不编译，仅复制
│
├── scripts/
│   ├── override/
│   │   ├── main.js
│   │   └── lib/
│   │       ├── proxy-chains.js           # 链式代理构建 + dialer-proxy 注入
│   │       ├── proxy-groups.js           # 区域/保留/自定义组构建；占位符展开
│   │       ├── rule-assembly.js          # prepend + RULE-SET + MATCH
│   │       ├── runtime-preset.js         # base/profile/geodata/sniffer/dns/(tun)/(allow-lan)
│   │       ├── utils.js                  # cloneData
│   │       └── validate-output.js        # 运行时断言
│   ├── sub-store/
│   │   └── rename.js                     # Sub-Store 专用节点改名脚本
│   └── config/                           # 全量由 yaml-to-js 生成，禁止手改
│
├── tools/
│   ├── lib/
│   │   ├── bundle-runtime.js             # VM 加载 bundle 并执行 main（供 verify/example 用）
│   │   ├── fs-helpers.js                 # pathExists / listEntries / copyDirectory / copyFile
│   │   └── paths.js                      # REPO_ROOT / DEFINITIONS_DIR / COPY_ASSETS 等
│   ├── check-rule-overlap.js             # 远程拉取规则做域/IP 重叠分析
│   ├── generate-example-config.js        # npm run example:config
│   ├── verify-main.js                    # npm run verify 的真正实现
│   └── yaml-to-js.js                     # definitions → scripts/config
│
├── templates/
│   └── mihomo/
│       └── config-example.yaml           # verify-main 和 example:config 用作模板输入
│
├── docs/
│   └── DESIGN.md                         # 本文件
│
└── .github/
    └── workflows/
        └── build.yaml                    # CI 工作流（注意是 .yaml）
```

### 11.2 发布目录（`dist/` 分支）

```
dist/
├── scripts/
│   ├── override/
│   │   └── main.js                       # esbuild IIFE bundle
│   └── sub-store/
│       └── rename.js
├── assets/
│   └── custom/
│       └── _template.yaml                # 由 build.js 从 definitions/assets/custom/ 复制
└── example-full-config.yaml              # 可选；由 npm run example:config 生成，非 CI 产物
```

### 11.3 用户引用 URL

```
# 覆写脚本（Mihomo Party / Clash Verge Rev / Sub-Store）
https://cdn.jsdelivr.net/gh/{OWNER}/proxy-config-hub@dist/scripts/override/main.js

# Sub-Store 节点改名
https://cdn.jsdelivr.net/gh/{OWNER}/proxy-config-hub@dist/scripts/sub-store/rename.js

# 自定义规则集
https://cdn.jsdelivr.net/gh/{OWNER}/proxy-config-hub@dist/assets/custom/<filename>
```

---

## 十二、CI/CD

`.github/workflows/build.yaml`：

```
push to main / workflow_dispatch
  └─ jobs.build (ubuntu-latest, Node 24)
        ├─ npm ci
        ├─ npm run build      # rules:build + esbuild
        ├─ npm run verify     # 会重新执行一次 build（幂等），再跑 verify-main
        ├─ peaceiris/actions-gh-pages@v4
        │     publish_dir=dist, publish_branch=dist, force_orphan=true
        └─ curl https://purge.jsdelivr.net/gh/<repo>@dist/<每个文件> （失败仅 WARN）
```

注：`npm run verify` 的定义是 `npm run build && npm run verify:main`，所以 CI 里 `npm run build` + `npm run verify` 会跑两次 build；这不是性能问题（esbuild 很快），当前接受该冗余。

`rule-provider` 引用的 MetaCubeX URL 是运行时第三方依赖；如果未来要完全自控交付面，可在 CI 中同步远程规则到自己的 CDN，并改写 `ruleProviders.yaml` 的 `url`。v1 不做此优化。

---

## 十三、保留的设计决策与理由

| 决策 | 理由 |
|------|------|
| 所有声明都放 `definitions/*.yaml`，禁止手改 `scripts/config/` | 避免 JS 常量与 YAML 文档互相漂移；新区域/新组只改 YAML |
| 占位符用 `@`-前缀 + 统一 `placeholders.yaml` 表 | 把"引用保留组"与"引用运行时上下文"两类展开统一到同一查找表；新增不改代码 |
| `buildProxyGroups` 接受 `{chainGroups, transitGroups}` 作为 extras | chain/transit 是运行时产物（依赖节点列表），不能放进 `groupDefinitions`，但需要按固定顺序插入到策略组输出里 |
| `chainsEffective` 退化而不是抛错 | 订阅解析出来的节点不含 landing（或全是 landing）是常态；链路跑不起来时应该退化为普通配置而不是整体失败 |
| `validateChainsSchema` 在模块加载期跑 | 区分"YAML 写错"（启动即崩）与"运行期成员过滤空"（WARN）两种场景 |
| `validateOutput` 在 `main` 返回前兜底 | 即使未来某个 `buildXxx` 有 bug，坏掉的配置不会静默发布给用户 |
| `format: mrs` 优先 | 加载速度 / 带宽占用都更优；调试时可按需切回 yaml |
| runtime preset 中 DNS/sniffer 无条件覆盖，`allow-lan`/`tun` 条件注入 | DNS / sniffer 错配直接泄漏；`allow-lan`/`tun` 涉及本地网络栈，用户预设应被尊重 |
| 声明顺序 = 规则匹配顺序 | `ruleProviders.yaml` 与 `inlineRules.yaml` 都按 YAML 顺序生效，无全局 order 字段 |
| 脚本不联网 | 规则拉取全部交给 Mihomo 运行时；脚本自身是纯函数 |

---

## 附录 A：自定义规则集模板

`definitions/assets/custom/_template.yaml` 被原样复制到 `dist/assets/custom/_template.yaml`：

```yaml
# 文件名即规则集 ID，使用 classical behavior
# 支持的规则类型：DOMAIN, DOMAIN-SUFFIX, DOMAIN-KEYWORD, IP-CIDR, IP-CIDR6
#
# 添加步骤：
# 1. 复制此文件并重命名（如 my-service.yaml）
# 2. 在 definitions/rules/ruleProviders.yaml 中声明新的 provider
# 3. 指定 target-group 为 definitions/proxy-groups/groupDefinitions.yaml 中已有的 id
# 4. 提交后 CI 自动构建到 dist 分支

payload:
  - DOMAIN-SUFFIX,example.com
  - DOMAIN,www.example.com
  - IP-CIDR,1.2.3.0/24,no-resolve
```

在 `ruleProviders.yaml` 中引用时 `url` 指向 `https://cdn.jsdelivr.net/gh/<owner>/proxy-config-hub@dist/assets/custom/<filename>`，`format: yaml`（因为自定义模板是 yaml 明文），`behavior: classical`。

---

## 附录 B：已知局限与演进方向

- **区域识别依赖节点名**：纯 IP / 编号命名的节点会全部落入 `OTHER`。可考虑 v2 基于 rtt / GeoIP 探测，但脚本不联网的约束意味着需要订阅工具辅助。
- **自动测速组节点数暴涨**：`auto_select` 当前 `proxies: ["@all-nodes"]`，上百节点会产生明显测速流量。可改为"每区域各自 url-test + 顶层 fallback"。
- **单一入口 `main.js`**：原设计里的 `routing-only.js` / `dns-leak-fix.js` 尚未实现；如有需求，二者都可以复用 `lib/*` 模块，入口文件只决定跳过哪些阶段（前者跳过 runtime preset，后者只保留 dns）。
- **Sub-Store 兼容性**：`module.exports = { main }` 兼容 Sub-Store 的 CommonJS loader，但未针对其特有运行环境（如 iOS JSC）做语法降级；若用户反馈负向后行断言失败，需要在 `regions.yaml` 用非负向断言重写正则。
- **规则缺失回退**：目前假设上游 `meta-rules-dat` 总能覆盖所需规则。若某条上游规则被删除，需要在本仓库 `definitions/assets/custom/` 下补一个本地规则集，并在 `ruleProviders.yaml` 里把 URL 切到自己的 CDN。
- **MATCH 前可扩展插入点**：`rules = prependRules + RULE-SET[] + MATCH` 三段已固定；如果需要"在 RULE-SET 之后、MATCH 之前"再插入自定义规则，需要扩展 `inlineRules.yaml` 为 `{ prependRules, appendRules }` 结构并在 `assembleRuleSet` 中增加第三段拼接。
