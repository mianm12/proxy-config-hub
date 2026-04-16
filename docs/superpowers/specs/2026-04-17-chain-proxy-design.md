# 链式代理 (Chain Proxy) 设计

- 日期：2026-04-17
- 状态：Approved (v2)
- 范围：为覆写脚本最终生成的 Mihomo 配置增加链式代理（`dialer-proxy`）能力

## 1. 背景与目标

Mihomo 通过在 proxy 对象上添加 `dialer-proxy: <proxyOrGroupName>` 字段，可将该节点的出站拨号交由另一个节点/策略组承担，形成 `客户端 → 前置(entry) → 落地(landing) → 目标` 的链路。

本需求要在现有 `scripts/override/main.js` 构建管线中，以声明式 YAML 的方式为用户提供链式代理能力，并覆盖三类场景：

- A. 固定落地 + 固定前置：落地节点（自建 VPS 等）固定经由某个前置商业节点出站。
- B. 前置可在面板运行时切换：前置目标是策略组，用户在 Mihomo 面板直接切换前置节点。
- C. 双订阅组合：前置与落地来自不同订阅，由上游（Sub-Store / `proxy-providers`）先合并为同一 `config.proxies`，覆写脚本只负责区分与串联。

场景 D（per-rule 选链）和多层嵌套链不在本次范围内。

## 2. 术语

- **landing 节点**：名称匹配任意 `chain_group[].landing_pattern` 的节点。链的"链尾"，最终出站位置。
- **transit 节点**：链路中间的前置出口，由 `transit_group[]` 定义。transit 成员从"非 landing 节点"集合中选出。
- **chain_group**：面向用户的"落地组"，聚合所有命中同一 landing_pattern 的节点，作为 Mihomo `proxy-groups` 的一等公民在面板展示。
- **transit_group**：面向用户的"中转组"，聚合 transit 候选节点；通过 `dialer-proxy` 被 landing 节点引用。

## 3. 数据模型

新增 `definitions/runtime/chains.yaml`，由 `tools/yaml-to-js.js` 按现有 namespace 机制自动编译到 `scripts/config/runtime/chains.js`（`paths.js` 无需改动）。

```yaml
# 中转组定义。每个元素对应面板上的一个中转策略组。
transit_group:
  - id: transit                 # 必填，内部唯一标识，供 chain.entry 引用
    name: "🔀 中转"             # 必填，Mihomo 策略组 name（面板展示名）
    transit_pattern: ""         # 选填，空 = 所有非 landing 节点；非空则在候选上再做正则过滤
    flags: i                    # transit_pattern 的正则 flags（与 regions.yaml 风格一致）
    type: select                # Mihomo 策略组 type：select / url-test 等

# 落地/链定义。每个元素对应一个落地策略组 + 一条链路的注入规则。
chain_group:
  - id: chain                   # 必填，内部唯一标识
    name: "🚪 落地"             # 必填，Mihomo 策略组 name
    landing_pattern: "自建|Relay|落地"  # 必填，匹配落地节点名的正则
    flags: i                    # landing_pattern 的正则 flags
    entry: transit              # 必填，引用 transit_group[].id
    type: select                # 落地组本身的 type
```

支持空值：`transit_group: []` 或 `chain_group: []` 或整个文件缺失 → 完全不启用链式代理，配置与启用前完全等价。

## 4. 约束与校验

在编译期或运行期（`yaml-to-js.js` 或 `applyProxyChains` 入口）执行以下校验，任一失败抛 error（配置错误必须暴露）：

1. **id 唯一性**：`transit_group[].id` 集合内唯一；`chain_group[].id` 集合内唯一。
2. **name 全局唯一**：`transit_group[].name`、`chain_group[].name` 与 `regions.yaml` 产出的区域组名、`groupDefinitions.yaml` 中所有组名、保留组名不得重复。
3. **entry 引用完整性**：每个 `chain_group[].entry` 必须等于某个 `transit_group[].id`。
4. **正则可编译**：`landing_pattern` 与 `transit_pattern` 必须是合法正则（空 `transit_pattern` 视为不过滤）。

## 5. 架构改动

### 5.1 新模块

`scripts/override/lib/proxy-chains.js`，导出：

