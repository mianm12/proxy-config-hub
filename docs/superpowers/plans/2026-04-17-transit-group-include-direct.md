# transit_group 直连选项(include_direct) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `transit_group` 增加可选字段 `include_direct: boolean`,声明 `true` 时在 `proxies` 末尾追加字符串 `"DIRECT"`;当 `type === "url-test"` 时 WARN 并忽略;成员为空仍跳过。

**Architecture:** 单点改动集中在 `scripts/override/lib/proxy-chains.js` 的 `validateChainsSchema`(schema 校验)与 `buildTransitGroups`(runtime 追加);在 `scripts/override/lib/validate-output.js` 的 §7.2 断言中短路字面量 `"DIRECT"` 以防御 `landing_pattern` 贪婪正则。`definitions/proxy-groups/chains.yaml` 本次不改,`include_direct` 缺省即 false,行为零回归。

**Tech Stack:** Node.js ESM、esbuild、js-yaml(已在仓库 devDeps);测试用 `node:assert/strict` + 自写 `tools/verify-main.js`(无外部测试框架)。

**Commit policy:** 本仓库 `CLAUDE.md` 明确"不主动提交,除非用户明确要求"。以下每个 Task 的末尾给出**建议提交消息**(≤ 50 中文字,不加署名),但**不执行** `git commit`——由用户在批准后自行提交或指示执行。

---

## 任务总览与文件拓扑

| Task | 动作 | 目标文件 |
|------|------|---------|
| 1 | schema:`include_direct` 类型校验 | `scripts/override/lib/proxy-chains.js` · `tools/verify-main.js` |
| 2 | runtime:`buildTransitGroups` 追加 DIRECT / WARN / 空组优先 | `scripts/override/lib/proxy-chains.js` · `tools/verify-main.js` |
| 3 | validate-output §7.2 对 DIRECT 字面量的豁免 | `scripts/override/lib/validate-output.js` · `tools/verify-main.js` |
| 4 | 构建 & 全量 `verify` 回归 | (脚本) |
| 5 | 更新 `docs/DESIGN.md` | `docs/DESIGN.md` |

文件职责回顾(参照设计文档 §5-§6):

- `scripts/override/lib/proxy-chains.js` 集中承载 transit / chain 逻辑,本次扩展其内部两个已有函数,无新增导出。
- `scripts/override/lib/validate-output.js` 的 §7.2 循环内新增一条字面量豁免,属防御性加固。
- `tools/verify-main.js` 新增 5 个测试函数并在 `main()` 中注册。

---

## Task 1:validateChainsSchema 对 include_direct 类型校验

**Files:**
- Modify: `scripts/override/lib/proxy-chains.js`(`validateChainsSchema` 函数,文件行约 52-77)
- Modify: `tools/verify-main.js`(新增测试函数 + 在 `main()` 注册)

### 目标

在 `validateChainsSchema` 中,对 `transitDefinitions` 遍历时新增对每个 `transit.include_direct` 字段的类型校验:

- 字段不存在(`undefined`)→ 通过。
- `true` / `false` → 通过。
- 其他任何值(含 `null`、字符串、数字、对象)→ 抛 `transit_group <id> 的 include_direct 必须是布尔`。

### Steps

- [ ] **Step 1: 写失败测试(`tools/verify-main.js`)**

在 `testValidateChainsSchemaEmptyArraysAccepted` 函数**之后**新增下列 2 个测试函数:

