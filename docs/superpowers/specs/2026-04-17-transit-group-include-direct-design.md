# transit_group 直连选项(include_direct)设计

**日期**:2026-04-17
**范围**:`definitions/proxy-groups/chains.yaml` + `scripts/override/lib/proxy-chains.js` + `scripts/override/lib/validate-output.js` + `tools/verify-main.js` + `docs/DESIGN.md`
**不涉及**:`chain_group`(落地组);`fallback` / `load-balance` 等其他 Mihomo 组类型的 DIRECT 屏蔽策略(本次不做)。

---

## 一、背景与目标

当前 `transit_group` 在 `scripts/override/lib/proxy-chains.js:buildTransitGroups` 内生成,`proxies` 数组只包含从订阅中按 `transit_pattern` 过滤出的节点名。Mihomo 面板上用户只能在这些节点间切换,无法在 transit 层面"临时切到直连"(即落地节点不经过任何中转,直接出海)。

目标:让 `transit_group` 能够声明式地把 `DIRECT` 作为候选项追加到 `proxies` 末尾,供 Mihomo 在面板上手动切换。由落地节点注入的 `dialer-proxy` 仍指向 transit 组名,当 Mihomo 把该组切到 DIRECT 时,落地节点等价于"绕过中转直连"。

## 二、需求与澄清

经澄清轮确认:

| 澄清项 | 决定 |
|--------|------|
| 直连在哪一层生效 | 在 **transit_group** 的 `proxies` 列表末尾追加 `DIRECT`;chain_group 不改 |
| 默认值 | 字段 `include_direct` **默认关(false)**,缺省 = 现状,零行为变更 |
| `type: url-test` 的处理 | **WARN 并忽略**(不追加 DIRECT)——避免 url-test 组把 DIRECT 测成零延迟永远胜出 |
| `fallback` / `load-balance` | **暂不屏蔽**,仅针对 `url-test`;未来有需要再扩展名单 |
| 成员为空 + `include_direct: true` | **仍然跳过**,与现有"过滤后无可用节点即跳过"语义一致,DIRECT 不挽救空组 |
| 字段名 / 追加位置 | 字段名 `include_direct`;DIRECT 追加到 `proxies` 数组**末尾** |

## 三、数据模型

### 3.1 `definitions/proxy-groups/chains.yaml`

> **术语对齐**:`transit_group[].type` 字段与 `definitions/proxy-groups/groupDefinitions.yaml` 中策略组的 `type` 完全同源,都是 Mihomo 策略组类型(当前仓库中出现过的取值有 `select` 与 `url-test`,未来可能扩展到 `fallback` / `load-balance` 等)。本项目不对 `type` 做枚举限制,只在 runtime 针对特定值(本次仅 `url-test`)做 `include_direct` 的行为差异化处理。

`transit_group` 每项新增可选字段 `include_direct: boolean`,缺省等价于 `false`:

```yaml
transit_group:
  - id: transit
    name: "🔀 中转"
    transit_pattern: "Transit|中转|自建"
    flags: i
    type: select
    include_direct: true          # 新增。缺省 / false = 现状;true = proxies 末尾追加 DIRECT
```

行为语义表:

| `include_direct` | `type` | 最终 `proxies` |
|------------------|--------|----------------|
| 缺省 / `false` | 任意 | 仅 `transit_pattern` 过滤结果(现状) |
| `true` | `url-test` | 仅过滤结果,**不追加** DIRECT,runtime WARN |
| `true` | `select` 或其他 | 过滤结果末尾追加字符串 `"DIRECT"` |

`chain_group` **不引入** `include_direct`,本设计不讨论对落地组开放直连的场景。

### 3.2 本次 `chains.yaml` 迁移

**本次实现不修改现有 `chains.yaml` 的声明内容** —— `include_direct` 缺省即 false,现有"🔀 中转"行为零变更。是否为该组启用 DIRECT,留给后续独立提交。

## 四、Schema 校验(模块加载期)

在 `scripts/override/lib/proxy-chains.js:validateChainsSchema` 中,对 `transitDefinitions` 新增一轮字段校验。判定规则:

| `include_direct` 的值 | 处理 |
|-----------------------|------|
| 字段**缺省**(键不存在) | 通过(等价于 false) |
| `true` / `false` | 通过 |
| `null`(含 YAML 中 `include_direct:` 的空值) | 抛错 |
| 字符串 / 数字 / 对象 / 数组 / 其他 | 抛错 |

等价判定逻辑:"字段存在(即在 YAML 中被显式写出)且类型不是布尔"→ 抛 `transit_group <id> 的 include_direct 必须是布尔`。

补充约束:

- **不对 `type` 做枚举校验**,保持与现有 transit_group / chain_group `type` 字段自由透传的约定一致。
- **不把 `include_direct: true` + `type: url-test` 视为 schema 错**,留给 runtime WARN 处理。

理由:schema 层只拦截 YAML 拼写错;运行期可观测的退化(WARN)不阻断构建。显式拒绝 `null` 是为了防止 YAML 里 `include_direct:`(无值)这种易被误写的形式静默通过。

## 五、运行层改造

### 5.1 `scripts/override/lib/proxy-chains.js:buildTransitGroups`

在现有"成员过滤 → 成员空跳过 → push group"流程的第 3 步前插入 DIRECT 追加逻辑。伪代码:

