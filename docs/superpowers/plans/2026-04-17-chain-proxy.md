# 链式代理 (Chain Proxy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Mihomo 最终生成配置增加链式代理能力：声明式 YAML 配置落地节点 + 中转组，为落地节点注入 `dialer-proxy` 实现链式出站。

**Architecture:** 新增 `definitions/runtime/chains.yaml` 定义 `transit_group` 和 `chain_group` 两类数组；新增 `scripts/override/lib/proxy-chains.js` 提供三个纯函数（`buildChainGroups`/`buildTransitGroups`/`applyProxyChains`）；扩展 `buildProxyGroups` 以在指定位置插入两类新组；扩展 `validate-output.js` 做不变量校验。与设计文档 `docs/superpowers/specs/2026-04-17-chain-proxy-design.md` 对应。

**Tech Stack:** Node.js ≥24, ESM, js-yaml, esbuild IIFE bundle, `node:assert/strict` 断言，`node:vm` 沙箱（现有 verify-main.js）。无第三方测试框架。

---

## 文件结构

**新增**：
- `definitions/runtime/chains.yaml` — 链式代理声明（初版默认空数组，不启用）
- `scripts/override/lib/proxy-chains.js` — 链式代理的构建与注入逻辑
- （由 yaml-to-js.js 自动产出）`scripts/config/runtime/chains.js`

**修改**：
- `scripts/override/main.js:1-36` — 接入新 pipeline 步骤
- `scripts/override/lib/proxy-groups.js:176-203` — `buildProxyGroups` 签名增加可选第三参，调整插入顺序
- `scripts/override/lib/validate-output.js:10-86` — 增加链相关断言
- `tools/verify-main.js` — 增加直接单元测试与端到端场景

**不改动**：
- `tools/lib/paths.js`（新 YAML 落在已注册的 `definitions/runtime/` namespace）
- `build.js` / GitHub Actions / 模板文件

---

## 面板 proxy-groups 顺序（实施后）

自顶向下：
1. 保留组（proxy_select / manual_select / auto_select）
2. 其他自定义组（groupDefinitions.yaml 中非保留、非 fallback）
3. **chain_groups（落地）** ← 新增
4. **transit_groups（中转）** ← 新增
5. 区域组
6. fallback

---

## Task 1: 创建 chains.yaml 脚手架

**Files:**
- Create: `definitions/runtime/chains.yaml`

- [ ] **Step 1: 创建空配置文件**

```yaml
# 链式代理配置。默认空数组 = 不启用链式代理，输出与启用前完全一致。
#
# 启用示例：
#
# transit_group:
#   - id: transit
#     name: "🔀 中转"
#     transit_pattern: ""   # 空 = 所有非 landing 节点；非空则额外正则过滤
#     flags: i
#     type: select
#
# chain_group:
#   - id: chain
#     name: "🚪 落地"
#     landing_pattern: "自建|Relay|落地"
#     flags: i
#     entry: transit       # 引用 transit_group[].id
#     type: select

transit_group: []
chain_group: []
```

- [ ] **Step 2: 运行 rules:build 验证编译成功**

Run: `npm run rules:build`
Expected: 输出包含 `已转换: definitions/runtime/chains.yaml -> scripts/config/runtime/chains.js`，exit 0。

- [ ] **Step 3: 确认编译产物内容**

Run: `cat scripts/config/runtime/chains.js`
Expected: 文件内容为
```js
export default {
  "transit_group": [],
  "chain_group": []
};
```

- [ ] **Step 4: 运行完整 verify 确认无回归**

Run: `npm run verify`
Expected: `主 bundle 验证通过` 与 `迁移兼容性验证通过`，exit 0。

- [ ] **Step 5: Commit**

```bash
git add definitions/runtime/chains.yaml scripts/config/runtime/chains.js
git commit -m "feat: 新增 chains.yaml 链式代理配置脚手架"
```

---

## Task 2: 建立 proxy-chains.js 模块骨架 + buildChainGroups

**Files:**
- Create: `scripts/override/lib/proxy-chains.js`
- Modify: `tools/verify-main.js`（在末尾增加一个测试函数）

- [ ] **Step 1: 写失败的单元测试**

在 `tools/verify-main.js` 顶部 imports 追加：
```js
import { buildChainGroups } from "../scripts/override/lib/proxy-chains.js";
```

在 `main()` 之前增加测试函数：
```js
/**
 * 校验 buildChainGroups：按 first-match-wins 抽出 landing 节点，
 * 返回每个 chain_group 定义对应的组与剔除 landing 后的 remainingProxies。
 * @returns {void}
 */
function testBuildChainGroupsBasic() {
  const namedProxies = [
    { name: "Sample-🇭🇰-Hong Kong-01" },
    { name: "Sample-🇸🇬-Singapore-01" },
    { name: "自建-SG-Relay-01" },
    { name: "Relay-JP-02" },
    { name: "落地-US-03" },
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

  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefinitions);

  assert.equal(chainGroups.length, 1, "应构建 1 个 chain_group");
  assert.equal(chainGroups[0].name, "🚪 落地", "chain_group.name 应等于 definition.name");
  assert.equal(chainGroups[0].type, "select", "chain_group.type 应等于 definition.type");
  assert.deepEqual(
    chainGroups[0].proxies,
    ["自建-SG-Relay-01", "Relay-JP-02", "落地-US-03"],
    "chain_group.proxies 应保留订阅顺序，仅包含命中 landing_pattern 的节点名",
  );
  assert.deepEqual(
    remainingProxies.map((p) => p.name),
    ["Sample-🇭🇰-Hong Kong-01", "Sample-🇸🇬-Singapore-01"],
    "remainingProxies 应剔除 landing 节点，保留其余节点的原顺序",
  );
}
```

在 `main()` 函数的第一行（`assertGeneratedFiles()` 之前）添加：
```js
  testBuildChainGroupsBasic();
```

- [ ] **Step 2: 运行验证以确认测试失败**

Run: `npm run verify`
Expected: FAIL，报错信息包含 `Cannot find module '.../proxy-chains.js'` 或类似缺少模块的错误。

- [ ] **Step 3: 创建 proxy-chains.js 并实现 buildChainGroups**

