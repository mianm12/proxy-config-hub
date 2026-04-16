# 链式代理组位置调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `chain_groups` / `transit_groups` 的插入位置从"其他自定义组之后、区域组之前"上移到"保留组之后、其他自定义组之前"，降低用户在 Mihomo 客户端查找链式组的滚动成本。

**Architecture:** 仅调整 `buildProxyGroups`（`scripts/override/lib/proxy-groups.js`）中 push 的顺序；同步调整 `tools/verify-main.js` 内 `testBuildProxyGroupsInsertsChainAndTransit` 的顺序断言（保留组 < chain < transit < 其他自定义组 < 区域组）。无 YAML 改动、无新模块。

**Tech Stack:** Node.js (ESM)、node:assert/strict（verify 自测）、esbuild（bundle，不受本次改动影响）。

---

## Spec 参考

`docs/superpowers/specs/2026-04-17-chain-groups-reorder-design.md`

## 文件结构

- 修改：`scripts/override/lib/proxy-groups.js:177-237`（顺序注释 + push 顺序）
- 修改：`tools/verify-main.js:1-30`（新增 `placeholdersConfig` 导入）
- 修改：`tools/verify-main.js:760-824`（`testBuildProxyGroupsInsertsChainAndTransit` 顺序断言）

DESIGN.md §4.6 目前描述的是 v1 层级，原本就未涵盖 chain/transit，不在本次改动范围。

---

### Task 1: 调整 verify-main.js 测试期望（先让测试失败）

**Files:**
- Modify: `tools/verify-main.js:1-30`
- Modify: `tools/verify-main.js:760-824`

- [ ] **Step 1: 新增 placeholdersConfig 导入**

在 `tools/verify-main.js` 的 import 区（第 12 行 `regionsConfig` 之后）添加：

```javascript
import placeholdersConfig from "../scripts/config/proxy-groups/placeholders.js";
```

结果示例（第 11-13 行附近）：

```javascript
import ruleProvidersConfig from "../scripts/config/rules/ruleProviders.js";
import regionsConfig from "../scripts/config/proxy-groups/regions.js";
import placeholdersConfig from "../scripts/config/proxy-groups/placeholders.js";
import snifferConfig from "../scripts/config/mihomo-preset/sniffer.js";
```

- [ ] **Step 2: 改写 testBuildProxyGroupsInsertsChainAndTransit 顺序断言**

把 `tools/verify-main.js:760-824` 的函数替换为下面的版本。改动点：
1. 函数头注释描述改成"保留组之后、其他自定义组之前"。
2. 顶部保留的 fixture 与 `buildProxyGroups` 调用不变。
3. 顺序断言：保留组 < chain < transit < 非保留非 fallback 组 < regionIndex。

```javascript
/**
 * 校验 buildProxyGroups 的 extras 参数：chain_groups 和 transit_groups
 * 按约定位置（保留组之后、其他自定义组之前）插入。
 * @returns {void}
 */
function testBuildProxyGroupsInsertsChainAndTransit() {
  const namedProxies = [
    { name: "Sample-🇭🇰-Hong Kong-01" },
    { name: "Sample-🇯🇵-Japan-01" },
  ];
  const chainGroupFixture = {
    name: "🚪 落地",
    type: "select",
    proxies: ["自建-SG-Relay-01"],
  };
  const transitGroupFixture = {
    name: "🔀 中转",
    type: "select",
    proxies: ["Sample-🇭🇰-Hong Kong-01", "Sample-🇯🇵-Japan-01"],
  };

  const groupsWithoutExtras = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
  );
  const groupsWithExtras = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups: [chainGroupFixture], transitGroups: [transitGroupFixture] },
  );

  assert.equal(
    groupsWithExtras.length,
    groupsWithoutExtras.length + 2,
    "extras 非空时应额外增加 2 个组",
  );

  const names = groupsWithExtras.map((g) => g.name);
  const chainIndex = names.indexOf(chainGroupFixture.name);
  const transitIndex = names.indexOf(transitGroupFixture.name);
  // 从 regionsConfig 动态获取首个区域组的期望名称，避免硬编码 regions.yaml 的具体值
  const firstRegion = regionsConfig[0];
  const firstRegionGroupName = `${firstRegion.icon} ${firstRegion.name}`;
  const regionIndex = names.indexOf(firstRegionGroupName);

  assert.ok(chainIndex > -1, "应包含 chain_group");
  assert.ok(transitIndex > -1, "应包含 transit_group");
  assert.ok(chainIndex < transitIndex, "chain_group 应位于 transit_group 之前");
  if (regionIndex > -1) {
    assert.ok(transitIndex < regionIndex, "transit_group 应位于区域组之前");
  }

  // 保留组应位于 chain_group 之前
  const reservedIds = placeholdersConfig.reserved;
  const fallbackId = placeholdersConfig.fallback;
  for (const id of reservedIds) {
    const def = groupDefinitionsConfig.groupDefinitions[id];
    const idx = names.indexOf(def.name);
    assert.ok(
      idx > -1 && idx < chainIndex,
      `保留组 ${def.name} 应位于 chain_group 之前`,
    );
  }

  // 其他自定义组（非保留、非 fallback）应位于 transit_group 之后
  for (const id of Object.keys(groupDefinitionsConfig.groupDefinitions)) {
    if (reservedIds.includes(id) || id === fallbackId) continue;
    const def = groupDefinitionsConfig.groupDefinitions[id];
    const idx = names.indexOf(def.name);
    assert.ok(
      idx > -1 && idx > transitIndex,
      `自定义组 ${def.name} 应位于 transit_group 之后`,
    );
  }
}
```

- [ ] **Step 3: 跑 verify 确认在旧实现下失败**

运行：

```bash
npm run verify
```

