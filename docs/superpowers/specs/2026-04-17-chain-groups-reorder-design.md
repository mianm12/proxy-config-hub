# 链式代理组位置调整 设计文档

日期: 2026-04-17

## 背景

当前 `buildProxyGroups` 的插入顺序（见 `scripts/override/lib/proxy-groups.js:185-237`）为：

1. 保留组（3 个：代理选择 / 手动选择 / 自动选择）
2. 其他自定义组（核心 + 基础 + 扩展，约 30 个）
3. `chain_groups`（🚪 落地）
4. `transit_groups`（🔀 中转）
5. 区域组（约 27 个）
6. fallback（🐟 漏网之鱼）

链式组被挤在约 30 个业务自定义组与约 27 个区域组之间。在 Mihomo 客户端按 `proxy-groups` 数组顺序渲染的场景下，用户需要滚动三十余项才能找到"🚪 落地 / 🔀 中转"，体感定位成本高。

## 目标

把链式组（`chain_groups` / `transit_groups`）上移到保留组之后、其他自定义组之前，使其在订阅含自建节点时靠近列表顶部，便于快速查找与切换。

## 非目标

- 不调整 YAML 定义（`definitions/proxy-groups/groupDefinitions.yaml`、`chains.yaml`、`placeholders.yaml`）
- 不改变 `@chain-groups` 占位符展开规则
- 不改变 `dialer-proxy` 注入逻辑
- 不改变区域组、fallback、保留组自身的相对位置
- 不调整 chain 与 transit 的内部先后顺序（保持现状：chain 在前、transit 在后）

## 新顺序

`buildProxyGroups` 调整后的插入顺序：

1. 保留组（代理选择 / 手动选择 / 自动选择）
2. **`chain_groups`（🚪 落地）**
3. **`transit_groups`（🔀 中转）**
4. 其他自定义组（核心 + 基础 + 扩展）
5. 区域组
6. fallback（🐟 漏网之鱼）

即把当前步骤 3 / 4（链式）移到步骤 2（其他自定义组）之前，其余不变。

## 改动范围

### 1. `scripts/override/lib/proxy-groups.js`

`buildProxyGroups` 中的 push 顺序按新顺序重排。相关注释里描述顺序的一处（约 `proxy-groups.js:177-178`）同步更新：

```
// 顺序（自顶向下）：
//   保留组 → chain_groups → transit_groups → 其他自定义组 → 区域组 → fallback
```

无新增参数、无新增导出。

### 2. `tools/verify-main.js`

现有测试在 `verify-main.js:799-821` 中断言：

- `chainIndex > -1`
- `transitIndex > -1`
- `chainIndex < transitIndex`
- `transitIndex < regionIndex`
- 每一个 `groupDefinitions` 里的组索引 `< chainIndex`

新顺序下断言改为：

- `chainIndex > -1`、`transitIndex > -1` 保持
- `chainIndex < transitIndex` 保持
- `transitIndex < regionIndex` 保持
- `transitIndex < 每一个 groupDefinitions 非保留组的索引`（由原"自定义组 < chain"反转为"transit < 自定义组"）
- 追加：保留组索引 `< chainIndex`（确保保留组仍在链式之前）

相关注释同步调整。

### 3. `docs/DESIGN.md`

若 DESIGN.md 中描述了 `buildProxyGroups` 的最终顺序，同步到新顺序。实施阶段以 grep 为准，无相关描述则不改。

## 兼容性与副作用

- **空链式配置**：`extras.chainGroups` 与 `extras.transitGroups` 均为空数组时，新顺序与旧顺序等价输出（只是空数组上移，无实际元素）。既有无自建节点的订阅产物完全不受影响。
- **占位符引用**：业务组通过 `@chain-groups` 引用链式组 name。Mihomo 对 `proxy-groups` 内部的互相引用不要求拓扑序，引用方位于被引用方之后属于常规情况；反过来让被引用方前置也合法。无需联动改动。
- **组名重复检测**：`buildProxyGroups` 末尾的重名检测与顺序无关，保留。
- **`validateOutput` / `applyProxyChains`**：仅依赖组名与成员，不依赖顺序。无改动。

## 验证

1. `npm run verify` 通过（`verify-main.js` 中顺序断言按新顺序更新后应自然通过）
2. `npm run example:config` 生成的 `dist/example-full-config.yaml` 中：
   - 🚀 代理选择 / 🔧 手动选择 / ⚡ 自动选择 位于顶部
   - 🚪 落地 / 🔀 中转 紧随其后
   - 广告拦截、国内服务等业务组位于链式组之后
   - 区域组位于业务组之后
   - 🐟 漏网之鱼 位于最后
3. 人工抽查：业务组 proxies 数组中的 `@chain-groups` 展开仍为"🚪 落地"等名称，无丢失

## 风险

低。改动限于数组 push 顺序与测试断言，逻辑不变。潜在风险是遗漏更新 DESIGN.md 中的顺序描述——实施时 grep 确认。