Create `scripts/override/lib/proxy-chains.js`:
```js
/**
 * 将 chain_group 定义中的 landing_pattern 编译为 RegExp。
 * @param {Array<{id:string, landing_pattern:string, flags?:string}>} chainDefinitions
 * @returns {Array<{definition:object, pattern:RegExp}>}
 */
function compileChainPatterns(chainDefinitions) {
  return chainDefinitions.map((definition) => {
    if (typeof definition.landing_pattern !== "string" || definition.landing_pattern.length === 0) {
      throw new Error(`chain_group ${definition.id} 缺少非空的 landing_pattern`);
    }

    try {
      return {
        definition,
        pattern: new RegExp(definition.landing_pattern, definition.flags || ""),
      };
    } catch (error) {
      throw new Error(
        `chain_group ${definition.id} 的 landing_pattern 非法正则: ${error.message}`,
      );
    }
  });
}

/**
 * 校验 chain_group 的 id 唯一性。
 * @param {Array<{id:string}>} chainDefinitions
 * @returns {void}
 */
function assertUniqueChainIds(chainDefinitions) {
  const seen = new Set();
  for (const definition of chainDefinitions) {
    if (typeof definition.id !== "string" || definition.id.length === 0) {
      throw new Error("chain_group 条目缺少非空的 id");
    }
    if (seen.has(definition.id)) {
      throw new Error(`chain_group.id 重复: ${definition.id}`);
    }
    seen.add(definition.id);
  }
}

/**
 * 提取 landing 节点并按 chain_group 定义构建组。
 * 节点匹配采用 first-match-wins：按 chain_group 数组顺序，节点归属首个命中的组。
 * 被首个组捕获后，若又命中其他组的 landing_pattern，记录 WARN（仅归属首个）。
 * 成员为空的 chain_group 会被跳过并 WARN。
 *
 * @param {Array<{name:string}>} namedProxies - 已过滤非空名称的节点数组。
 * @param {Array<{id:string, name:string, landing_pattern:string, flags?:string, entry:string, type:string}>} chainDefinitions
 * @returns {{chainGroups: Array<{name:string, type:string, proxies:string[]}>, remainingProxies: Array<{name:string}>}}
 */
function buildChainGroups(namedProxies, chainDefinitions) {
  if (!Array.isArray(chainDefinitions) || chainDefinitions.length === 0) {
    return { chainGroups: [], remainingProxies: [...namedProxies] };
  }

  assertUniqueChainIds(chainDefinitions);
  const compiled = compileChainPatterns(chainDefinitions);

  const bucketsByChainId = new Map(compiled.map((entry) => [entry.definition.id, []]));
  const remainingProxies = [];

  for (const proxy of namedProxies) {
    let captured = false;
    for (const entry of compiled) {
      if (entry.pattern.test(proxy.name)) {
        if (!captured) {
          bucketsByChainId.get(entry.definition.id).push(proxy);
          captured = true;
          continue;
        }
        console.log(
          `[override] WARN: 节点 ${proxy.name} 同时命中 chain_group ${entry.definition.id} 的 landing_pattern，已忽略（首个命中的 chain_group 已捕获）`,
        );
      }
    }
    if (!captured) {
      remainingProxies.push(proxy);
    }
  }

  const chainGroups = [];
  for (const entry of compiled) {
    const bucket = bucketsByChainId.get(entry.definition.id);
    if (bucket.length === 0) {
      console.log(
        `[override] WARN: chain_group ${entry.definition.id} 未命中任何节点，已跳过该组`,
      );
      continue;
    }
    chainGroups.push({
      name: entry.definition.name,
      type: entry.definition.type,
      proxies: bucket.map((proxy) => proxy.name),
    });
  }

  return { chainGroups, remainingProxies };
}

export { buildChainGroups };
```

- [ ] **Step 4: 运行验证以确认测试通过**

Run: `npm run verify`
Expected: PASS，输出 `主 bundle 验证通过`。

- [ ] **Step 5: Commit**

```bash
git add scripts/override/lib/proxy-chains.js tools/verify-main.js
git commit -m "feat: 新增 buildChainGroups 提取落地节点并构建 chain_group"
```

---

## Task 3: 增加 buildChainGroups 的边界场景测试

**Files:**
- Modify: `tools/verify-main.js`

- [ ] **Step 1: 增加空定义场景测试**

在 `testBuildChainGroupsBasic` 之后追加：
```js
/**
 * 校验 chainDefinitions 为空数组时，remainingProxies 直接等于入参副本，chainGroups 为空。
 * @returns {void}
 */
function testBuildChainGroupsEmptyDefinitions() {
  const namedProxies = [{ name: "A" }, { name: "B" }];
  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, []);
  assert.deepEqual(chainGroups, [], "chainGroups 应为空数组");
  assert.deepEqual(
    remainingProxies.map((p) => p.name),
    ["A", "B"],
    "remainingProxies 应保留全部节点",
  );
}

/**
 * 校验 chain_group 未命中任何节点时会被跳过（不返回空成员组）。
 * @returns {void}
 */
function testBuildChainGroupsNoMatch() {
  const namedProxies = [{ name: "Sample-HK-01" }, { name: "Sample-JP-02" }];
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
  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefinitions);
  assert.equal(chainGroups.length, 0, "未命中 landing_pattern 时应跳过该 chain_group");
  assert.equal(remainingProxies.length, 2, "remainingProxies 应包含全部入参节点");
}

/**
 * 校验 id 重复抛错。
 * @returns {void}
 */
function testBuildChainGroupsDuplicateId() {
  assert.throws(
    () =>
      buildChainGroups(
        [{ name: "自建-01" }],
        [
          { id: "dup", name: "A", landing_pattern: "自建", flags: "i", entry: "transit", type: "select" },
          { id: "dup", name: "B", landing_pattern: "自建", flags: "i", entry: "transit", type: "select" },
        ],
      ),
    (error) => error instanceof Error && error.message.includes("dup"),
    "id 重复应抛错且错误信息包含冲突 id",
  );
}

/**
 * 校验 landing_pattern 非法正则时抛错。
 * @returns {void}
 */
function testBuildChainGroupsInvalidRegex() {
  assert.throws(
    () =>
      buildChainGroups(
        [{ name: "自建-01" }],
        [{ id: "c", name: "A", landing_pattern: "[", flags: "", entry: "transit", type: "select" }],
      ),
    (error) => error instanceof Error && error.message.includes("landing_pattern"),
    "非法正则应抛错且错误信息提示 landing_pattern",
  );
}
```

在 `main()` 中在 `testBuildChainGroupsBasic()` 之后追加：
```js
  testBuildChainGroupsEmptyDefinitions();
  testBuildChainGroupsNoMatch();
  testBuildChainGroupsDuplicateId();
  testBuildChainGroupsInvalidRegex();
```

- [ ] **Step 2: 运行验证**

Run: `npm run verify`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add tools/verify-main.js
git commit -m "test: 补全 buildChainGroups 边界场景用例"
```

---

## Task 4: 实现 buildTransitGroups

**Files:**
- Modify: `scripts/override/lib/proxy-chains.js`
- Modify: `tools/verify-main.js`

- [ ] **Step 1: 写失败的测试**

在 `verify-main.js` 的 import 处扩展：
```js
import { buildChainGroups, buildTransitGroups } from "../scripts/override/lib/proxy-chains.js";
```

在 `testBuildChainGroupsInvalidRegex` 之后追加：
```js
/**
 * 校验 transit_pattern 为空时成员等于全部 remainingProxies。
 * @returns {void}
 */
function testBuildTransitGroupsEmptyPattern() {
  const remaining = [{ name: "Sample-🇭🇰-Hong Kong-01" }, { name: "Sample-🇯🇵-Japan-01" }];
  const defs = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];
  const { groups, idToName } = buildTransitGroups(remaining, defs);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "🔀 中转");
  assert.equal(groups[0].type, "select");
  assert.deepEqual(
    groups[0].proxies,
    ["Sample-🇭🇰-Hong Kong-01", "Sample-🇯🇵-Japan-01"],
    "空 transit_pattern 应包含全部 remainingProxies",
  );
  assert.equal(idToName.get("transit"), "🔀 中转", "idToName 应映射 id 到 name");
}

/**
 * 校验 transit_pattern 非空时按正则过滤 remainingProxies。
 * @returns {void}
 */
function testBuildTransitGroupsFiltered() {
  const remaining = [{ name: "Sample-🇭🇰-Hong Kong-01" }, { name: "Sample-🇯🇵-Japan-01" }];
  const defs = [
    { id: "hk", name: "🇭🇰 中转-港", transit_pattern: "Hong\\s*Kong", flags: "i", type: "select" },
  ];
  const { groups } = buildTransitGroups(remaining, defs);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].proxies, ["Sample-🇭🇰-Hong Kong-01"]);
}

