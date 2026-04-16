# @chain-groups 占位符与落地节点隔离设计

- 日期：2026-04-17
- 状态：Approved
- 范围：在 groupDefinitions 中支持 `@chain-groups` 占位符，并将落地节点从常规组中隔离

## 1. 背景与目标

当前链式代理已实现（见 `2026-04-17-chain-proxy-design.md`），但存在两个问题：

1. **落地节点泄漏**：`main.js` 将全量 `namedProxies`（含落地节点）传给 `buildProxyGroups`，导致落地节点通过 `@all-nodes` 和 `@region-groups` 出现在所有常规策略组中。落地节点应该只出现在落地组（chain_group）中。
2. **缺少引用方式**：`groupDefinitions.yaml` 中无法引用链式代理的落地组，用户不能在特定策略组（如 AI 服务、流媒体）中选择通过链式代理访问。

本次新增 `@chain-groups` 占位符，与 `@region-groups` 对称，展开为所有已构建的 chain_group 组名。

## 2. 设计

### 2.1 数据流变更（main.js）

将 `buildProxyGroups` 的第一个参数从 `namedProxies` 改为 `remainingProxies`（由 `buildChainGroups` 剔除落地节点后返回）。

```js
// 改动前
workingConfig["proxy-groups"] = buildProxyGroups(namedProxies, groupDefinitions, { ... });

// 改动后
workingConfig["proxy-groups"] = buildProxyGroups(remainingProxies, groupDefinitions, { ... });
```

退化行为：当 `chainDefinitions` 为空时，`buildChainGroups` 返回的 `remainingProxies` 等于全量节点副本，行为与改动前一致。

### 2.2 占位符扩展（proxy-groups.js）

在 `expandGroupTarget` 中新增 `@chain-groups` 分支：

```js
if (target === "@chain-groups") {
  return [...context.chainGroupNames];
}
```

context 构建：`buildProxyGroups` 已通过 `extras.chainGroups` 接收链式代理组数组，直接提取名称：

```js
const chainGroupNames = chainGroups.map((group) => group.name);
const context = {
  allProxyNames,
  regionGroupNames: ...,
  chainGroupNames,   // 新增
  groupDefinitions,
};
```

空数组退化：`extras.chainGroups` 为空时，`chainGroupNames` 为 `[]`，`@chain-groups` 展开为空，不影响组的 proxies 列表。

### 2.3 groupDefinitions.yaml 更新

规则：凡包含 `@region-groups` 的组，在其前面插入 `@chain-groups`。

涉及的组：`proxy_select`（无 `@region-groups`，不加）、`manual_select`（无，不加）、`auto_select`（无，不加）、`ad_block`（无，不加）。其余所有组均加。

插入位置示例：

```yaml
# 代理优先模式
proxies: ["@proxy-select", "@manual-select", "@auto-select", "DIRECT", "@chain-groups", "@region-groups"]

# DIRECT 优先模式
proxies: ["DIRECT", "@proxy-select", "@manual-select", "@auto-select", "@chain-groups", "@region-groups"]
```

### 2.4 验证

- `expandGroupTarget` 现有的未知 `@` 前缀检查会自动放行已注册的 `@chain-groups`，无需额外改动。
- `buildProxyGroups` 现有的组名重复检测覆盖 chain/transit 组，无需新增逻辑。
- `tools/verify-main.js` 无需改动（动态扫描机制）。

## 3. 文件变更清单

| 文件 | 改动 |
| --- | --- |
| `scripts/override/main.js` | `buildProxyGroups` 第一参数改为 `remainingProxies` |
| `scripts/override/lib/proxy-groups.js` | context 新增 `chainGroupNames`；`expandGroupTarget` 新增 `@chain-groups` 分支 |
| `definitions/proxy-groups/groupDefinitions.yaml` | 所有含 `@region-groups` 的组前插入 `@chain-groups` |

## 4. 不改动

- `chains.yaml` / `placeholders.yaml` / `regions.yaml`
- `tools/lib/paths.js`
- `tools/verify-main.js`
- `build.js`、CI 流程