```javascript
/**
 * 校验 validateChainsSchema:transit_group.include_direct 若存在必须为布尔。
 * undefined / true / false 通过;null / 字符串 / 数字等一律抛错。
 * @returns {void}
 */
function testValidateChainsSchemaAcceptsBooleanIncludeDirect() {
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

  // include_direct 缺省 → 通过
  validateChainsSchema(chainDefinitions, [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ]);

  // include_direct: true → 通过
  validateChainsSchema(chainDefinitions, [
    {
      id: "transit",
      name: "🔀 中转",
      transit_pattern: "",
      flags: "i",
      type: "select",
      include_direct: true,
    },
  ]);

  // include_direct: false → 通过
  validateChainsSchema(chainDefinitions, [
    {
      id: "transit",
      name: "🔀 中转",
      transit_pattern: "",
      flags: "i",
      type: "select",
      include_direct: false,
    },
  ]);
}

/**
 * 校验 validateChainsSchema:transit_group.include_direct 非布尔值(含 null / 字符串 / 数字)应抛错。
 * @returns {void}
 */
function testValidateChainsSchemaRejectsNonBooleanIncludeDirect() {
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

  const invalidValues = [null, "true", "false", 0, 1, {}, []];

  for (const invalid of invalidValues) {
    assert.throws(
      () =>
        validateChainsSchema(chainDefinitions, [
          {
            id: "transit",
            name: "🔀 中转",
            transit_pattern: "",
            flags: "i",
            type: "select",
            include_direct: invalid,
          },
        ]),
      (error) =>
        error instanceof Error &&
        error.message.includes("transit") &&
        error.message.includes("include_direct") &&
        error.message.includes("布尔"),
      `include_direct=${JSON.stringify(invalid)} 应抛错且错误信息含 transit/include_direct/布尔`,
    );
  }
}
```

在 `main()` 函数的测试调用序列中,将这两个测试紧跟在现有 `testValidateChainsSchemaEmptyArraysAccepted();` 调用之后注册:

```javascript
  testValidateChainsSchemaEmptyArraysAccepted();
  testValidateChainsSchemaAcceptsBooleanIncludeDirect();
  testValidateChainsSchemaRejectsNonBooleanIncludeDirect();
  testBuildProxyGroupsInsertsChainAndTransit();
```

- [ ] **Step 2: 运行测试,确认失败**

```bash
npm run verify
```

Expected: 两个新测试中至少一个抛错(当前 `validateChainsSchema` 尚无 `include_direct` 校验,`Rejects` 系列用例会因为不抛错而让 `assert.throws` 本身失败)。

具体预期:`testValidateChainsSchemaRejectsNonBooleanIncludeDirect` 首个 `invalid=null` 迭代就会因 "Missing expected exception" 失败,进程非零退出。

- [ ] **Step 3: 在 `validateChainsSchema` 中实现校验**

编辑 `scripts/override/lib/proxy-chains.js`,修改 `validateChainsSchema` 函数(原在约第 52-77 行)。在函数**返回前**追加一段对 transitDefinitions 的校验:

```javascript
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

  // 新增:transit_group.include_direct 若出现在对象上,必须是布尔
  for (const transit of transitDefinitions) {
    if (!transit || typeof transit !== "object") continue;
    if (!Object.prototype.hasOwnProperty.call(transit, "include_direct")) continue;
    if (typeof transit.include_direct !== "boolean") {
      throw new Error(
        `transit_group ${transit.id} 的 include_direct 必须是布尔`,
      );
    }
  }
}
```

关键点:
- 用 `hasOwnProperty` 判定"字段是否被显式写出",确保缺省(键不存在)通过而 `null` 被拒绝。
- 错误信息必须同时含 `transit`(来源:模板 `transit_group ${transit.id} ...`)、`include_direct`、`布尔` 三个关键词,以匹配测试断言。

- [ ] **Step 4: 运行测试,确认通过**

```bash
npm run verify
```

Expected: 全部测试通过,终端输出 `主 bundle 验证通过`,退出码 0。

- [ ] **Step 5: 准备提交(由用户触发)**

建议提交消息(≤ 50 字):

```
feat: validateChainsSchema 校验 include_direct 类型
```

---

## Task 2:buildTransitGroups 追加 DIRECT / WARN / 空组优先

**Files:**
- Modify: `scripts/override/lib/proxy-chains.js`(`buildTransitGroups` 函数,文件行约 185-221)
- Modify: `tools/verify-main.js`(新增 3 个测试函数 + 在 `main()` 注册)

### 目标

改造 `buildTransitGroups` 的循环体:

1. 成员过滤后 `members.length === 0` 仍**优先跳过**(不变)。
2. 成员非空时,若 `definition.include_direct === true`:
   - `definition.type === "url-test"` → 输出 WARN,**不追加** DIRECT。
   - 其他 `type` → 在成员名数组末尾追加字符串 `"DIRECT"`。
3. `include_direct === false / undefined` → 不追加。