/**
 * 校验成员为空的 transit_group 会被跳过（不进入 idToName，不进入 groups）。
 * @returns {void}
 */
function testBuildTransitGroupsEmptyMembersSkipped() {
  const remaining = [{ name: "Sample-🇭🇰-Hong Kong-01" }];
  const defs = [
    { id: "jp", name: "🇯🇵 中转-日", transit_pattern: "Japan", flags: "i", type: "select" },
  ];
  const { groups, idToName } = buildTransitGroups(remaining, defs);
  assert.equal(groups.length, 0, "成员为空的 transit_group 应被跳过");
  assert.equal(idToName.has("jp"), false, "被跳过的 transit 不进入 idToName");
}

/**
 * 校验 transit_group id 重复抛错。
 * @returns {void}
 */
function testBuildTransitGroupsDuplicateId() {
  assert.throws(
    () =>
      buildTransitGroups(
        [{ name: "A" }],
        [
          { id: "t", name: "X", transit_pattern: "", flags: "", type: "select" },
          { id: "t", name: "Y", transit_pattern: "", flags: "", type: "select" },
        ],
      ),
    (error) => error instanceof Error && error.message.includes("transit_group"),
    "transit_group id 重复应抛错",
  );
}
```

在 `main()` 中追加：
```js
  testBuildTransitGroupsEmptyPattern();
  testBuildTransitGroupsFiltered();
  testBuildTransitGroupsEmptyMembersSkipped();
  testBuildTransitGroupsDuplicateId();
```

- [ ] **Step 2: 运行验证确认失败**

Run: `npm run verify`
Expected: FAIL，报错 `buildTransitGroups is not a function` 或 `has no exported member`。

- [ ] **Step 3: 实现 buildTransitGroups**

在 `scripts/override/lib/proxy-chains.js` 的 `export` 语句之前追加：
```js
/**
 * 校验 transit_group 的 id 唯一性。
 * @param {Array<{id:string}>} transitDefinitions
 * @returns {void}
 */
function assertUniqueTransitIds(transitDefinitions) {
  const seen = new Set();
  for (const definition of transitDefinitions) {
    if (typeof definition.id !== "string" || definition.id.length === 0) {
      throw new Error("transit_group 条目缺少非空的 id");
    }
    if (seen.has(definition.id)) {
      throw new Error(`transit_group.id 重复: ${definition.id}`);
    }
    seen.add(definition.id);
  }
}

/**
 * 将 transit_pattern 编译为 RegExp；空字符串表示不过滤（返回 null）。
 * @param {string} pattern
 * @param {string} flags
 * @param {string} transitId
 * @returns {RegExp|null}
 */
function compileTransitPattern(pattern, flags, transitId) {
  if (typeof pattern !== "string" || pattern.length === 0) {
    return null;
  }
  try {
    return new RegExp(pattern, flags || "");
  } catch (error) {
    throw new Error(
      `transit_group ${transitId} 的 transit_pattern 非法正则: ${error.message}`,
    );
  }
}

/**
 * 基于剔除 landing 后的剩余节点构建 transit_groups。
 * 空 transit_pattern → 成员为 remainingProxies 全部；非空时做正则过滤。
 * 成员为空的 transit_group 会被跳过（WARN）并不出现在 idToName 中。
 *
 * @param {Array<{name:string}>} remainingProxies
 * @param {Array<{id:string, name:string, transit_pattern:string, flags?:string, type:string}>} transitDefinitions
 * @returns {{groups: Array<{name:string, type:string, proxies:string[]}>, idToName: Map<string,string>}}
 */
function buildTransitGroups(remainingProxies, transitDefinitions) {
  if (!Array.isArray(transitDefinitions) || transitDefinitions.length === 0) {
    return { groups: [], idToName: new Map() };
  }

  assertUniqueTransitIds(transitDefinitions);

  const groups = [];
  const idToName = new Map();

  for (const definition of transitDefinitions) {
    const compiledPattern = compileTransitPattern(
      definition.transit_pattern,
      definition.flags,
      definition.id,
    );
    const members = compiledPattern
      ? remainingProxies.filter((proxy) => compiledPattern.test(proxy.name))
      : [...remainingProxies];

    if (members.length === 0) {
      console.log(
        `[override] WARN: transit_group ${definition.id} 过滤后无可用节点，已跳过该组`,
      );
      continue;
    }

    groups.push({
      name: definition.name,
      type: definition.type,
      proxies: members.map((proxy) => proxy.name),
    });
    idToName.set(definition.id, definition.name);
  }

  return { groups, idToName };
}
```

更新文件末尾的 export 语句：
```js
export { buildChainGroups, buildTransitGroups };
```

- [ ] **Step 4: 运行验证确认通过**

Run: `npm run verify`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add scripts/override/lib/proxy-chains.js tools/verify-main.js
git commit -m "feat: 新增 buildTransitGroups 构建中转组并返回 id->name 映射"
```

---

## Task 5: 实现 applyProxyChains

**Files:**
- Modify: `scripts/override/lib/proxy-chains.js`
- Modify: `tools/verify-main.js`

- [ ] **Step 1: 写失败的测试**

更新 `verify-main.js` 的 import：
```js
import { applyProxyChains, buildChainGroups, buildTransitGroups } from "../scripts/override/lib/proxy-chains.js";
```

在 `testBuildTransitGroupsDuplicateId` 之后追加：
```js
/**
 * 校验 applyProxyChains 为命中 landing_pattern 的节点注入 dialer-proxy = transit.name。
 * @returns {void}
 */
function testApplyProxyChainsBasic() {
  const config = {
    proxies: [
      { name: "Sample-🇭🇰-Hong Kong-01" },
      { name: "自建-SG-Relay-01" },
      { name: "Relay-JP-02" },
    ],
  };
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
  const transitIdToName = new Map([["transit", "🔀 中转"]]);

  applyProxyChains(config, chainDefinitions, transitIdToName);

  assert.equal(config.proxies[0]["dialer-proxy"], undefined, "非 landing 节点不应被注入");
  assert.equal(config.proxies[1]["dialer-proxy"], "🔀 中转", "landing 节点应注入 dialer-proxy");
  assert.equal(config.proxies[2]["dialer-proxy"], "🔀 中转", "landing 节点应注入 dialer-proxy");
}

/**
 * 校验节点已存在 dialer-proxy 时保留原值并 WARN，不覆盖。
 * @returns {void}
 */
function testApplyProxyChainsPreservesExisting() {
  const config = {
    proxies: [
      { name: "自建-SG-Relay-01", "dialer-proxy": "既有前置" },
    ],
  };
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const transitIdToName = new Map([["transit", "🔀 中转"]]);

  applyProxyChains(config, chainDefinitions, transitIdToName);

  assert.equal(
    config.proxies[0]["dialer-proxy"],
    "既有前置",
    "已有 dialer-proxy 应被保留",
  );
}

/**
 * 校验 chain.entry 对应的 transit 未被构建（不在 idToName 中）时，该 chain 整体跳过。
 * @returns {void}
 */
function testApplyProxyChainsSkipsMissingTransit() {
  const config = { proxies: [{ name: "自建-01" }] };
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit-missing",
      type: "select",
    },
  ];
  const transitIdToName = new Map();

  applyProxyChains(config, chainDefinitions, transitIdToName);

  assert.equal(
    config.proxies[0]["dialer-proxy"],
    undefined,
    "entry 指向未构建的 transit 时不应注入",
  );
}
```