预期失败信息（来自上面新写的断言之一）：

```
AssertionError [ERR_ASSERTION]: 保留组 🚀 代理选择 应位于 chain_group 之前
```

（因为旧实现里保留组和所有其他自定义组都位于 chain_group 之前，对比 `idx < chainIndex` 两边都满足，但新断言要求"其他自定义组 idx > transitIndex"会最先失败，具体哪条断言先失败取决于遍历顺序；只要失败就算按预期失败。）

---

### Task 2: 调整 buildProxyGroups 的 push 顺序让测试通过

**Files:**
- Modify: `scripts/override/lib/proxy-groups.js:175-237`

- [ ] **Step 1: 修改 buildProxyGroups 的顺序注释**

把 `scripts/override/lib/proxy-groups.js:177-178` 的顺序注释从：

```javascript
 * 顺序（自顶向下）：
 *   保留组 → 其他自定义组 → chain_groups → transit_groups → 区域组 → fallback
```

改为：

```javascript
 * 顺序（自顶向下）：
 *   保留组 → chain_groups → transit_groups → 其他自定义组 → 区域组 → fallback
```

- [ ] **Step 2: 调整 push 顺序**

把 `scripts/override/lib/proxy-groups.js:200-225` 的步骤 1~6 调整为下面的顺序（核心：原步骤 3/4 上移，原步骤 2 下移）：

```javascript
  const groups = [];

  // 1. 保留组
  for (const groupId of RESERVED_GROUP_IDS) {
    groups.push(buildConfiguredGroup(groupId, groupDefinitions[groupId], context));
  }

  // 2. chain_groups（落地）
  groups.push(...chainGroups);

  // 3. transit_groups（中转）
  groups.push(...transitGroups);

  // 4. 其他自定义组（非保留、非 fallback）
  for (const [groupId, definition] of Object.entries(groupDefinitions)) {
    if (RESERVED_GROUP_IDS.includes(groupId) || groupId === FALLBACK_GROUP_ID) {
      continue;
    }
    groups.push(buildConfiguredGroup(groupId, definition, context));
  }

  // 5. 区域组
  groups.push(...regionGroups);

  // 6. fallback
  groups.push(buildConfiguredGroup(FALLBACK_GROUP_ID, groupDefinitions[FALLBACK_GROUP_ID], context));
```

保留末尾的 `seenNames` 重名检测块（`scripts/override/lib/proxy-groups.js:227-234`）不变。

- [ ] **Step 3: 再次跑 verify 确认全部通过**

运行：

```bash
npm run verify
```

预期输出末尾：

```
verify:main OK
```

（以仓库现有 verify 输出约定为准；核心是进程退出码 0 且无 AssertionError。）

---

### Task 3: 生成示例 config 人工抽查新顺序

**Files:**
- 仅读：`dist/example-full-config.yaml`

- [ ] **Step 1: 生成示例配置**

运行：

```bash
npm run example:config
```

预期：`dist/example-full-config.yaml` 被重新生成，无报错。

- [ ] **Step 2: 抽查 proxy-groups 顺序**

打开 `dist/example-full-config.yaml`，定位 `proxy-groups:` 段。自顶向下期望：

1. `🚀 代理选择`
2. `🔧 手动选择`
3. `⚡ 自动选择`
4. `🚪 落地`（若模板节点含 landing_pattern 命中者）
5. `🔀 中转`（若 transit 成员非空）
6. `🛑 广告拦截` / `🏠 私有网络` / `🔒 国内服务` / `🌐 国外服务` / 其他业务组
7. 区域组（`🇭🇰 香港` 等）
8. `🐟 漏网之鱼`

若模板 proxies 不含自建/Relay 节点，chain/transit 均为空数组，则 1-3 之后直接接业务组，符合 "空链式=旧行为" 的不变式。

- [ ] **Step 3: 确认无其他文件被误改**

运行：

```bash
git status
```

预期只看到：

```
M scripts/override/lib/proxy-groups.js
M tools/verify-main.js
```

（`dist/` 下的产物视用户本地 gitignore / 历史习惯可能出现或不出现，与本改动语义无关。）

---

### Task 4: 提交改动

**Files:**
- 已在 Task 1-3 中修改的两个文件

- [ ] **Step 1: 人工确认 diff 聚焦**

运行：

```bash
git diff scripts/override/lib/proxy-groups.js tools/verify-main.js
```

预期仅见顺序注释、push 顺序、测试断言的改动，无额外文件被误改。

- [ ] **Step 2: 提交（仅在用户明确要求提交后执行）**

**提醒**：仓库全局约定是"不主动提交，除非用户明确要求"。本步骤执行前请与用户确认。确认后运行：

```bash
git add scripts/override/lib/proxy-groups.js tools/verify-main.js
git commit -m "refactor: 链式代理组上移至保留组之后、自定义组之前"
```

提交消息遵循仓库约定（中文、50 字内、无 Claude 署名）。

---

## 自检

- **Spec 覆盖**：spec 的两处改动范围（proxy-groups.js 顺序 / verify-main.js 断言）分别对应 Task 2 / Task 1；spec 的验证清单（`npm run verify` + `example:config` 抽查）对应 Task 2 Step 3 / Task 3；空链式兼容由 Task 3 Step 2 最后一段覆盖。
- **占位符扫描**：已检查，无 TBD / 未填块。
- **类型一致性**：`placeholdersConfig.reserved`、`placeholdersConfig.fallback`、`groupDefinitionsConfig.groupDefinitions` 均为仓库现有导出，字段形状与 `scripts/config/proxy-groups/placeholders.js`、`scripts/config/proxy-groups/groupDefinitions.js` 一致。`buildProxyGroups(proxies, groupDefinitions, extras)` 签名与当前源文件一致。
