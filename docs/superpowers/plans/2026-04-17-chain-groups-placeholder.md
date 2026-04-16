# @chain-groups 占位符与落地节点隔离 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 groupDefinitions 中支持 `@chain-groups` 占位符，并将落地节点从常规组中隔离，使其只出现在落地组中。

**Architecture:** 三处改动：(1) `main.js` 传 `remainingProxies` 替代 `namedProxies`；(2) `proxy-groups.js` 的 `expandGroupTarget` 新增 `@chain-groups` 分支；(3) `groupDefinitions.yaml` 所有含 `@region-groups` 的组前插入 `@chain-groups`。

**Tech Stack:** Node.js ESM, YAML definitions, esbuild bundle

---

### Task 1: proxy-groups.js — 新增 @chain-groups 占位符支持

**Files:**
- Modify: `scripts/override/lib/proxy-groups.js:109-134` (`expandGroupTarget`)
- Modify: `scripts/override/lib/proxy-groups.js:180-230` (`buildProxyGroups`)

- [ ] **Step 1: 修改 `buildProxyGroups`，从 extras 提取 chainGroupNames 并加入 context**

在 `buildProxyGroups` 函数中，`const context = {` 之前，新增 chainGroupNames 提取：

```js
const chainGroupNames = chainGroups.map((group) => group.name);
```

在 context 对象中新增 `chainGroupNames` 字段：

```js
const context = {
  allProxyNames,
  regionGroupNames: regionGroups.map((group) => group.name),
  chainGroupNames,
  groupDefinitions,
};
```

- [ ] **Step 2: 修改 `expandGroupTarget`，新增 @chain-groups 分支**

在 `if (target === "@region-groups")` 块之后、`if (PLACEHOLDER_GROUP_IDS[target])` 块之前，插入：

```js
if (target === "@chain-groups") {
  return [...context.chainGroupNames];
}
```

同时更新函数的 JSDoc 注释，在占位符说明中增加 `@chain-groups` 条目：

```js
/**
 * 展开 @-前缀的占位符目标为实际节点/组名列表。
 * 支持四类占位符:
 *   - @all-nodes: 展开为所有代理节点名称
 *   - @region-groups: 展开为所有已构建的区域组名称
 *   - @chain-groups: 展开为所有已构建的链式代理落地组名称
 *   - @proxy-select/@manual-select/@auto-select: 展开为对应保留组的 name
 * @param {string} target - 占位符或普通目标名称。
 * @param {{allProxyNames: string[], regionGroupNames: string[], chainGroupNames: string[], groupDefinitions: Record<string, {name: string}>}} context
 * @returns {string[]} 展开后的名称列表。
 */
```

- [ ] **Step 3: 运行 verify 确认现有测试通过**

运行：`npm run verify`
预期：全部通过（此时 groupDefinitions.yaml 尚未使用 `@chain-groups`，所以行为不变）

- [ ] **Step 4: 提交**

```bash
git add scripts/override/lib/proxy-groups.js
git commit -m "feat: expandGroupTarget 支持 @chain-groups 占位符"
```

---

### Task 2: main.js — 传 remainingProxies 隔离落地节点

**Files:**
- Modify: `scripts/override/main.js:46`

- [ ] **Step 1: 将 `buildProxyGroups` 第一参数从 `namedProxies` 改为 `remainingProxies`**

将：

```js
workingConfig["proxy-groups"] = buildProxyGroups(namedProxies, groupDefinitions, {
  chainGroups: chainsEffective ? chainGroups : [],
  transitGroups: chainsEffective ? transitGroups : [],
});
```

改为：

```js
workingConfig["proxy-groups"] = buildProxyGroups(remainingProxies, groupDefinitions, {
  chainGroups: chainsEffective ? chainGroups : [],
  transitGroups: chainsEffective ? transitGroups : [],
});
```

- [ ] **Step 2: 运行 verify 确认测试通过**

运行：`npm run verify`
预期：全部通过。现有测试 `testChainPipelineIntegration` 也传的 `namedProxies`，需同步更新（见 Task 4）。若此处 verify 失败，先到 Task 4 修复测试后再回来。