在 `main()` 中追加：
```js
  testApplyProxyChainsBasic();
  testApplyProxyChainsPreservesExisting();
  testApplyProxyChainsSkipsMissingTransit();
```

- [ ] **Step 2: 运行验证确认失败**

Run: `npm run verify`
Expected: FAIL，报错 `applyProxyChains is not a function`。

- [ ] **Step 3: 实现 applyProxyChains**

在 `scripts/override/lib/proxy-chains.js` 的 export 语句之前追加：
```js
/**
 * 为 config.proxies 中命中 landing_pattern 的节点注入 dialer-proxy = transit.name。
 * 行为：
 *   - 对每个 chain：若 transitIdToName.get(chain.entry) 未定义，WARN 并跳过该 chain。
 *   - 否则遍历 config.proxies：
 *       - 匹配 landing_pattern 且无 dialer-proxy → 注入 proxy["dialer-proxy"] = transit.name
 *       - 已有 dialer-proxy → 保留原值 + WARN
 *
 * @param {{proxies: Array<object>}} config
 * @param {Array<{id:string, landing_pattern:string, flags?:string, entry:string}>} chainDefinitions
 * @param {Map<string,string>} transitIdToName - 来自 buildTransitGroups 的 idToName
 * @returns {void}
 */
function applyProxyChains(config, chainDefinitions, transitIdToName) {
  if (!Array.isArray(chainDefinitions) || chainDefinitions.length === 0) {
    return;
  }

  const proxies = Array.isArray(config.proxies) ? config.proxies : [];

  for (const chain of chainDefinitions) {
    const transitName = transitIdToName.get(chain.entry);
    if (!transitName) {
      console.log(
        `[override] WARN: chain ${chain.id} 的 entry=${chain.entry} 未找到已构建的 transit_group，跳过注入`,
      );
      continue;
    }

    let pattern;
    try {
      pattern = new RegExp(chain.landing_pattern, chain.flags || "");
    } catch (error) {
      throw new Error(
        `chain ${chain.id} 的 landing_pattern 非法正则: ${error.message}`,
      );
    }

    for (const proxy of proxies) {
      if (typeof proxy?.name !== "string" || !pattern.test(proxy.name)) {
        continue;
      }
      if (proxy["dialer-proxy"] !== undefined) {
        console.log(
          `[override] WARN: 节点 ${proxy.name} 已有 dialer-proxy=${proxy["dialer-proxy"]}，保留原值不覆盖`,
        );
        continue;
      }
      proxy["dialer-proxy"] = transitName;
    }
  }
}
```

更新 export 语句：
```js
export { applyProxyChains, buildChainGroups, buildTransitGroups };
```

- [ ] **Step 4: 运行验证确认通过**

Run: `npm run verify`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add scripts/override/lib/proxy-chains.js tools/verify-main.js
git commit -m "feat: 新增 applyProxyChains 为落地节点注入 dialer-proxy"
```

---

## Task 6: 扩展 buildProxyGroups 支持 chain/transit 插入

**Files:**
- Modify: `scripts/override/lib/proxy-groups.js`
- Modify: `tools/verify-main.js`

- [ ] **Step 1: 写失败的测试**

在 `verify-main.js` 的 import 处扩展：
```js
import { buildProxyGroups } from "../scripts/override/lib/proxy-groups.js";
```

在 `testApplyProxyChainsSkipsMissingTransit` 之后追加：
```js
/**
 * 校验 buildProxyGroups 的 extras 参数：chain_groups 和 transit_groups
 * 按约定位置（自定义组之后、区域组之前）插入。
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
  const chainIndex = names.indexOf("🚪 落地");
  const transitIndex = names.indexOf("🔀 中转");
  const hkIndex = names.indexOf("🇭🇰 香港");

  assert.ok(chainIndex > -1, "应包含 chain_group");
  assert.ok(transitIndex > -1, "应包含 transit_group");
  assert.ok(chainIndex < transitIndex, "chain_group 应位于 transit_group 之前");
  if (hkIndex > -1) {
    assert.ok(transitIndex < hkIndex, "transit_group 应位于区域组之前");
  }

  // 自定义组与保留组都应位于 chain_group 之前
  const chainGroupIds = Object.keys(groupDefinitionsConfig.groupDefinitions);
  for (const id of chainGroupIds) {
    const def = groupDefinitionsConfig.groupDefinitions[id];
    if (id === "fallback") continue;
    const idx = names.indexOf(def.name);
    assert.ok(
      idx > -1 && idx < chainIndex,
      `已配置策略组 ${def.name} 应位于 chain_group 之前`,
    );
  }
}

/**
 * 校验未传 extras 或 extras 为空数组时，buildProxyGroups 行为与旧版完全一致。
 * @returns {void}
 */
function testBuildProxyGroupsExtrasOptional() {
  const namedProxies = [{ name: "Sample-🇭🇰-Hong Kong-01" }];
  const groupsA = buildProxyGroups(namedProxies, groupDefinitionsConfig.groupDefinitions);
  const groupsB = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups: [], transitGroups: [] },
  );
  assert.deepEqual(
    normalize(groupsA),
    normalize(groupsB),
    "空 extras 应产生与未传参时相同的结果",
  );
}
```

在 `main()` 中追加：
```js
  testBuildProxyGroupsInsertsChainAndTransit();
  testBuildProxyGroupsExtrasOptional();
```

- [ ] **Step 2: 运行验证确认失败**

Run: `npm run verify`
Expected: FAIL，断言失败提示 extras 非空时未新增组。

- [ ] **Step 3: 修改 buildProxyGroups 签名与插入逻辑**

在 `scripts/override/lib/proxy-groups.js`，将 `buildProxyGroups` 函数整体替换为：
```js
/**
 * 构建完整的代理组列表。
 * 顺序（自顶向下）：
 *   保留组 → 其他自定义组 → chain_groups → transit_groups → 区域组 → fallback
 * @param {Array<{name: string}>} proxies - 已过滤的代理节点列表。
 * @param {Record<string, Object>} groupDefinitions - 策略组定义。
 * @param {{chainGroups?: Array<object>, transitGroups?: Array<object>}} [extras]
 *   可选：额外插入的 chain_groups 与 transit_groups。省略或数组为空时等价于旧版行为。
 * @returns {Array<{name: string, type: string, proxies: string[]}>} 完整的代理组列表。
 */
function buildProxyGroups(proxies, groupDefinitions, extras = {}) {
  const chainGroups = Array.isArray(extras.chainGroups) ? extras.chainGroups : [];
  const transitGroups = Array.isArray(extras.transitGroups) ? extras.transitGroups : [];

  const namedProxies = getNamedProxies(proxies);
  const allProxyNames = namedProxies.map((proxy) => proxy.name);
  const regionGroups = buildRegionGroups(namedProxies);
  const context = {
    allProxyNames,
    regionGroupNames: regionGroups.map((group) => group.name),
    groupDefinitions,
  };

  const groups = [];

  // 1. 保留组
  for (const groupId of RESERVED_GROUP_IDS) {
    groups.push(buildConfiguredGroup(groupId, groupDefinitions[groupId], context));
  }

  // 2. 其他自定义组（非保留、非 fallback）
  for (const [groupId, definition] of Object.entries(groupDefinitions)) {
    if (RESERVED_GROUP_IDS.includes(groupId) || groupId === FALLBACK_GROUP_ID) {
      continue;
    }
    groups.push(buildConfiguredGroup(groupId, definition, context));
  }

  // 3. chain_groups（落地）
  groups.push(...chainGroups);

  // 4. transit_groups（中转）
  groups.push(...transitGroups);

  // 5. 区域组
  groups.push(...regionGroups);

  // 6. fallback
  groups.push(buildConfiguredGroup(FALLBACK_GROUP_ID, groupDefinitions[FALLBACK_GROUP_ID], context));

  // 组名冲突检测：chain/transit 的 name 不得与其他组重名
  const seenNames = new Set();
  for (const group of groups) {
    if (seenNames.has(group.name)) {
      throw new Error(`proxy-groups 存在重名组: ${group.name}`);
    }
    seenNames.add(group.name);
  }

  return groups;
}
```

- [ ] **Step 4: 运行验证确认通过**

Run: `npm run verify`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add scripts/override/lib/proxy-groups.js tools/verify-main.js
git commit -m "feat: buildProxyGroups 支持插入 chain_group 和 transit_group"
```