```js
/**
 * 提取落地节点并构建 chain_groups。
 * @param {Array<{name:string}>} namedProxies
 * @param {Array<ChainGroupDef>} chainDefinitions
 * @returns {{ chainGroups: Group[], remainingProxies: Array<{name:string}> }}
 *   chainGroups: 每个 chain_group 定义对应一个非空组对象；空组被跳过并 WARN
 *   remainingProxies: 从 namedProxies 中剔除所有 landing 节点后的剩余数组
 *
 * 行为：
 *   - 按 chain_group 数组顺序编译 landing_pattern
 *   - 每个节点按 first-match-wins 分配给首个匹配的 chain_group
 *   - 已被某个 chain_group 捕获的节点，若又命中另一个 chain_group.landing_pattern → WARN（仅归属首个）
 */
function buildChainGroups(namedProxies, chainDefinitions) {}

/**
 * 基于剔除 landing 后的剩余节点构建 transit_groups。
 * @param {Array<{name:string}>} remainingProxies
 * @param {Array<TransitGroupDef>} transitDefinitions
 * @returns {{ groups: Group[], idToName: Map<string,string> }}
 *   groups: 非空的 transit 组数组（成员为空的被跳过并 WARN）
 *   idToName: 仅包含成功构建的 transit 的 id -> name 映射，供 applyProxyChains 解析 chain.entry
 *
 * 行为：
 *   - 空 transit_pattern → 成员 = remainingProxies 全部
 *   - 非空 transit_pattern → 在 remainingProxies 上做正则过滤
 */
function buildTransitGroups(remainingProxies, transitDefinitions) {}

/**
 * 为 landing 节点注入 dialer-proxy。
 * @param {object} config - 工作中的 Mihomo config
 * @param {Array<ChainGroupDef>} chainDefinitions
 * @param {Array<ChainGroupDef>} chainDefinitions
 * @param {Map<string,string>} transitIdToName - 来自 buildTransitGroups 的 idToName
 *
 * 行为：
 *   - 对每个 chain：若 transitIdToName.get(chain.entry) 未定义 → WARN 并跳过该 chain
 *   - 否则遍历 config.proxies：
 *       - 匹配 landing_pattern 且无 dialer-proxy → 注入 proxy["dialer-proxy"] = transit.name
 *       - 已有 dialer-proxy → 保留原值 + WARN（尊重用户/订阅预设）
 */
function applyProxyChains(config, chainDefinitions, transitIdToName) {}
```

### 5.2 现有模块修改

- `scripts/override/lib/proxy-groups.js`：`buildProxyGroups` 签名扩展一个可选对象参数 `{ chainGroups, transitGroups }`，按 §5.4 指定位置插入。若两者均为空数组则行为与旧版完全一致。
- `scripts/override/lib/validate-output.js`：新增断言（见 §6）。
- `scripts/override/main.js`：调用新的构建函数并衔接 pipeline。

### 5.3 main.js pipeline

```js
applyRuntimePreset(workingConfig);

if (namedProxies.length === 0) { /* 维持现有早退分支 */ }

const { chainGroups, remainingProxies } =
  buildChainGroups(namedProxies, chainDefinitions);

const { groups: transitGroups, idToName: transitIdToName } =
  buildTransitGroups(remainingProxies, transitDefinitions);

// 所有 transit_group 均为空 → 整体跳过链式代理
const chainsEffective = transitGroups.length > 0 && chainGroups.length > 0;

workingConfig["proxy-groups"] = buildProxyGroups(namedProxies, groupDefinitions, {
  chainGroups: chainsEffective ? chainGroups : [],
  transitGroups: chainsEffective ? transitGroups : [],
});

if (chainsEffective) {
  applyProxyChains(workingConfig, chainDefinitions, transitIdToName);
}

const { providers, rules } = assembleRuleSet(...);
workingConfig["rule-providers"] = providers;
workingConfig.rules = rules;

validateOutput(workingConfig, groupDefinitions);
```

### 5.4 proxy-groups 顺序

从面板顶部到底部：

1. 保留组（`proxy_select` / `manual_select` / `auto_select`）
2. 其他自定义组（`groupDefinitions.yaml` 中非保留、非 fallback）
3. **chain_groups（落地）**
4. **transit_groups（中转）**
5. 区域组
6. fallback 组

这个顺序让用户在面板上看到的层级是"顶层入口 → 应用分流 → 落地出口 → 前置入口 → 地区 → 兜底"，语义自顶向下。

## 6. 退化与空集行为