### Steps

- [ ] **Step 1: 写失败测试(`tools/verify-main.js`)**

在现有 `testBuildTransitGroupsDuplicateId` 函数之后新增下列 3 个测试函数。注意:为验证 `url-test` 分支的 WARN,需要短暂捕获 `console.log` 输出。

```javascript
/**
 * 校验 buildTransitGroups:include_direct=true 且 type 非 url-test 时,
 * proxies 末尾追加字符串 "DIRECT";缺省 / false 时不追加。
 * @returns {void}
 */
function testBuildTransitGroupsAppendsDirectForSelect() {
  const remaining = [{ name: "Sample-HK-01" }, { name: "Sample-JP-01" }];

  // include_direct 缺省 → 不追加
  const { groups: groupsMissing } = buildTransitGroups(remaining, [
    { id: "t1", name: "T1", transit_pattern: "", flags: "", type: "select" },
  ]);
  assert.deepEqual(
    groupsMissing[0].proxies,
    ["Sample-HK-01", "Sample-JP-01"],
    "include_direct 缺省时 proxies 不应追加 DIRECT",
  );

  // include_direct: false → 不追加
  const { groups: groupsFalse } = buildTransitGroups(remaining, [
    { id: "t2", name: "T2", transit_pattern: "", flags: "", type: "select", include_direct: false },
  ]);
  assert.deepEqual(
    groupsFalse[0].proxies,
    ["Sample-HK-01", "Sample-JP-01"],
    "include_direct=false 时 proxies 不应追加 DIRECT",
  );

  // include_direct: true + type=select → 末尾追加 DIRECT
  const { groups: groupsTrue } = buildTransitGroups(remaining, [
    { id: "t3", name: "T3", transit_pattern: "", flags: "", type: "select", include_direct: true },
  ]);
  assert.deepEqual(
    groupsTrue[0].proxies,
    ["Sample-HK-01", "Sample-JP-01", "DIRECT"],
    "include_direct=true + type=select 时 proxies 末尾应为 'DIRECT'",
  );
}

/**
 * 校验 buildTransitGroups:include_direct=true 且 type=url-test 时,
 * 不追加 DIRECT 且输出 WARN 日志。
 * @returns {void}
 */
function testBuildTransitGroupsSkipsDirectForUrlTest() {
  const remaining = [{ name: "Sample-HK-01" }, { name: "Sample-JP-01" }];
  const originalLog = console.log;
  const captured = [];
  console.log = (message) => captured.push(String(message));

  try {
    const { groups } = buildTransitGroups(remaining, [
      {
        id: "auto-transit",
        name: "T-URL",
        transit_pattern: "",
        flags: "",
        type: "url-test",
        include_direct: true,
      },
    ]);
    assert.deepEqual(
      groups[0].proxies,
      ["Sample-HK-01", "Sample-JP-01"],
      "type=url-test 时即便 include_direct=true 也不应追加 DIRECT",
    );
  } finally {
    console.log = originalLog;
  }

  assert.ok(
    captured.some(
      (line) =>
        line.includes("WARN") &&
        line.includes("transit_group") &&
        line.includes("auto-transit") &&
        line.includes("url-test") &&
        line.includes("include_direct"),
    ),
    `应输出 WARN 日志,实际捕获: ${JSON.stringify(captured)}`,
  );
}

/**
 * 校验 buildTransitGroups:transit_pattern 过滤后成员为空时,
 * 即便 include_direct=true 也仍然跳过(DIRECT 不挽救空组)。
 * @returns {void}
 */
function testBuildTransitGroupsEmptyMembersSkippedEvenWithIncludeDirect() {
  const remaining = [{ name: "Sample-HK-01" }];
  const { groups, idToName } = buildTransitGroups(remaining, [
    {
      id: "jp",
      name: "🇯🇵 T-JP",
      transit_pattern: "Japan",
      flags: "i",
      type: "select",
      include_direct: true,
    },
  ]);

  assert.equal(groups.length, 0, "空成员 + include_direct=true 仍应跳过");
  assert.equal(idToName.has("jp"), false, "被跳过的 transit 不进入 idToName");
}
```