---

## Task 7: main.js 接入链式代理 pipeline

**Files:**
- Modify: `scripts/override/main.js`
- Modify: `tools/verify-main.js`

- [ ] **Step 1: 写端到端集成测试（manual composition，不依赖 bundle）**

由于默认 `chains.yaml` 为空数组，bundle 端到端场景天然是 no-op。为了在 source 层面验证 pipeline 串联正确，新增一个手工组合测试。

在 `verify-main.js` 的 import 区扩展：
```js
import { applyProxyChains, buildChainGroups, buildTransitGroups } from "../scripts/override/lib/proxy-chains.js";
import { applyRuntimePreset } from "../scripts/override/lib/runtime-preset.js";
```

在 `testBuildProxyGroupsExtrasOptional` 之后追加：
```js
/**
 * 端到端（source 层）：手工组合 pipeline 函数，验证非空 chains 配置下
 * chain_group / transit_group / dialer-proxy 均按预期产生。
 * @returns {void}
 */
function testChainPipelineIntegration() {
  const config = {
    proxies: [
      { name: "Sample-🇭🇰-Hong Kong-01" },
      { name: "Sample-🇯🇵-Japan-01" },
      { name: "自建-SG-Relay-01" },
      { name: "Relay-US-02" },
    ],
  };
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
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];

  applyRuntimePreset(config);

  const namedProxies = config.proxies.filter(
    (p) => typeof p.name === "string" && p.name.trim().length > 0,
  );
  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefinitions);
  const { groups: transitGroups, idToName: transitIdToName } = buildTransitGroups(
    remainingProxies,
    transitDefinitions,
  );

  config["proxy-groups"] = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups, transitGroups },
  );

  applyProxyChains(config, chainDefinitions, transitIdToName);

  // dialer-proxy 注入
  const byName = new Map(config.proxies.map((p) => [p.name, p]));
  assert.equal(byName.get("自建-SG-Relay-01")["dialer-proxy"], "🔀 中转");
  assert.equal(byName.get("Relay-US-02")["dialer-proxy"], "🔀 中转");
  assert.equal(byName.get("Sample-🇭🇰-Hong Kong-01")["dialer-proxy"], undefined);

  // transit_group 不含 landing 节点
  const transit = config["proxy-groups"].find((g) => g.name === "🔀 中转");
  assert.ok(transit, "应存在 transit_group");
  for (const memberName of transit.proxies) {
    assert.ok(
      !["自建-SG-Relay-01", "Relay-US-02"].includes(memberName),
      "transit_group 不得包含 landing 节点",
    );
  }

  // chain_group 仅含 landing 节点
  const chain = config["proxy-groups"].find((g) => g.name === "🚪 落地");
  assert.ok(chain, "应存在 chain_group");
  assert.deepEqual(chain.proxies, ["自建-SG-Relay-01", "Relay-US-02"]);
}
```

在 `main()` 追加：
```js
  testChainPipelineIntegration();
```

- [ ] **Step 2: 运行验证确认测试通过**

Run: `npm run verify`
Expected: PASS（不需要 main.js 改动也能通过，因为是手工组合）。
这步确认手工组合结果符合设计，为 Step 3 的 pipeline 接入作参考。

- [ ] **Step 3: 修改 main.js 接入 pipeline**

将 `scripts/override/main.js` 整体替换为：
```js
import ruleProvidersConfig from "../config/rules/ruleProviders.js";
import groupDefinitionsConfig from "../config/rules/groupDefinitions.js";
import inlineRulesConfig from "../config/rules/inlineRules.js";
import chainsConfig from "../config/runtime/chains.js";
import { buildProxyGroups, getNamedProxies } from "./lib/proxy-groups.js";
import { assembleRuleSet } from "./lib/rule-assembly.js";
import { applyRuntimePreset } from "./lib/runtime-preset.js";
import { validateOutput } from "./lib/validate-output.js";
import {
  applyProxyChains,
  buildChainGroups,
  buildTransitGroups,
} from "./lib/proxy-chains.js";

const { ruleProviders } = ruleProvidersConfig;
const { groupDefinitions } = groupDefinitionsConfig;
const transitDefinitions = Array.isArray(chainsConfig.transit_group) ? chainsConfig.transit_group : [];
const chainDefinitions = Array.isArray(chainsConfig.chain_group) ? chainsConfig.chain_group : [];

function main(config = {}) {
  const workingConfig = config && typeof config === "object" ? config : {};
  const proxies = Array.isArray(workingConfig.proxies) ? workingConfig.proxies : [];
  const namedProxies = getNamedProxies(proxies);

  applyRuntimePreset(workingConfig);

  if (namedProxies.length === 0) {
    console.log("[override] ERROR: config.proxies 为空，无法生成策略组和分流规则");
    console.log("[override] 已应用 runtime preset，跳过 proxy-groups、rule-providers 和 rules 生成");
    return workingConfig;
  }

  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefinitions);
  const { groups: transitGroups, idToName: transitIdToName } = buildTransitGroups(
    remainingProxies,
    transitDefinitions,
  );

  // 所有 transit_group 均为空 → 整体跳过链式代理
  const chainsEffective = transitGroups.length > 0 && chainGroups.length > 0;

  workingConfig["proxy-groups"] = buildProxyGroups(namedProxies, groupDefinitions, {
    chainGroups: chainsEffective ? chainGroups : [],
    transitGroups: chainsEffective ? transitGroups : [],
  });

  if (chainsEffective) {
    applyProxyChains(workingConfig, chainDefinitions, transitIdToName);
  }

  const { providers, rules } = assembleRuleSet(groupDefinitions, ruleProviders, inlineRulesConfig);
  workingConfig["rule-providers"] = providers;
  workingConfig.rules = rules;

  validateOutput(workingConfig, groupDefinitions);
  return workingConfig;
}

export { main };
```

- [ ] **Step 4: 运行完整构建与验证**

Run: `npm run verify`
Expected: PASS（chains.yaml 为空数组 → 整体跳过，现有 bundle 场景行为不变）。

- [ ] **Step 5: Commit**

```bash
git add scripts/override/main.js tools/verify-main.js
git commit -m "feat: main.js pipeline 接入链式代理构建与注入步骤"
```

---

## Task 8: validate-output.js 增加链相关断言

**Files:**
- Modify: `scripts/override/lib/validate-output.js`
- Modify: `tools/verify-main.js`

- [ ] **Step 1: 写失败的测试**

在 `verify-main.js` 的 import 处扩展：
```js
import { validateOutput } from "../scripts/override/lib/validate-output.js";
```