| 条件 | 行为 |
| --- | --- |
| `chains.yaml` 不存在 或 `chain_group: []` | 不启用链式代理；configs 与启用前完全一致 |
| 所有 `transit_group` 过滤后成员为空 | **整体跳过**：不构建 chain_groups 也不构建 transit_groups，不注入 dialer-proxy（WARN） |
| 某个 `transit_group` 为空（但其他非空） | 跳过该 transit（WARN）；指向它的所有 chain 连带跳过（WARN），其他 chain 正常 |
| 某个 `chain_group` 未命中任何节点 | 跳过该 chain_group（WARN），其他 chain 正常 |
| landing 节点名已被上游/用户设置了 `dialer-proxy` | 保留原值（WARN），不覆盖 |
| 一个节点名同时命中多个 `chain_group.landing_pattern` | first-match-wins 归属首个匹配的 chain_group（WARN） |

所有退化路径均以 WARN 形式记录日志，不抛 error。保持与现有 `main.js:20` "proxies 为空时只应用 runtime preset" 的容错风格一致——用户拿到的始终是可加载的配置。

## 7. validate-output 增强

在 `validate-output.js` 追加以下断言（不变量级校验，失败抛 error）：

1. 任何 proxy 的 `dialer-proxy` 字段值必须等于某个实际构建的 `transit_group` 的 name。
2. 每个实际构建的 `transit_group.proxies` 中任一成员名，不得命中任何 `chain_group.landing_pattern`（防环双保险）。
3. 每个实际构建的 `chain_group.proxies` 非空（空已在构建期跳过；此处作不变量断言捕获回归）。
4. 所有 proxy-groups 的 name 全局唯一（已有断言的扩展，确保新加入的 chain/transit 组名不与其他组冲突）。

## 8. 测试与验收

无测试框架；沿用现有 `tools/verify-main.js` / `tools/verify-yaml-migration.js` 风格。

在 `tools/verify-main.js` 中扩展以下场景（基于 vm 执行 bundle 后断言输出结构）：

1. **基础场景**：`chains.yaml` 含一个 transit + 一个 chain；订阅含 HK/JP 商业节点 + 若干 "自建-*" 节点。断言：
   - `proxy-groups` 按 §5.4 顺序包含 🔀 中转 和 🚪 落地
   - 🔀 中转 成员不含任何 "自建-*"
   - 🚪 落地 成员仅为 "自建-*"
   - 所有 "自建-*" proxy 具有 `dialer-proxy: "🔀 中转"`
   - 商业节点无 `dialer-proxy`
2. **退化：transit 全空**：订阅中全部节点都匹配 landing_pattern。断言：不构建 chain/transit 任何组，proxies 无 dialer-proxy，WARN 被触发。
3. **退化：chain 未命中**：订阅无任何 "自建-*"。断言：chain_group 被跳过，transit_group 可能照常构建（但无节点会引用它）。
4. **冲突：上游已设 dialer-proxy**：预置某个 landing 节点已带 `dialer-proxy`。断言：保留原值，WARN 被触发。
5. **配置错误**：构造 `entry` 指向不存在的 transit.id，断言抛 error。

同时更新 `tools/gen-example-config.js`（`npm run example:config`）让样例配置包含 chains.yaml 产物，便于肉眼检查。

## 9. YAGNI 边界（本次不做）

- 嵌套链（A → B → C → landing）。Mihomo 支持，但声明式表达复杂度高，无明确驱动。
- per-rule 链路选择（不同规则走不同链）。
- landing 节点的名称重写 / 展示改写。节点名保持订阅原样。
- chain_group 引用策略组作为 entry（v2 约定 entry 必须指向 transit_group.id；未来如需直接指向区域组可再扩展 schema）。
- transit_group 按地区自动派生（当前以正则显式选择；未来如有"transit 只取某区域"需求，可基于 `transit_pattern` 或新增 `source_region` 字段扩展）。

## 10. 实施边界与文件清单

预计改动：

- 新增 `definitions/runtime/chains.yaml`
- 新增 `scripts/override/lib/proxy-chains.js`
- 修改 `scripts/override/main.js`（pipeline 衔接）
- 修改 `scripts/override/lib/proxy-groups.js`（新增可选参数、调整组插入顺序）
- 修改 `scripts/override/lib/validate-output.js`（新增断言）
- 修改 `tools/verify-main.js`（新增场景）
- 编译产物 `scripts/config/runtime/chains.js` 由 `yaml-to-js.js` 自动生成

不改动：

- `tools/lib/paths.js`（新 YAML 仍在 `definitions/runtime/` 已注册 namespace）
- `build.js` 、CI / GitHub Actions 流程
- `regions.yaml` / `placeholders.yaml` / `groupDefinitions.yaml`