- [ ] **Step 3: 提交**

```bash
git add scripts/override/main.js
git commit -m "feat: buildProxyGroups 使用 remainingProxies 隔离落地节点"
```

---

### Task 3: groupDefinitions.yaml — 所有含 @region-groups 的组添加 @chain-groups

**Files:**
- Modify: `definitions/proxy-groups/groupDefinitions.yaml`

- [ ] **Step 1: 在所有含 `@region-groups` 的 proxies 数组中，在 `@region-groups` 之前插入 `@chain-groups`**

需要修改的组（共 24 个）：

**core 类（5 个）**：`private`、`cn_service`、`non_cn`、`ssh_22`、`fallback`

将每个组的 proxies 中 `"@region-groups"` 前插入 `"@chain-groups"`。例如 `non_cn`：

```yaml
non_cn:
  name: "🌐 国外服务"
  type: "select"
  category: "core"
  proxies:
    [
      "@proxy-select",
      "@manual-select",
      "@auto-select",
      "DIRECT",
      "@chain-groups",
      "@region-groups",
    ]
```

**basic 类（7 个）**：`ai_service`、`youtube`、`google`、`microsoft`、`apple`、`telegram`、`code_hosting`

每个组 proxies 改为：

```yaml
proxies:
  [
    "@proxy-select",
    "@manual-select",
    "@auto-select",
    "DIRECT",
    "@chain-groups",
    "@region-groups",
  ]
```

**extended 类（12 个）**：`twitter`、`meta_social`、`discord`、`social_other`、`netflix`、`disney_plus`、`western_streaming`、`asia_streaming`、`steam`、`game_pc`、`game_console`、`cloud_service`、`developer_tools`、`storage_service`、`payment`、`encryption`、`education`、`news`、`shopping`

每个组 proxies 同上格式，在 `@region-groups` 前加 `@chain-groups`。

- [ ] **Step 2: 运行 rules:build 重新编译**

运行：`npm run rules:build`
预期：正常完成，`scripts/config/proxy-groups/groupDefinitions.js` 更新

- [ ] **Step 3: 运行 verify 确认全部通过**

运行：`npm run verify`
预期：全部通过

- [ ] **Step 4: 提交**

```bash
git add definitions/proxy-groups/groupDefinitions.yaml scripts/config/proxy-groups/groupDefinitions.js
git commit -m "feat: groupDefinitions 所有含 @region-groups 的组添加 @chain-groups"
```

---

### Task 4: verify-main.js — 更新 testChainPipelineIntegration 与新增测试

**Files:**
- Modify: `tools/verify-main.js`

- [ ] **Step 1: 更新 `testChainPipelineIntegration`（约第 880 行）传 `remainingProxies`**

将：

```js
config["proxy-groups"] = buildProxyGroups(
  namedProxies,
  groupDefinitionsConfig.groupDefinitions,
  { chainGroups, transitGroups },
);
```

改为：

```js
config["proxy-groups"] = buildProxyGroups(
  remainingProxies,
  groupDefinitionsConfig.groupDefinitions,
  { chainGroups, transitGroups },
);
```

- [ ] **Step 2: 新增 `testChainGroupsPlaceholderExpansion` 测试函数**

在 `testBuildProxyGroupsExtrasOptional` 之后添加：