在 `testChainPipelineIntegration` 之后追加：
```js
/**
 * 校验：存在 dialer-proxy 的节点必须指向某个 proxy-group.name，否则抛错。
 * @returns {void}
 */
function testValidateOutputRejectsDanglingDialerProxy() {
  // 构造一份最小可校验的配置
  const config = {
    proxies: [
      { name: "A" },
      { name: "B", "dialer-proxy": "不存在的组" },
    ],
    "proxy-groups": [
      {
        name: groupDefinitionsConfig.groupDefinitions.proxy_select.name,
        type: "select",
        proxies: ["A"],
      },
      {
        name: groupDefinitionsConfig.groupDefinitions.fallback.name,
        type: "select",
        proxies: ["A"],
      },
    ],
    rules: [`MATCH,${groupDefinitionsConfig.groupDefinitions.fallback.name}`],
  };
  // 为满足 validateOutput 的"策略组完整"检查，补齐其他已配置组
  for (const [id, def] of Object.entries(groupDefinitionsConfig.groupDefinitions)) {
    if (id === "proxy_select" || id === "fallback") continue;
    config["proxy-groups"].push({ name: def.name, type: "select", proxies: ["A"] });
  }

  assert.throws(
    () => validateOutput(config, groupDefinitionsConfig.groupDefinitions),
    (error) => error instanceof Error && error.message.includes("dialer-proxy"),
    "dialer-proxy 指向不存在的组时应抛错，错误信息包含 dialer-proxy",
  );
}
```

在 `main()` 追加：
```js
  testValidateOutputRejectsDanglingDialerProxy();
```

- [ ] **Step 2: 运行验证确认失败**

Run: `npm run verify`
Expected: FAIL，`validateOutput` 未抛错导致 `assert.throws` 失败。

- [ ] **Step 3: 在 validate-output.js 增加断言**

在 `scripts/override/lib/validate-output.js` 的 `validateOutput` 函数末尾（`if (!matchRuleFound) { ... }` 之后）追加：
```js
  // 链式代理一致性校验
  const proxies = Array.isArray(config.proxies) ? config.proxies : [];
  for (const proxy of proxies) {
    const dialerTarget = proxy?.["dialer-proxy"];
    if (dialerTarget === undefined) {
      continue;
    }
    if (typeof dialerTarget !== "string" || dialerTarget.length === 0) {
      throw new Error(`proxy ${proxy?.name} 的 dialer-proxy 类型非法`);
    }
    if (!proxyGroupNames.has(dialerTarget)) {
      throw new Error(
        `proxy ${proxy?.name} 的 dialer-proxy 指向不存在的策略组: ${dialerTarget}`,
      );
    }
  }
```

- [ ] **Step 4: 运行验证确认通过**

Run: `npm run verify`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add scripts/override/lib/validate-output.js tools/verify-main.js
git commit -m "feat: validate-output 校验 dialer-proxy 指向必须存在"
```

---

## Task 9: 端到端回归 + 文档更新

**Files:**
- Modify: `README.md` 或 `docs/DESIGN.md`（视现有文档结构）
- Modify: `tools/verify-main.js`（补一个 bundle 级 no-op 回归断言）

- [ ] **Step 1: 增加 bundle 级 no-op 回归断言**

在 `verify-main.js` 的 `testBundlePositivePath` 之后追加：
```js
/**
 * 链式代理默认禁用（chains.yaml transit_group: [] / chain_group: []）时，
 * bundle 产出的 proxies 不得带有 dialer-proxy 字段，proxy-groups 不得包含
 * 🔀 中转 或 🚪 落地 这样的默认链组名（保持与旧版输出等价）。
 * @returns {void}
 */
function testBundleNoopWhenChainsDisabled() {
  const { main } = loadBundleRuntime();
  const result = main({ proxies: loadTemplateProxies() });

  for (const proxy of result.proxies) {
    assert.equal(
      proxy["dialer-proxy"],
      undefined,
      `默认配置下节点不应带 dialer-proxy: ${proxy.name}`,
    );
  }
  const names = new Set(result["proxy-groups"].map((g) => g.name));
  assert.equal(names.has("🔀 中转"), false, "默认配置下不应出现中转组");
  assert.equal(names.has("🚪 落地"), false, "默认配置下不应出现落地组");
}
```

在 `main()` 中于 `testBundlePositivePath()` 之后追加：
```js
  testBundleNoopWhenChainsDisabled();
```

- [ ] **Step 2: 运行完整验证**

Run: `npm run verify`
Expected: PASS。

- [ ] **Step 3: 运行 example 生成并手动检查**

Run: `npm run example:config`
Expected: exit 0，`dist/example-full-config.yaml` 中无 `dialer-proxy:` 字段（因为默认禁用）。

Run: `grep -c "dialer-proxy" dist/example-full-config.yaml`
Expected: 输出 `0`。

- [ ] **Step 4: 更新设计文档索引（如适用）**

检查 `docs/DESIGN.md` 是否列出了覆写 pipeline 的模块：

Run: `grep -n "proxy-groups.js\|rule-assembly.js" docs/DESIGN.md`
Expected: 找到现有模块列表的位置。

如果找到，手动在同一列表里加一行：
```md
- **`proxy-chains.js`** — 链式代理（chains.yaml 驱动）：构建 chain_group / transit_group，并为落地节点注入 `dialer-proxy`。
```

如果 `docs/DESIGN.md` 没有对应章节，则跳过此步。

- [ ] **Step 5: Commit**

```bash
git add tools/verify-main.js docs/DESIGN.md
git commit -m "test: 增加链式代理默认禁用时的 bundle 回归断言"
```

（若 DESIGN.md 未改动则 `git add tools/verify-main.js` 即可。）

---

## Task 10: 严格校验 chain.entry 引用完整性（spec §4.3 补全）

**背景**：Task 1-9 完成后的整体 review 发现 `applyProxyChains` 仅根据运行时 `transitIdToName` 判断 entry 是否有效，无法区分两种不同情形：
- (A) `chain.entry` 指向**未在 `transit_group` 中定义**的 id（YAML 拼写错误）→ spec §4.3 要求抛 error
- (B) `chain.entry` 指向已定义但因成员为空而被跳过的 transit（运行时退化）→ spec §6 要求 WARN+跳过

当前实现把两种情形都当作 (B) 处理，违反 §4.3。本任务引入 schema 校验以区分两者。

**Files:**
- Modify: `scripts/override/lib/proxy-chains.js`
- Modify: `scripts/override/main.js`
- Modify: `tools/verify-main.js`

- [ ] **Step 1: 写失败的测试**

在 `tools/verify-main.js`，import 扩展（新增 `validateChainsSchema`）：
```js
import {
  applyProxyChains,
  buildChainGroups,
  buildTransitGroups,
  validateChainsSchema,
} from "../scripts/override/lib/proxy-chains.js";
```

在 `testApplyProxyChainsSkipsMissingTransit` 之后追加：
```js
/**
 * 校验 validateChainsSchema：chain.entry 指向未定义的 transit_group.id 时必须抛错。
 * 与 applyProxyChains 的运行时 WARN 行为（transit 定义过但成员空）区分开。
 * @returns {void}
 */
function testValidateChainsSchemaRejectsUnknownEntry() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transti", // 故意拼写错误
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];

  assert.throws(
    () => validateChainsSchema(chainDefinitions, transitDefinitions),
    (error) =>
      error instanceof Error &&
      error.message.includes("transti") &&
      error.message.includes("entry"),
    "entry 指向未定义的 transit.id 应抛错，错误信息含冲突 id 与 entry 关键字",
  );
}