```js
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
    console.log(`[override] WARN: transit_group ${definition.id} 过滤后无可用节点,已跳过该组`);
    continue;                           // ← 空组跳过优先于 include_direct
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

- `members.length === 0` 的判断优先级**高于** `include_direct`——保持"空组跳过"作为硬不变量。
- DIRECT 字符串固定追加到 `memberNames` 数组末尾。
- `idToName` 映射仅在成员非空(且组被 push)后写入,`applyProxyChains` 的 `dialer-proxy` 注入行为零改动。
- 第 4 节已确认 schema 保证 `include_direct` 必为布尔或缺省,`=== true` 判断安全。

### 5.2 `applyProxyChains` / `dialer-proxy` 不变

`applyProxyChains` 写入 `proxy["dialer-proxy"] = transit.name`(策略组名),不接触 DIRECT。当 Mihomo 面板把 transit 组切到 DIRECT 时,切换发生在 Mihomo 运行时,不回流到 `config.proxies`,`validateOutput` 的 `dialer-proxy ∈ proxyGroupNames` 断言仍通过。

## 六、输出校验不变量

### 6.1 §7.2 对 DIRECT 字面量的豁免(`scripts/override/lib/validate-output.js`)

现有 §7.2 循环对 transit 组每个成员名逐一对 `landing_pattern` 做 `test`,命中即抛错。当前 `landing_pattern`(`Relay|落地|^(?=.*直连)(?=.*家宽)`)对字符串 `"DIRECT"` 不命中,本设计**防御性**显式短路:

```js
for (const memberName of members) {
  if (typeof memberName !== "string") continue;
  if (memberName === "DIRECT") continue;   // ← 新增:DIRECT 不参与 landing 命中判定
  for (const pattern of compiledLandingPatterns) {
    if (pattern.test(memberName)) {
      throw new Error(...);
    }
  }
}
```

理由:DIRECT 是 Mihomo 内置出口字面量,而非订阅中的节点名,不适用"落地 / 中转互斥"的语义。未来若 `landing_pattern` 被改成贪婪正则(如 `.*`),也不会误伤 DIRECT。

### 6.2 §7.3 / dialer-proxy 一致性

- §7.3(chain_group.proxies 非空)不受影响。
- dialer-proxy 一致性断言不受影响(DIRECT 不出现在 `proxy["dialer-proxy"]` 字段中)。

## 七、测试(`tools/verify-main.js`)

### 7.1 `buildTransitGroups` 单元用例

1. `include_direct` 缺省 → 输出 `groups[0].proxies` **不**以 `"DIRECT"` 结尾。
2. `include_direct: false` → 同上,不追加。
3. `include_direct: true, type: "select"` → `proxies` **末尾**为 `"DIRECT"`;前 N 项为过滤后节点名,顺序与过滤前一致。
4. `include_direct: true, type: "url-test"` → `proxies` **不**以 `"DIRECT"` 结尾,且捕获的 `console.log` 输出包含 `WARN: transit_group <id> 为 url-test,忽略 include_direct=true`。
5. `include_direct: true` + `transit_pattern` 过滤后成员为空 → 组被跳过(WARN `过滤后无可用节点`),`groups` 不含该 id,`idToName` 不含该 id;**DIRECT 不挽救空组**。

### 7.2 `validateChainsSchema` 单元用例

6. `include_direct: "true"`(字符串) → 抛 `transit_group <id> 的 include_direct 必须是布尔`。
7. `include_direct: 1`(数字) → 同上抛错。
8. `include_direct` 缺省 / `undefined` → 通过;`include_direct: null` → 抛错(避免 YAML `include_direct:` 空值误通过)。

### 7.3 端到端 bundle 用例(扩展 `testBundleChainsEndToEnd` 或新增)

9. 驱动 bundle `main`,当 `chains.yaml`(或测试夹具)声明 `include_direct: true` 时,在 `workingConfig["proxy-groups"]` 中按 `transit.name` 找到对应组,断言 `proxies` 末尾为 `"DIRECT"`;声明 `false` / 缺省时断言末尾**不是** `"DIRECT"`。
10. `validateOutput` 对含 DIRECT 成员的 transit 组不抛错(验证 §6.1 的 DIRECT 豁免)。

### 7.4 当前 `chains.yaml` 的回归

- 本次不修改现有 `chains.yaml`,既有 `testBundlePositivePath` / `testBundleChainsEndToEnd` 断言应当**零修改**通过。

## 八、文档更新(`docs/DESIGN.md`)

- **§6.2**:transit_group 声明示例段增加 `include_direct` 行与字段说明;明确 `type` 的语义来源与 `groupDefinitions.yaml` 的 `type` 一致(Mihomo 策略组类型,无本项目内枚举限制)。
- **§6.4**:`buildTransitGroups` 语义补充——
  - 新增 `include_direct` 字段行为表(对应本设计 §3.1 的表格)。
  - 说明 `type === "url-test"` + `include_direct: true` 的 WARN 退化。
  - 重申"成员为空跳过"优先于 DIRECT 追加。
- **§6.8 / §7.2**:追加一条——transit 成员中的字面量 `"DIRECT"` 不参与 `landing_pattern` 命中判定。
- **附录 B「已知局限」**:追加一条——当前仅对 `type: "url-test"` 屏蔽 DIRECT 追加,`fallback` / `load-balance` 等其他 Mihomo 策略组类型未纳入名单;若后续需要按"所有测速 / 权重算法组"统一屏蔽,再扩展禁用名单。

## 九、非目标与未来扩展

- **不** 引入 `chain_group.include_direct`。
- **不** 屏蔽 `fallback` / `load-balance` 组的 DIRECT 追加。
- **不** 引入 transit_group `type` 的枚举校验。
- **不** 自动把 `DIRECT` 追加到 `proxy_select` 或其他自定义组——那是 `groupDefinitions.yaml` 的职责,不走本机制。

如果未来需要"一次为所有中转组启用直连",可在 `chains.yaml` 顶层添加 `defaults.transit.include_direct`,本设计不前置。