在 `main()` 中注册(紧跟现有 `testBuildTransitGroupsDuplicateId();` 调用):

```javascript
  testBuildTransitGroupsDuplicateId();
  testBuildTransitGroupsAppendsDirectForSelect();
  testBuildTransitGroupsSkipsDirectForUrlTest();
  testBuildTransitGroupsEmptyMembersSkippedEvenWithIncludeDirect();
  testApplyProxyChainsBasic();
```

- [ ] **Step 2: 运行测试,确认失败**

```bash
npm run verify
```

Expected: `testBuildTransitGroupsAppendsDirectForSelect` 在第三条 `deepEqual` 断言失败(`include_direct=true` 时预期尾部 `"DIRECT"` 但实际无),错误信息含 `include_direct=true + type=select 时 proxies 末尾应为 'DIRECT'`。

- [ ] **Step 3: 修改 `buildTransitGroups`**

编辑 `scripts/override/lib/proxy-chains.js`,将 `buildTransitGroups` 的循环体(原在约第 195-218 行)改为:

```javascript
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
        `[override] WARN: transit_group ${definition.id} 过滤后无可用节点,已跳过该组`,
      );
      continue;
    }

    const memberNames = members.map((proxy) => proxy.name);
    if (definition.include_direct === true) {
      if (definition.type === "url-test") {
        console.log(
          `[override] WARN: transit_group ${definition.id} 为 url-test,忽略 include_direct=true`,
        );
      } else {
        memberNames.push("DIRECT");
      }
    }

    groups.push({
      name: definition.name,
      type: definition.type,
      proxies: memberNames,
    });
    idToName.set(definition.id, definition.name);
  }
```

关键点:
- `members.length === 0` 判断在最外层,优先于 `include_direct`。
- WARN 字符串必须同时包含 `"WARN"`、`"transit_group"`、`definition.id`、`"url-test"`、`"include_direct"` 五个关键词,以满足测试断言。

- [ ] **Step 4: 运行测试,确认通过**

```bash
npm run verify
```

Expected: 全部测试通过。

- [ ] **Step 5: 准备提交(由用户触发)**

建议提交消息(≤ 50 字):

```
feat: transit_group 支持 include_direct 选项追加 DIRECT
```

---

## Task 3:validate-output.js §7.2 对 DIRECT 字面量的豁免

**Files:**
- Modify: `scripts/override/lib/validate-output.js`(§7.2 循环,文件行约 80-92)
- Modify: `tools/verify-main.js`(新增测试函数 + 在 `main()` 注册)

### 目标

§7.2 循环中对每个 transit 成员调用 `pattern.test(memberName)`;字面量 `"DIRECT"` 是 Mihomo 内置出口关键字,不是订阅节点名,不应参与 `landing_pattern` 命中判定。当用户在 `chains.yaml` 中使用贪婪的 `landing_pattern`(例如为调试临时改为 `.*`)时,§7.2 不得误判含 DIRECT 的 transit 组。

### Steps

- [ ] **Step 1: 写失败测试(`tools/verify-main.js`)**

在 `testValidateOutputRejectsEmptyChainGroup` 之后新增:

```javascript
/**
 * 校验 §7.2 的 DIRECT 字面量豁免:transit_group.proxies 含 "DIRECT" 时,
 * 即使 landing_pattern 为贪婪正则(会命中 "DIRECT" 字符串),也不应抛错。
 * DIRECT 是 Mihomo 内置出口关键字,非订阅节点名,应被短路豁免。
 * @returns {void}
 */
function testValidateOutputAllowsDirectLiteralInTransit() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: ".*", // 贪婪正则,会命中任意字符串(包括 "DIRECT")
      flags: "",
      entry: "transit",
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];

  const config = {
    proxies: [{ name: "Sample-HK-01" }, { name: "自建-01" }],
    "proxy-groups": [
      // transit_group.proxies 含 DIRECT 字面量
      { name: "🔀 中转", type: "select", proxies: ["Sample-HK-01", "DIRECT"] },
      { name: "🚪 落地", type: "select", proxies: ["自建-01"] },
    ],
    rules: [`MATCH,${groupDefinitionsConfig.groupDefinitions[placeholdersConfig.fallback].name}`],
  };
  for (const def of Object.values(groupDefinitionsConfig.groupDefinitions)) {
    config["proxy-groups"].push({ name: def.name, type: "select", proxies: ["Sample-HK-01"] });
  }

  // 不应抛错:DIRECT 字面量应被 §7.2 短路豁免
  validateOutput(config, groupDefinitionsConfig.groupDefinitions, {
    chainDefinitions,
    transitDefinitions,
  });
}
```