/**
 * 校验 validateChainsSchema：合法配置不抛错。
 * @returns {void}
 */
function testValidateChainsSchemaAcceptsValid() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];
  validateChainsSchema(chainDefinitions, transitDefinitions);
  // 无抛错即通过
}

/**
 * 校验 validateChainsSchema：chain_group 或 transit_group 为空数组时视为合法（跳过校验）。
 * @returns {void}
 */
function testValidateChainsSchemaEmptyArraysAccepted() {
  validateChainsSchema([], []);
  validateChainsSchema([], [{ id: "t", name: "X", transit_pattern: "", flags: "", type: "select" }]);
  // 无抛错即通过
}
```

在 `main()` 中紧跟 `testApplyProxyChainsSkipsMissingTransit();` 之后追加：
```js
  testValidateChainsSchemaRejectsUnknownEntry();
  testValidateChainsSchemaAcceptsValid();
  testValidateChainsSchemaEmptyArraysAccepted();
```

- [ ] **Step 2: 运行验证确认失败**

Run: `npm run verify`
Expected: FAIL，`SyntaxError: ... does not provide an export named 'validateChainsSchema'`。

- [ ] **Step 3: 在 proxy-chains.js 实现 validateChainsSchema**

在 `scripts/override/lib/proxy-chains.js` 的 `buildChainGroups` 定义**之前**追加（让它成为最早被引用的函数，与使用位置顺序一致）：
```js
/**
 * 静态 schema 校验：每个 chain.entry 必须等于某个已定义的 transit_group.id。
 * 本校验独立于运行时成员是否为空，用于区分 "YAML 拼写错误"（schema 错误）
 * 与 "transit 成员空被跳过"（运行时退化）两种场景。
 *
 * @param {Array<{id:string, entry:string}>} chainDefinitions
 * @param {Array<{id:string}>} transitDefinitions
 * @returns {void}  合法时无返回值；不合法时抛 Error。
 */
function validateChainsSchema(chainDefinitions, transitDefinitions) {
  if (!Array.isArray(chainDefinitions) || chainDefinitions.length === 0) {
    return;
  }
  if (!Array.isArray(transitDefinitions)) {
    throw new Error("transit_group 必须是数组");
  }

  const definedTransitIds = new Set();
  for (const definition of transitDefinitions) {
    if (typeof definition?.id === "string" && definition.id.length > 0) {
      definedTransitIds.add(definition.id);
    }
  }

  for (const chain of chainDefinitions) {
    if (typeof chain?.entry !== "string" || chain.entry.length === 0) {
      throw new Error(`chain_group ${chain?.id} 缺少非空的 entry 字段`);
    }
    if (!definedTransitIds.has(chain.entry)) {
      throw new Error(
        `chain_group ${chain.id} 的 entry=${chain.entry} 未在 transit_group 中定义`,
      );
    }
  }
}
```

更新文件末尾的 export 语句（从 `{ applyProxyChains, buildChainGroups, buildTransitGroups }` 改为包含新函数，字母序）：
```js
export { applyProxyChains, buildChainGroups, buildTransitGroups, validateChainsSchema };
```

- [ ] **Step 4: 在 main.js 调用 validateChainsSchema**

在 `scripts/override/main.js` 的 import 区更新：
```js
import {
  applyProxyChains,
  buildChainGroups,
  buildTransitGroups,
  validateChainsSchema,
} from "./lib/proxy-chains.js";
```

在模块顶层 `const transitDefinitions = ...` / `const chainDefinitions = ...` 两行之**后**、`function main(config = {}) {` 之**前**，插入：
```js
// 模块加载期执行 schema 校验：entry 必须引用已定义的 transit_group.id
validateChainsSchema(chainDefinitions, transitDefinitions);
```

这确保 YAML schema 错误在 bundle 加载（模块解析）时立即抛出，而不是等到运行时某个请求触发 main()。

- [ ] **Step 5: 运行验证确认通过**

Run: `npm run verify`
Expected: PASS，包括 3 个新测试 + 全部既有测试。

- [ ] **Step 6: Commit**

```bash
git add scripts/override/lib/proxy-chains.js scripts/override/main.js tools/verify-main.js
git commit -m "feat: 严格校验 chain.entry 必须引用已定义的 transit_group.id"
```

---

## Task 11: validate-output 补全 §7.2 / §7.3 不变量断言

**背景**：spec §7 要求 validate-output 执行四项断言：(1) dialer-proxy 指向存在（Task 8 已实现）、(2) transit_group 成员不得命中 landing_pattern（防环双保险）、(3) chain_group.proxies 非空（不变量）、(4) 组名全局唯一（Task 6 已实现于 buildProxyGroups）。本任务补全 (2) 和 (3)。

结构上当前 pipeline 已保证 (2) 和 (3)，但 spec 要求作为不变量断言捕获未来重构回归。

**Files:**
- Modify: `scripts/override/lib/validate-output.js`
- Modify: `scripts/override/main.js`（更新 validateOutput 调用，传入额外参数）
- Modify: `tools/verify-main.js`

- [ ] **Step 1: 写失败的测试**

在 `testValidateOutputRejectsDanglingDialerProxy` 之后追加：
```js
/**
 * 校验 §7.2：transit_group 的成员若命中任意 chain_group.landing_pattern，validateOutput 应抛错。
 * 用于在未来重构破坏 "landing 节点必须已从 remainingProxies 剔除" 不变量时立即失败。
 * @returns {void}
 */
function testValidateOutputRejectsTransitContainingLanding() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];

  const config = {
    proxies: [{ name: "自建-01" }, { name: "Sample-HK-01" }],
    "proxy-groups": [
      // transit_group 错误地包含了 landing 节点 "自建-01"
      { name: "🔀 中转", type: "select", proxies: ["自建-01", "Sample-HK-01"] },
      { name: "🚪 落地", type: "select", proxies: ["自建-01"] },
    ],
    rules: [`MATCH,${groupDefinitionsConfig.groupDefinitions.fallback.name}`],
  };
  for (const [id, def] of Object.entries(groupDefinitionsConfig.groupDefinitions)) {
    config["proxy-groups"].push({ name: def.name, type: "select", proxies: ["Sample-HK-01"] });
  }

  assert.throws(
    () =>
      validateOutput(config, groupDefinitionsConfig.groupDefinitions, {
        chainDefinitions,
        transitDefinitions,
      }),
    (error) =>
      error instanceof Error &&
      error.message.includes("transit_group") &&
      error.message.includes("landing"),
    "transit_group 含 landing 节点应抛错，错误信息应提示 transit_group 与 landing",
  );
}

/**
 * 校验 §7.3：chain_group.proxies 为空时 validateOutput 应抛错。
 * @returns {void}
 */