```js
/**
 * 校验 @chain-groups 占位符展开为 chain_group 组名列表。
 * 当 extras.chainGroups 非空时，使用了 @chain-groups 的策略组应包含链式代理组名。
 * 当 extras.chainGroups 为空时，@chain-groups 展开为空，不影响 proxies 列表。
 * @returns {void}
 */
function testChainGroupsPlaceholderExpansion() {
  const namedProxies = [
    { name: "Sample-🇭🇰-Hong Kong-01" },
    { name: "Sample-🇯🇵-Japan-01" },
  ];
  const chainGroupFixture = {
    name: "🚪 落地",
    type: "select",
    proxies: ["自建-SG-Relay-01"],
  };

  // 有 chainGroups 时，含 @chain-groups 的组应包含链式代理组名
  const groupsWithChain = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups: [chainGroupFixture], transitGroups: [] },
  );

  // 找到含 @region-groups 的组（即应同时含 @chain-groups 的组）
  // 使用 non_cn 作为代表检查
  const nonCnDef = groupDefinitionsConfig.groupDefinitions.non_cn;
  const nonCnGroup = groupsWithChain.find((g) => g.name === nonCnDef.name);
  assert.ok(nonCnGroup, "non_cn 组应存在");
  assert.ok(
    nonCnGroup.proxies.includes("🚪 落地"),
    "含 @chain-groups 的组应包含链式代理组名",
  );

  // chainGroups 为空时，组中不应出现链式代理组名
  const groupsWithoutChain = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups: [], transitGroups: [] },
  );
  const nonCnGroupNoChain = groupsWithoutChain.find((g) => g.name === nonCnDef.name);
  assert.ok(nonCnGroupNoChain, "non_cn 组应存在");
  assert.ok(
    !nonCnGroupNoChain.proxies.includes("🚪 落地"),
    "chainGroups 为空时不应出现链式代理组名",
  );
}
```

- [ ] **Step 3: 新增 `testRemainingProxiesExcludesLanding` 测试函数**

在上一个测试之后添加：

```js
/**
 * 校验 remainingProxies 传入 buildProxyGroups 后，落地节点不出现在
 * @all-nodes 和 @region-groups 展开的组中。
 * @returns {void}
 */
function testRemainingProxiesExcludesLanding() {
  const allProxies = [
    { name: "Sample-🇭🇰-Hong Kong-01" },
    { name: "Sample-🇯🇵-Japan-01" },
    { name: "自建-SG-Relay-01" },
    { name: "Relay-US-02" },
  ];
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建|Relay|落地",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];

  const { chainGroups, remainingProxies } = buildChainGroups(allProxies, chainDefinitions);

  const groups = buildProxyGroups(
    remainingProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups, transitGroups: [] },
  );

  // 手动选择组使用 @all-nodes，不应包含落地节点
  const manualDef = groupDefinitionsConfig.groupDefinitions.manual_select;
  const manualGroup = groups.find((g) => g.name === manualDef.name);
  assert.ok(manualGroup, "manual_select 组应存在");
  assert.ok(
    !manualGroup.proxies.includes("自建-SG-Relay-01"),
    "@all-nodes 展开后不应包含落地节点",
  );
  assert.ok(
    !manualGroup.proxies.includes("Relay-US-02"),
    "@all-nodes 展开后不应包含落地节点",
  );
  assert.ok(
    manualGroup.proxies.includes("Sample-🇭🇰-Hong Kong-01"),
    "@all-nodes 应包含非落地节点",
  );
}
```

- [ ] **Step 4: 在 `main()` 函数的测试列表中注册新测试**

在 `testBuildProxyGroupsExtrasOptional();` 之后添加：

```js
testChainGroupsPlaceholderExpansion();
testRemainingProxiesExcludesLanding();
```

- [ ] **Step 5: 运行 verify 确认全部通过**

运行：`npm run verify`
预期：全部通过，包含新增的两个测试

- [ ] **Step 6: 提交**

```bash
git add tools/verify-main.js
git commit -m "test: 新增 @chain-groups 占位符展开与落地节点隔离测试"
```

---

### Task 5: 全量构建验收

**Files:** 无新改动，仅执行验收命令

- [ ] **Step 1: 全量构建**

运行：`npm run build`
预期：构建成功，`dist/scripts/override/main.js` 更新

- [ ] **Step 2: 运行完整验证**

运行：`npm run verify`
预期：全部通过

- [ ] **Step 3: 生成示例配置并目视检查**

运行：`npm run example:config`
检查 `dist/example-full-config.yaml` 中：
- 含 `@region-groups` 的组（如 `🌐 国外服务`、`🤖 AI 服务`）应包含 `🚪 落地` 组名
- `🔧 手动选择`、`⚡ 自动选择` 不应包含落地节点名（如 "Relay-*"、"落地-*"）
- `🚪 落地` 组仅包含落地节点