在 `main()` 中紧跟 `testValidateOutputRejectsEmptyChainGroup();` 注册:

```javascript
  testValidateOutputRejectsEmptyChainGroup();
  testValidateOutputAllowsDirectLiteralInTransit();
  await testBuildYamlModulesRejectsMissingPlaceholdersField();
```

- [ ] **Step 2: 运行测试,确认失败**

```bash
npm run verify
```

Expected: 新测试抛错,原因是 `validateOutput` 当前未对 `"DIRECT"` 做短路,`landing_pattern=.*` 命中 `"DIRECT"` 会触发 `transit_group 🔀 中转 成员 DIRECT 命中 landing_pattern...` 异常。

- [ ] **Step 3: 在 §7.2 循环中加入 DIRECT 短路**

编辑 `scripts/override/lib/validate-output.js`,修改 §7.2 的 member 循环(原在约第 82-92 行):

```javascript
      // §7.2: transit_group 成员不得命中任何 chain_group.landing_pattern
      if (transitGroupNames.has(group.name)) {
        const members = Array.isArray(group.proxies) ? group.proxies : [];
        for (const memberName of members) {
          if (typeof memberName !== "string") continue;
          if (memberName === "DIRECT") continue;   // 字面量 DIRECT 不参与 landing 命中判定
          for (const pattern of compiledLandingPatterns) {
            if (pattern.test(memberName)) {
              throw new Error(
                `transit_group ${group.name} 成员 ${memberName} 命中 landing_pattern,违反防环不变量`,
              );
            }
          }
        }
      }
```

- [ ] **Step 4: 运行测试,确认通过**

```bash
npm run verify
```

Expected: 全部测试通过。

- [ ] **Step 5: 准备提交(由用户触发)**

建议提交消息(≤ 50 字):

```
fix: validateOutput §7.2 短路 DIRECT 字面量成员
```

---

## Task 4:构建 & 全量 verify 回归

### 目标

确认本次改动不破坏任何现有测试,bundle 能够正常编译。

**Files:**(无改动,仅执行脚本)

### Steps

- [ ] **Step 1: 执行完整构建**

```bash
npm run build
```

Expected: 依次输出 `rules:build` 转换日志(按 `definitions/**/*.yaml` 计数)与 esbuild 打包日志,生成 `dist/scripts/override/main.js`,退出码 0。

- [ ] **Step 2: 执行完整校验**

```bash
npm run verify
```

Expected: 所有测试依次运行,包括 `testBundlePositivePath`(通过 `loadBundleRuntime()` 实际加载 `dist/scripts/override/main.js` 并驱动 `main()`)与 `testBundleChainsEndToEnd`,最终输出 `主 bundle 验证通过`,退出码 0。bundle 的加载兼容性由 `loadBundleRuntime` 内部覆盖,无需额外 smoke check。

- [ ] **Step 3: 本 Task 无代码产物,不需要提交**

若前面 Task 1-3 的提交消息尚未合并为一次提交,此时可一并提交;否则跳过。

---

## Task 5:更新 docs/DESIGN.md

**Files:**
- Modify: `docs/DESIGN.md`

### 目标

按设计文档 §8 的列表在 `docs/DESIGN.md` 中加入对应段落,使读者从仓库唯一事实来源即可了解 `include_direct` 的行为与边界。

### Steps

- [ ] **Step 1: 修改 §6.2(链式代理声明)**

打开 `docs/DESIGN.md`,定位到 §6.2 的 YAML 示例块(约含 `transit_pattern: "Transit|中转|自建"`)。在 `transit_group` 条目内 `type: select` 下方插入一行,同时在示例上方的导读段落追加一句术语对齐:

```yaml
transit_group:
  - id: transit
    name: "🔀 中转"
    transit_pattern: "Transit|中转|自建"
    flags: i
    type: select
    include_direct: false   # 可选布尔;true 时在成员列表末尾追加 DIRECT(type=url-test 时忽略并 WARN)
```

并在该节首段或示例前追加一句:

> `transit_group[].type` 与 `groupDefinitions[*].type` 同源,均为 Mihomo 策略组类型(当前仓库中出现的取值为 `select` / `url-test`),本项目不做枚举限制。

- [ ] **Step 2: 修改 §6.4(`buildTransitGroups`)**

在原段落列出"空 `transit_pattern` → 全部;非空 → 过滤;成员为空跳过并 WARN"三条的**之后**,追加如下两条:

> - **`include_direct: true` + `type !== "url-test"`**:成员名数组末尾追加字符串 `"DIRECT"`,作为 Mihomo 面板上的手动直连候选。
> - **`include_direct: true` + `type === "url-test"`**:输出 `[override] WARN: transit_group <id> 为 url-test,忽略 include_direct=true`,不追加 DIRECT(避免 url-test 把 DIRECT 测成零延迟永久胜出)。
> - 无论 `include_direct` 是否为 true,**成员为空仍跳过该组**——DIRECT 不挽救空组。

- [ ] **Step 3: 修改 §6.8(防环与非空不变量)**

在 §6.8 现有"**§7.2**:…消除链路自回环。"条目末尾追加一句:

> 实现上对字符串 `"DIRECT"` 做短路豁免——DIRECT 是 Mihomo 内置出口关键字而非订阅节点名,不适用落地 / 中转互斥判定。

- [ ] **Step 4: 修改附录 B「已知局限与演进方向」**

在附录 B 末尾新增一条:

> - **中转组直连仅屏蔽 `url-test`**:`transit_group[].include_direct: true` 在 `type === "url-test"` 时 WARN 忽略;`fallback` / `load-balance` 等 Mihomo 其他策略组类型未纳入屏蔽名单。若未来需要"所有测速 / 权重算法组"统一屏蔽 DIRECT 追加,可在 `buildTransitGroups` 内扩展禁用名单。

- [ ] **Step 5: 准备提交(由用户触发)**

建议提交消息(≤ 50 字):

```
docs: 同步 DESIGN.md include_direct 行为与不变量
```

---

## 完整度自审(plan 作者已执行)

- **spec 覆盖**:
  - spec §3.1 数据模型 → Task 1(schema)+ Task 2(runtime)+ Task 5 §6.2(文档)。
  - spec §4 schema 校验 → Task 1。
  - spec §5.1 runtime 改造 → Task 2。
  - spec §5.2 dialer-proxy 不变 → 无需单独任务,由现有 `testBundleChainsEndToEnd` / `testChainPipelineIntegration` / `testValidateOutputRejectsDanglingDialerProxy` 保持覆盖(Task 4 回归步骤中重跑)。
  - spec §6.1 §7.2 DIRECT 豁免 → Task 3。
  - spec §7.1-7.3 测试 → Task 1 / Task 2 / Task 3 内嵌 TDD step。
  - spec §8 文档更新 → Task 5。
- **placeholder 扫描**:所有代码块已写完整(包含 import、函数体、错误信息字符串);所有命令已给出具体的 `npm run` 或 `node -e` 形式;无 TBD / TODO。
- **类型一致**:Task 1 引入的错误信息模板 `transit_group ${transit.id} 的 include_direct 必须是布尔` 在 Task 1 的测试断言中精确匹配(含 `transit` / `include_direct` / `布尔` 三关键词);Task 2 的 WARN 字符串 `[override] WARN: transit_group ${definition.id} 为 url-test,忽略 include_direct=true` 在 Task 2 测试断言中精确匹配(含 `WARN` / `transit_group` / `url-test` / `include_direct`)。

---

## 执行选择

计划已落地到 `docs/superpowers/plans/2026-04-17-transit-group-include-direct.md`,两种执行方式任选:

1. **Subagent-Driven(推荐)**:我按 task 派出新 subagent,每完成一个 task 后我做 review,再派下一个。
2. **Inline Execution**:在本会话内按 task 顺序执行,每个 task 结束后暂停等你审。

选哪个?