function testValidateOutputRejectsEmptyChainGroup() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];

  const config = {
    proxies: [{ name: "Sample-HK-01" }],
    "proxy-groups": [
      { name: "🚪 落地", type: "select", proxies: [] }, // 空 chain_group
      { name: "🔀 中转", type: "select", proxies: ["Sample-HK-01"] },
    ],
    rules: [`MATCH,${groupDefinitionsConfig.groupDefinitions.fallback.name}`],
  };
  for (const [id, def] of Object.entries(groupDefinitionsConfig.groupDefinitions)) {
    config["proxy-groups"].push({ name: def.name, type: "select", proxies: ["Sample-HK-01"] });
  }

  assert.throws(
    () =>
      validateOutput(config, groupDefinitionsConfig.groupDefinitions, {
        chainDefinitions,
        transitDefinitions,
      }),
    (error) => error instanceof Error && error.message.includes("chain_group"),
    "空 chain_group 应抛错，错误信息应提示 chain_group",
  );
}
```

**注意**：`testValidateOutputRejectsEmptyChainGroup` 的配置中 `🚪 落地` 的 `proxies: []` 会先触发 validate-output 现有的 "策略组节点为空" 断言（第 41 行附近）而无法到达新的 §7.3 断言。为避免与旧断言冲突，新断言必须在同一函数中**更早**位置捕获 chain_group 专属违例（或者检查错误信息同时包含 "chain_group" 标记以区分来源）。最简方案：新断言位置在函数早期，紧跟 group.name 提取之后、现有 "proxies 为空" 循环之前，只针对 chain_group name 做空检查。实现细节见 Step 3。

在 `main()` 中紧跟 `testValidateOutputRejectsDanglingDialerProxy();` 之后追加：
```js
  testValidateOutputRejectsTransitContainingLanding();
  testValidateOutputRejectsEmptyChainGroup();
```

- [ ] **Step 2: 运行验证确认失败**

Run: `npm run verify`
Expected: FAIL：两个新测试因 validateOutput 不接受第三参数或未针对 chain/transit 做专项断言而失败。

- [ ] **Step 3: 扩展 validateOutput 签名并实现 §7.2 / §7.3 断言**

在 `scripts/override/lib/validate-output.js`：

(a) 修改函数签名，增加可选第三参（含 chain/transit 定义）：
```js
function validateOutput(config, groupDefinitions, chainsContext = {}) {
```

(b) 更新顶部 JSDoc，新增参数说明：
```js
/**
 * 校验生成配置的完整性和正确性。
 * 检查 proxy-groups 结构、规则引用、MATCH 位置等。
 * @param {Record<string, unknown>} config - 生成后的配置对象。
 * @param {Record<string, {name: string}>} groupDefinitions - 策略组定义。
 * @param {{chainDefinitions?: Array, transitDefinitions?: Array}} [chainsContext]
 *   可选链式代理上下文：用于执行 spec §7.2（transit 不得含 landing）/ §7.3（chain_group 非空）断言。
 *   省略时跳过这两项断言。
 * @returns {void}
 */
```

(c) 在函数**早期**、现有 "strategy group completeness" 检查**之前**（即 `const proxyGroupNames = ...` 声明之后、`for (const group of proxyGroups)` 循环之前），插入 chain/transit 专项断言：
```js
  // §7.2 / §7.3: chain/transit 不变量断言（仅当 chainsContext 提供时）
  const chainDefs = Array.isArray(chainsContext.chainDefinitions) ? chainsContext.chainDefinitions : [];
  const transitDefs = Array.isArray(chainsContext.transitDefinitions) ? chainsContext.transitDefinitions : [];

  if (chainDefs.length > 0 || transitDefs.length > 0) {
    const chainGroupNames = new Set();
    const compiledLandingPatterns = [];
    for (const chain of chainDefs) {
      if (typeof chain?.name === "string") {
        chainGroupNames.add(chain.name);
      }
      if (typeof chain?.landing_pattern === "string" && chain.landing_pattern.length > 0) {
        try {
          compiledLandingPatterns.push(new RegExp(chain.landing_pattern, chain.flags || ""));
        } catch (error) {
          throw new Error(
            `chain_group ${chain.id} 的 landing_pattern 非法正则: ${error.message}`,
          );
        }
      }
    }
    const transitGroupNames = new Set();
    for (const transit of transitDefs) {
      if (typeof transit?.name === "string") {
        transitGroupNames.add(transit.name);
      }
    }

    for (const group of proxyGroups) {
      // §7.3: chain_group.proxies 必须非空
      if (chainGroupNames.has(group.name)) {
        if (!Array.isArray(group.proxies) || group.proxies.length === 0) {
          throw new Error(`chain_group ${group.name} 的 proxies 不得为空`);
        }
      }
      // §7.2: transit_group 成员不得命中任何 chain_group.landing_pattern
      if (transitGroupNames.has(group.name)) {
        const members = Array.isArray(group.proxies) ? group.proxies : [];
        for (const memberName of members) {
          if (typeof memberName !== "string") continue;
          for (const pattern of compiledLandingPatterns) {
            if (pattern.test(memberName)) {
              throw new Error(
                `transit_group ${group.name} 成员 ${memberName} 命中 landing_pattern，违反防环不变量`,
              );
            }
          }
        }
      }
    }
  }
```

- [ ] **Step 4: 在 main.js 调用 validateOutput 时传入 chainsContext**

在 `scripts/override/main.js` 中，将现有调用：
```js
validateOutput(workingConfig, groupDefinitions);
```
替换为：
```js
validateOutput(workingConfig, groupDefinitions, { chainDefinitions, transitDefinitions });
```

- [ ] **Step 5: 运行验证确认通过**

Run: `npm run verify`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add scripts/override/lib/validate-output.js scripts/override/main.js tools/verify-main.js
git commit -m "feat: validate-output 补全 transit 防环与 chain 非空断言"
```


**Spec coverage:**
- §3 数据模型 → Task 1（chains.yaml 脚手架）
- §4 约束与校验：id 唯一性 → Task 2/4 测试；entry 引用完整性 → Task 5（缺失 transit 时 WARN skip）+ Task 8（dialer-proxy 指向必须存在于 proxy-groups）；正则可编译 → Task 2/4/5 的错误抛出；name 全局唯一 → Task 6 组名冲突断言
- §5.1 新模块三个函数 → Task 2 / Task 4 / Task 5
- §5.2 validate-output 新增断言 → Task 8
- §5.3 pipeline → Task 7
- §5.4 proxy-groups 顺序 → Task 6（插入位置）+ Task 7 (wire up)
- §6 退化与空集：chain 未命中跳过 → Task 3；transit 成员空跳过 → Task 4；全空整体跳过 → Task 7（chainsEffective 判断）；上游已有 dialer-proxy → Task 5；landing 重叠首 match → Task 2/3
- §7 validate-output 新增断言 → Task 8 + Task 6 组名去重
- §8 测试场景：基础 / transit 空 / chain 空 / 上游 dialer-proxy 冲突 / entry 指向不存在 id → 分散在 Task 2-5, 7；加上 Task 9 的 no-op bundle 回归

**Placeholder scan:** 无 TBD / TODO / 含糊表述。所有代码步骤提供了完整代码块；所有命令给出了预期输出；Task 9 Step 4 对"未找到章节"明确指示跳过而非留空。

**Type consistency:**
- `buildChainGroups` 返回 `{ chainGroups, remainingProxies }` — 在 Task 2/3 定义，在 Task 7 消费，键名一致。
- `buildTransitGroups` 返回 `{ groups, idToName }` — 在 Task 4 定义，在 Task 7 消费，键名一致。
- `applyProxyChains` 签名 `(config, chainDefinitions, transitIdToName)` — Task 5 定义，Task 7 消费一致。
- `buildProxyGroups` 第三参 `{ chainGroups, transitGroups }` — Task 6 定义，Task 7 消费一致。

无发现跨任务的命名/签名漂移。

---

## 执行入口选择

Plan complete and saved to `docs/superpowers/plans/2026-04-17-chain-proxy.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
