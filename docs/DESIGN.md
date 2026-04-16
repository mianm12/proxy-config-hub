# proxy-config-hub 设计方案 v1

> 当前仓库实现状态（2026-04-12）
>
> - 当前唯一的声明型 YAML 源目录是 `definitions/`，不是 `rules/`
> - `definitions/rules/` 承载规则装配 YAML（inlineRules/ruleProviders），并生成到 `scripts/config/rules/`
> - `definitions/proxy-groups/` 承载策略组与链式代理构建数据（groupDefinitions/regions/placeholders/chains），并生成到 `scripts/config/proxy-groups/`
> - `definitions/mihomo-preset/` 承载 Mihomo 顶层键预设 YAML（base/dns/sniffer/tun/profile/geodata），并生成到 `scripts/config/mihomo-preset/`
> - `definitions/assets/custom/` 是模板/发布资产子树，不参与 active ruleset 装配
> - `scripts/config/` 是生成树，不是源数据目录
> - 当前对外入口是单入口 `scripts/override/main.js`，构建产物是 `dist/scripts/override/main.js`
> - 本文后续若仍出现 `rules/` 作为长期源目录的描述，均视为历史设计记录；以本状态说明为准

## 一、项目目标与 v1 范围

为 Sub-Store、Mihomo (Clash.Meta) 建立统一配置仓库。

**v1 范围（本文档）**：

- 设计基线：**仅 Mihomo**
- Sub-Store：**实验性兼容**——仅在其脚本运行环境支持 ES2018+（含负向后行断言）且满足输入契约（`config.proxies` 已展开）时可尝试复用覆写脚本；否则仅保留节点处理的功能脚本
- 通过 raw URL 直接引用覆写脚本和规则集
- 支持灵活添加自定义分流规则集（如 E-Hentai、Steam 等）

**v1 明确不做**：

- Loon / Quantumult X / Surge 适配（无目录骨架、无转换器、无 CI 产物）
- 运行时自动回退机制
- 通用跨平台抽象

**未来工作**（v2+ 视需求再开）：

- 跨平台规则格式转换
- 多平台覆写脚本

---

## 二、脚本职责划分

### 2.1 功能脚本（Sub-Store 专用）

只在 Sub-Store 中使用，用于节点本身的操作，不涉及策略组、分流、DNS：

- 节点重命名（统一命名格式）
- 节点过滤（去除过期/不可用节点）
- 节点去重、排序

### 2.2 覆写脚本（Mihomo 为主，Sub-Store 实验性兼容）

覆写脚本的设计基线是 Mihomo Party / Clash Verge Rev。Sub-Store 生成 mihomo 配置时兼容同一 `function main(config)` 签名，但 v1 的正则使用了 ES2018 负向后行断言，Sub-Store 在非 V8/Node 环境（如 iOS JSC）下可能不支持。因此 Sub-Store 复用属于**实验性兼容**——仅在运行环境满足 ES2018+ 且 `config.proxies` 已展开时可尝试。

**Sub-Store 运行环境兼容矩阵**：

| 部署方式 | JS 引擎 | ES2018 lookbehind | 兼容状态 |
| --------- | --------- | ------------------- | --------- |
| Docker / VPS（Node.js ≥ 10） | V8 | ✅ 支持 | 已验证 |
| Vercel / Cloudflare Workers | V8 | ✅ 支持 | 预期兼容，待验证 |
| iOS Loon / Surge（JSC） | JavaScriptCore | ❌ 不支持 | 不兼容 |
| iOS Quantumult X | JavaScriptCore | ❌ 不支持 | 不兼容（且 v1 不做适配） |

未列出的环境默认不承诺兼容。

v1 提供三个覆写入口，覆盖不同使用场景：

| 入口 | 职责 | 适用场景 |
| ------ | ------ | --------- |
| **`main.js`** | **Full-profile 覆写**：接管 DNS、端口、sniffer、geodata 等全部运行时字段 + 动态策略组 + 分流规则 | 从只有节点的裸订阅生成完整可用配置（最常用） |
| **`routing-only.js`**（设计预留） | **仅路由覆写**：只生成 proxy-groups、rule-providers、rules，不碰 DNS / 端口 / sniffer / geodata 等 | 已有完整基础配置，只想补上动态分组和分流规则 |
| **`dns-leak-fix.js`**（设计预留） | **仅 DNS 覆写**：只注入 DNS 防泄漏配置 | 已有完整配置，只想补 DNS 防泄漏 |

> `main.js` 是 full-profile 入口——它会强制覆写 dns、mixed-port、sniffer、geox-url 等运行时字段。这是有意为之：目标用户从裸订阅出发，需要一个脚本搞定一切。如果你已有自己的基础配置只想加上动态分组和分流，请使用 `routing-only.js`。

当前仓库实际发布的是 `main.js`；其余两个轻量入口在本文中保留为设计扩展方向。

三个入口共享 `scripts/override/lib/` 中的模块；其中运行时固定值已从 `definitions/mihomo-preset/*.yaml` 声明化，构建后生成 `scripts/config/mihomo-preset/*.js`，再由 `runtime-preset.js` 注入：

```javascript
// main.js（full-profile）
function main(config) {
  applyRuntimePreset(config); // 强制覆写 runtime YAML 中定义的运行时字段
  applyRouting(config);      // 动态策略组 + 分流规则
  return config;
}

// routing-only.js（仅路由）
function main(config) {
  applyRouting(config);      // 只动态策略组 + 分流规则，不碰其他字段
  return config;
}

// dns-leak-fix.js（仅 DNS）
function main(config) {
  applyDns(config);          // 只注入 DNS 防泄漏
  return config;
}
```

### 2.3 输入契约

```
需要动态策略组和分流规则的脚本（main.js / routing-only.js）要求：
  config.proxies 为已展开的节点数组，且至少包含一个可引用的节点名

仅 DNS 覆写的脚本（dns-leak-fix.js）无此要求。

✅ 合法输入：config.proxies = [{ name: "...", type: "...", ... }, ...]
❌ 不支持：仅有 proxy-providers 而 config.proxies 为空或不存在
```

**proxy-providers-only 输入的降级处理**：

如果检测到 `config.proxies` 为空或不存在，脚本**不尝试**从 proxy-providers 动态拉取节点（运行时无法 await 远程请求）。每个入口有独立的 unsupported-input 行为：

| 入口 | 空节点行为 | 理由 |
|------|-----------|------|
| **`main.js`** | 降级为 runtime-preset-only：应用完整运行时预设，跳过策略组/规则生成 | full-profile 入口应继续提供完整运行时模板；只有依赖节点的路由部分被跳过 |
| **`routing-only.js`** | 原样返回：打印诊断信息，不改写任何字段 | 纯路由入口，承诺不碰 DNS；降级不应偷偷引入 DNS 覆写 |
| **`dns-leak-fix.js`** | 正常执行：无论 proxies 是否存在都注入 DNS | 不依赖 proxies，无需降级 |

```javascript
// main.js 的空节点降级路径
const proxies = config.proxies || [];
const namedProxies = proxies.filter(p => typeof p?.name === "string" && p.name.length > 0);
applyRuntimePreset(config);

if (namedProxies.length === 0) {
  console.log("[override] ERROR: config.proxies 为空，无法生成策略组和分流规则");
  console.log("[override] 已应用 runtime preset，跳过 proxy-groups、rule-providers 和 rules 生成");
  return config;
}

// routing-only.js 的空节点降级路径
const proxies = config.proxies || [];
const namedProxies = proxies.filter(p => typeof p?.name === "string" && p.name.length > 0);
if (namedProxies.length === 0) {
  console.log("[override] ERROR: config.proxies 为空，无法生成策略组和分流规则");
  console.log("[override] routing-only 入口不碰 DNS 和运行时字段，原样返回");
  return config;  // 不改写任何字段
}
```

---

## 三、公开规则仓库选型

### 3.1 推荐方案：MetaCubeX/meta-rules-dat（明文 yaml 优先）

| 维度 | 说明 |
|------|------|
| 仓库 | MetaCubeX/meta-rules-dat |
| 状态 | 持续更新（最近更新 2026-04-09） |
| 规则分支 | **meta 分支**（明文 yaml），release 分支（二进制 mrs/dat） |
| v1 默认格式 | meta 分支 `.yaml` 明文（可读、可改、便于调试） |

**geox-url 与 rule-provider 分开管理**：

- `geox-url`（geoip.dat / geosite.dat / country.mmdb）→ **release 分支**（mihomo 全局 geodata 引擎，只有二进制格式）
- `rule-providers` → **meta 分支 yaml 明文**（具体业务分流规则，优先可读性）

### 3.2 已知缺失规则的处理

`meta-rules-dat` 历史上曾缺失过 `geosite:private`。截至 **2026-04-11**，`geosite/private.yaml` 与 `geoip/private.yaml` 已可直接使用。

**v1 当前处理方式：优先复用上游，不做运行时回退**。

只有在上游确实缺失、且短期内必须落地时，才在本仓库维护替代版本。不存在"远程优先 + 自动回退"的运行时机制——这种机制在 CI 构建时探活不等于用户运行时可达，且 mihomo rule-provider 本身没有 fallback URL 能力。

### 3.3 rule-provider URL 模式

```yaml
# MetaCubeX 远程规则（meta 分支 yaml 明文）
youtube:
  type: http
  behavior: domain
  format: yaml
  url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.yaml"
  path: ./ruleset/youtube.yaml
  interval: 86400

private:
  type: http
  behavior: domain
  format: yaml
  url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.yaml"
  path: ./ruleset/private.yaml
  interval: 86400

# 本仓库提供的规则（自定义 / 远程缺失替代）
e-hentai:
  type: http
  behavior: classical
  format: yaml
  url: "https://cdn.jsdelivr.net/gh/{OWNER}/proxy-config-hub@dist/assets/custom/e-hentai.yaml"
  path: ./ruleset/e-hentai.yaml
  interval: 86400
```

### 3.4 关于 format 与文件扩展名

- `format` 是 mihomo rule-provider 的配置字段，**只有 `yaml`、`text`、`mrs` 三种合法值**（[来源](https://wiki.metacubex.one/config/rule-providers/)）
- 文件扩展名可以是 `.yaml`、`.list`、`.txt`、`.mrs` 等，与 format 不一定相同
- 对应关系：`format: yaml` → 扩展名 `.yaml`；`format: text` → 扩展名 `.list` 或 `.txt`；`format: mrs` → 扩展名 `.mrs`
- v1 全部使用 `format: yaml`

---

## 四、策略组生成算法

### 4.1 Step 1：地区识别

**地区注册表是预定义的（可扩展），最终输出的分组集合由实际节点动态决定。**

识别策略：优先匹配 emoji 国旗（最可靠），其次中文全称，最后英文。短 token（如 HK、US）加边界约束避免误匹配。

地区注册表以声明式 YAML 维护在 `definitions/proxy-groups/regions.yaml`，构建时编译为 `scripts/config/proxy-groups/regions.js`，运行时由 `proxy-groups.js` 的 `compileRegionPatterns()` 将字符串正则编译为 `RegExp` 对象。新增地区只需在 YAML 中添加一条记录，无需修改 JS 代码。

```yaml
# definitions/proxy-groups/regions.yaml（示例）
- id: HK
  name: 香港
  icon: "🇭🇰"
  pattern: 🇭🇰|香港|(?<![A-Z])HK(?![A-Z])|Hong\s*Kong
  flags: i
- id: TW
  name: 台湾
  icon: "🇹🇼"
  pattern: 🇹🇼|🇨🇳.*台湾|台湾|(?<![A-Z])TW(?![A-Z])|Taiwan
  flags: i
# ... 完整列表见 definitions/proxy-groups/regions.yaml
```

**已知局限（v1）**：

- 地区识别是启发式的，依赖节点名称中包含地区信息。如果节点名称无地区标识（如纯 IP 或编号），该节点会归入"其他"
- 短 token 误匹配风险已通过边界断言 `(?<![A-Z])..(?![A-Z])` 缓解，但不能完全消除
- 正则中使用了 ES2018 负向后行断言 `(?<!...)`。Mihomo Party / Clash Verge Rev 的 JS 引擎（QuickJS / V8）支持此语法；但 Sub-Store 在非 V8/Node 环境（如 iOS JSC）下可能不支持，需替换为前向匹配方案
- 在 proxy-providers-only 输入下，此算法不工作（见 2.3 输入契约）

**分类规则**：

- 遍历节点，首个命中的 pattern 决定归属
- 0 节点的地区不生成分组（直接跳过，不用 DIRECT 占位）
- 未匹配任何 pattern 的节点归入隐含的 OTHER 集合（不单独建组，仅进入手动选择和自动选择）

### 4.2 Step 2：生成地区分组

```javascript
function buildRegionGroups(regionMap) {
  const groups = [];
  for (const region of REGION_PATTERNS) {
    const nodes = regionMap[region.id];
    if (!nodes || nodes.length === 0) continue;  // 空地区不生成
    groups.push({
      name: `${region.icon} ${region.name}`,
      type: "select",
      proxies: nodes.map(n => n.name)
    });
  }
  return groups;
}
```

### 4.3 Step 3：生成基础控制分组

```javascript
// 手动选择：包含所有节点
{ 
  name: "🔧 手动选择",
  type: "select",
  proxies: allProxyNames
}

// 自动选择：包含所有节点，自动测速
{
  name: "⚡ 自动选择",
  type: "url-test",
  proxies: allProxyNames,
  url: "http://www.gstatic.com/generate_204",
  interval: 300,
  tolerance: 50
}
```

**关于全量节点 url-test 的已知问题**：当节点数量很大（100+）时，全量 url-test 会产生较高的测速流量。v1 先保持此设计（简单且普遍），如果实际使用中发现性能问题，可在 v2 中优化为：按地区分组各自 url-test + 顶层 fallback，或引入 `filter` 过滤掉高倍率节点。

### 4.4 Step 4：生成代理选择分组

```javascript
{
  name: "🚀 代理选择",
  type: "select",
  proxies: [...regionGroupNames, "🔧 手动选择", "⚡ 自动选择", "DIRECT"]
}
```

### 4.5 Step 5：生成业务分流分组

所有业务分组引用相同的选项集，**绝不直接包含节点名称**：

```javascript
const BUSINESS_PROXIES = ["🚀 代理选择", ...regionGroupNames, "🔧 手动选择", "⚡ 自动选择", "DIRECT"];

// mode: "full" → proxies = BUSINESS_PROXIES（首项为 🚀 代理选择，select 组默认跟随全局入口）
{ name: "🤖 AI 服务", type: "select", proxies: BUSINESS_PROXIES }
{ name: "📹 油管视频", type: "select", proxies: BUSINESS_PROXIES }

// mode: "direct" → 默认直连
{ name: "🔒 国内服务", type: "select", proxies: ["DIRECT", "🚀 代理选择"] }

// mode: "reject" → 广告拦截
{ name: "🛑 广告拦截", type: "select", proxies: ["REJECT", "DIRECT"] }
```

### 4.6 最终 proxy-groups 输出顺序

```yaml
proxy-groups:
  # 1. 代理选择（顶层入口）
  - { name: "🚀 代理选择", type: select, proxies: ["🇭🇰 香港", ..., "🔧 手动选择", "⚡ 自动选择", "DIRECT"] }
  # 2. 基础控制组
  - { name: "🔧 手动选择", type: select, proxies: ["<全部节点>"] }
  - { name: "⚡ 自动选择", type: url-test, proxies: ["<全部节点>"] }
  # 3. 地区分组（仅非空）
  - { name: "🇭🇰 香港", type: select, proxies: ["<香港节点>"] }
  - { name: "🇯🇵 日本", type: select, proxies: ["<日本节点>"] }
  # ...
  # 4. 业务分流组
  - { name: "🤖 AI 服务", type: select, proxies: ["🚀 代理选择", 地区组..., "🔧 手动选择", "⚡ 自动选择", "DIRECT"] }
  # ...
  # 5. 特殊组
  - { name: "🛑 广告拦截", type: select, proxies: ["REJECT", "DIRECT"] }
  - { name: "🔒 国内服务", type: select, proxies: ["DIRECT", "🚀 代理选择"] }
  - { name: "🐟 漏网之鱼", type: select, proxies: [同业务组] }
```

### 4.7 校验规则

**构建时校验（CI / tools/validate.js）**：

1. sources.yaml 中所有 source 的 `id` 全局唯一（否则 providers 会被覆盖）
2. 正向引用：每条 source 的 `target_group` 必须在 GROUP_DEFINITIONS 中已注册
3. 反向覆盖：GROUP_DEFINITIONS 中由 RULE-SET 驱动的组（除 fallback 外）必须在 sources.yaml 中至少被一条 source 引用——防止新增业务组后忘记添加规则源
4. custom 目录下的 `.yaml` 文件 payload 语法合法
5. 远程 URL 可达性检查（HEAD 请求，不可达时报警但不阻断构建——这是第三方依赖，用户运行时自行承担）

**运行时校验（覆写脚本 validate 函数）**：

1. 空节点防护：`config.proxies` 为空则走各入口对应的降级路径（见 2.3）
2. 空地区组不生成
3. 引用完整性：所有 RULE-SET 引用的策略组名必须存在于 proxy-groups
4. 业务组纯净性：业务分流组的 proxies 中不允许出现具体节点名

---

## 五、业务分组与规则注册表

### 5.1 业务分组定义表（group-definitions.js）

v1 只定义有实际规则源支撑的最小集合。`mode` 含义：

- `"full"`：proxies = 地区组 + 代理选择 + 手动选择 + 自动选择 + DIRECT
- `"direct"`：proxies = DIRECT + 代理选择
- `"reject"`：proxies = REJECT + DIRECT

实现中额外带有 `category` 字段，用于区分 `special` / `business` / `fallback` 三类分组并驱动最终输出顺序；该字段不参与 rule-provider 绑定，只服务于组装顺序。

```javascript
// v1 只定义有实际规则源支撑的最小集合
// 由 RULE-SET 驱动的组（非 fallback）必须在 sources.yaml 中至少有一条 source 指向它
// fallback 组由最终 MATCH 规则自动引用，不受此约束
const GROUP_DEFINITIONS = {
  // 特殊分组
  ad_block:       { name: "🛑 广告拦截",   mode: "reject", category: "special" },
  private:        { name: "🏠 私有网络",   mode: "direct", category: "special" },
  cn_service:     { name: "🔒 国内服务",   mode: "direct", category: "special" },
  fallback:       { name: "🐟 漏网之鱼",   mode: "full", category: "fallback" },

  // 业务分流分组（均为 mode: "full"，每组在 sources.yaml 中有 ≥1 条规则源）
  //  常用服务
  ai_service:     { name: "🤖 AI 服务",    mode: "full", category: "business" },
  youtube:        { name: "📹 油管视频",    mode: "full", category: "business" },
  google:         { name: "🔍 谷歌服务",    mode: "full", category: "business" },
  microsoft:      { name: "Ⓜ️ 微软服务",   mode: "full", category: "business" },
  apple:          { name: "🍏 苹果服务",    mode: "full", category: "business" },
  //  社交通讯
  telegram:       { name: "📲 电报消息",    mode: "full", category: "business" },
  twitter:        { name: "🐦 推特/X",     mode: "full", category: "business" },
  meta_social:    { name: "📘 Meta 系",    mode: "full", category: "business" },
  discord:        { name: "🎙️ Discord",   mode: "full", category: "business" },
  social_other:   { name: "💬 其他社交",    mode: "full", category: "business" },
  //  流媒体
  netflix:        { name: "🎬 奈飞",       mode: "full", category: "business" },
  disney:         { name: "🏰 迪士尼+",    mode: "full", category: "business" },
  //  游戏平台
  steam:          { name: "🎮 Steam",     mode: "full", category: "business" },
  game_pc:        { name: "🖥️ PC 游戏",   mode: "full", category: "business" },
  //  技术服务
  code_hosting:   { name: "🐱 代码托管",    mode: "full", category: "business" },
  cloud:          { name: "☁️ 云服务",     mode: "full", category: "business" },
  dev_tools:      { name: "🛠️ 开发工具",   mode: "full", category: "business" },
  //  其他
  education:      { name: "📚 教育学术",    mode: "full", category: "business" },
  non_cn:         { name: "🌍 非中国",     mode: "full", category: "business" },
};
// v2+ 按需扩展：streaming_west, streaming_asia, game_console, storage, payment, crypto, news, shopping
```

> 如果后续发现 mode 三值模型不够用（如某个组需要特殊的 allowed_targets），升级为 `{ allowed_targets: [...], default_target: "..." }` 结构。v1 不做此抽象。

### 5.2 规则源注册表（sources.yaml）

sources.yaml 是**单一有序列表**，声明顺序即规则匹配顺序。不使用全局 order 号段。

每条 source 的 schema：

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 全局唯一，同时用作 rule-provider key |
| `source_kind` | 是 | `geosite` / `geoip` / `custom` / `provided` |
| `behavior` | 是 | `domain` / `ipcidr` / `classical` |
| `format` | 是 | `yaml` / `text` / `mrs`（mihomo 合法值，v1 全部 yaml） |
| `url` | 是 | 完整 URL |
| `target_group` | 是 | GROUP_DEFINITIONS 中的稳定 id |
| `no_resolve` | 否 | 默认 false |

```yaml
# rules/sources.yaml
# 声明顺序 = 规则匹配顺序（从上到下，先匹配先生效）
# 所有 URL 为完整路径
# MetaCubeX geosite 基础路径: https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/{name}.yaml
# MetaCubeX geoip 基础路径:   https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/{name}.yaml

sources:
  # ── 广告拦截 ──
  - id: category-ads-all
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ads-all.yaml"
    target_group: ad_block

  # ── AI 服务 ──
  - id: category-ai-chat-!cn
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-chat-!cn.yaml"
    target_group: ai_service
  - id: openai
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/openai.yaml"
    target_group: ai_service
  - id: anthropic
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/anthropic.yaml"
    target_group: ai_service

  # ── 视频 ──
  - id: youtube
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.yaml"
    target_group: youtube

  # ── 教育 ──
  - id: category-scholar-!cn
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-scholar-!cn.yaml"
    target_group: education

  # ── 云服务 ──
  - id: aws
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/aws.yaml"
    target_group: cloud
  - id: azure
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/azure.yaml"
    target_group: cloud
  - id: cloudflare
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cloudflare.yaml"
    target_group: cloud

  # ── 谷歌 ──
  - id: google
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.yaml"
    target_group: google
  - id: google-ip
    source_kind: geoip
    behavior: ipcidr
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/google.yaml"
    target_group: google
    no_resolve: true

  # ── 私有网络 ──
  - id: private
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.yaml"
    target_group: private
  - id: private-ip
    source_kind: geoip
    behavior: ipcidr
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/private.yaml"
    target_group: private
    no_resolve: true

  # ── 国内服务 ──
  - id: geolocation-cn
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-cn.yaml"
    target_group: cn_service
  - id: cn-ip
    source_kind: geoip
    behavior: ipcidr
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.yaml"
    target_group: cn_service
    no_resolve: true

  # ── 电报 ──
  - id: telegram
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.yaml"
    target_group: telegram
  - id: telegram-ip
    source_kind: geoip
    behavior: ipcidr
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.yaml"
    target_group: telegram
    no_resolve: true

  # ── 代码托管 ──
  - id: github
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.yaml"
    target_group: code_hosting

  # ── 微软 ──
  - id: microsoft
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft.yaml"
    target_group: microsoft

  # ── 苹果 ──
  - id: apple
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple.yaml"
    target_group: apple

  # ── 推特 ──
  - id: twitter
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/twitter.yaml"
    target_group: twitter
  - id: twitter-ip
    source_kind: geoip
    behavior: ipcidr
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/twitter.yaml"
    target_group: twitter
    no_resolve: true

  # ── Meta 系 ──
  - id: facebook
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/facebook.yaml"
    target_group: meta_social
  - id: instagram
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/instagram.yaml"
    target_group: meta_social

  # ── Discord ──
  - id: discord
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/discord.yaml"
    target_group: discord

  # ── 其他社交 ──
  - id: reddit
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/reddit.yaml"
    target_group: social_other
  - id: tiktok
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.yaml"
    target_group: social_other

  # ── 流媒体 ──
  - id: netflix
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.yaml"
    target_group: netflix
  - id: netflix-ip
    source_kind: geoip
    behavior: ipcidr
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/netflix.yaml"
    target_group: netflix
    no_resolve: true
  - id: disney
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/disney.yaml"
    target_group: disney

  # ── 游戏 ──
  - id: steam
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/steam.yaml"
    target_group: steam
  - id: epicgames
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/epicgames.yaml"
    target_group: game_pc

  # ── 开发工具 ──
  - id: docker
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/docker.yaml"
    target_group: dev_tools

  # ── 非中国兜底 ──
  - id: geolocation-!cn
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.yaml"
    target_group: non_cn

  # ── 国内兜底（cn geosite 放在 non_cn 之后） ──
  - id: cn
    source_kind: geosite
    behavior: domain
    format: yaml
    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.yaml"
    target_group: cn_service

  # ── 自定义规则（用户维护，插在需要的位置） ──
  - id: e-hentai
    source_kind: custom
    behavior: classical
    format: yaml
    url: "https://cdn.jsdelivr.net/gh/{OWNER}/proxy-config-hub@dist/assets/custom/e-hentai.yaml"
    target_group: non_cn

  # (完整列表见 clash-config-example.yaml 对应的所有服务)
  # 最终 rules 以 MATCH,🐟 漏网之鱼 结尾（脚本自动追加）
```

**排序说明**：

- 声明顺序 = 规则匹配顺序，所见即所得
- 新增规则直接插入 YAML 列表的对应位置即可，不需要分配号段
- 同一 target_group 的多条 source 可以分散在列表各处（如 cn_service 的 geolocation-cn 在中部、cn 在末尾），由声明位置决定匹配先后
- 如果两条 source 的位置有歧义，CI 不会报错（因为声明顺序是显式的），但维护者应自行确认顺序意图

### 5.3 规则生成逻辑

```javascript
// 文件扩展名映射（format 是 mihomo 字段，扩展名是实际文件名）
const FORMAT_TO_EXT = { yaml: "yaml", text: "list", mrs: "mrs" };

function buildRuleProviders(groupDefs) {
  const providers = {};
  const rules = [];
  const seenIds = new Set();

  // 遍历顺序 = 声明顺序 = 规则匹配顺序
  for (const source of SOURCES_DATA) {
    // 校验 id 唯一性
    if (seenIds.has(source.id)) {
      throw new Error(`Duplicate source id: ${source.id}`);
    }
    seenIds.add(source.id);

    // 校验 target_group 已注册
    const groupName = groupDefs[source.target_group]?.name;
    if (!groupName) {
      throw new Error(`Unknown target_group: ${source.target_group} (source: ${source.id})`);
    }

    // 注册 rule-provider（缓存路径使用真实文件扩展名）
    const ext = FORMAT_TO_EXT[source.format] || source.format;
    providers[source.id] = {
      type: "http",
      behavior: source.behavior,
      url: source.url,
      path: `./ruleset/${source.id}.${ext}`,
      format: source.format,
      interval: 86400
    };

    // 生成 rule（顺序由遍历顺序保证）
    rules.push(source.no_resolve
      ? `RULE-SET,${source.id},${groupName},no-resolve`
      : `RULE-SET,${source.id},${groupName}`
    );
  }

  // 追加 MATCH 兜底
  rules.push(`MATCH,${groupDefs.fallback.name}`);
  return { providers, rules };
}
```

---

## 六、基础配置与 DNS

### 6.1 架构：按需选入口，对内模块化

当前仓库公开主入口是 `main.js`；如果后续补齐轻量入口，它们也会复用同一套 runtime source pipeline。运行时固定值现在以 YAML 声明在 `definitions/mihomo-preset/` 下，构建后生成 `scripts/config/mihomo-preset/`，运行时只保留注入逻辑：

```
definitions/mihomo-preset/
├── base.yaml
├── dns.yaml
├── geodata.yaml
├── profile.yaml
├── sniffer.yaml
└── tun.yaml

scripts/config/mihomo-preset/
├── base.js
├── dns.js
├── geodata.js
├── profile.js
├── sniffer.js
└── tun.js

scripts/override/lib/
├── utils.js               # 共享工具（cloneData）
├── runtime-preset.js      # 注入运行时预设
├── proxy-groups.js        # 地区识别、节点分类、策略组生成（区域/占位符从 YAML 加载）
├── rule-assembly.js       # rule-providers + rules 组装（导出 extractRuleTarget）
├── proxy-chains.js        # 链式代理（chains.yaml 驱动）：构建 chain_group / transit_group，并为落地节点注入 dialer-proxy
└── validate-output.js     # 输出校验（引用 extractRuleTarget）
```

构建时由 `tools/yaml-to-js.js` 先把 YAML 编译为 `scripts/config/` 下的 JS 模块，再由 `build.js` 打包覆写入口，产出自包含脚本。

设计上保留两个轻量替代入口：`routing-only.js` **只生成动态策略组和分流规则**，不碰 DNS / 端口 / sniffer / geodata 等运行时字段，适用于已有完整基础配置只想补上分组和规则的场景；`dns-leak-fix.js` **只注入 DNS 防泄漏配置**，不生成策略组和分流规则，适用于已有完整配置只想补 DNS 的场景。

### 6.2 字段处理策略（按入口分级）

| 策略 | 字段 | main.js | routing-only.js | dns-leak-fix.js |
|------|------|---------|-----------------|-----------------|
| **强制覆写** | proxy-groups, rule-providers, rules | ✅ | ✅ | — |
| **强制覆写** | dns | ✅ | — | ✅ |
| **强制覆写** | mixed-port, mode, log-level, unified-delay, tcp-concurrent, find-process-mode, profile, sniffer, geodata-mode, geo-auto-update, geodata-loader, geo-update-interval, geox-url | ✅ | — | — |
| **保留上游** | proxies | ✅ | ✅ | ✅ |
| **保留上游** | proxy-providers | ✅ | ✅ | ✅ |
| **缺失时注入** | allow-lan (false), tun (enable: false) | ✅ | — | — |

### 6.3 运行时源数据（definitions/mihomo-preset）

运行时固定值已经拆成 6 份 YAML 源文件：

```text
definitions/mihomo-preset/
├── base.yaml      # mixed-port / mode / log-level / tcp-concurrent / find-process-mode
├── profile.yaml   # profile.store-selected / profile.store-fake-ip
├── geodata.yaml   # geodata-mode / geo-auto-update / geodata-loader / geox-url
├── dns.yaml       # 完整 DNS 防泄漏配置
├── sniffer.yaml   # 协议嗅探配置
└── tun.yaml       # 缺失时注入的默认 tun 配置
```

构建后这些 YAML 会被编译成 `scripts/config/mihomo-preset/*.js`，由 `applyRuntimePreset()` 统一消费。

### 6.4 DNS 预设（definitions/mihomo-preset/dns.yaml）

`dns.yaml` 是 DNS 防泄漏的声明式来源。当前结构示意如下：

```yaml
enable: true
listen: "127.0.0.1:5335"
enhanced-mode: fake-ip
fake-ip-range: 198.18.0.1/16

default-nameserver:
  - 180.76.76.76
  - 182.254.118.118
  - 119.29.29.29
  - 223.5.5.5

nameserver:
  - 180.76.76.76
  - 119.29.29.29
  - 180.184.1.1
  - 223.5.5.5
  - https://223.6.6.6/dns-query#h3=true
  - https://dns.alidns.com/dns-query
  - https://doh.pub/dns-query

fallback:
  - https://000000.dns.nextdns.io/dns-query#h3=true
  - https://public.dns.iij.jp/dns-query
  - https://101.101.101.101/dns-query
  - https://208.67.220.220/dns-query
  - tls://8.8.4.4
  - tls://1.0.0.1:853
  - https://cloudflare-dns.com/dns-query
  - https://dns.google/dns-query

fallback-filter:
  geoip: true
  geoip-code: CN
```

### 6.5 覆写脚本主函数（main.js）

```javascript
// main.js — full-profile 入口
function main(config) {
  // ── 先应用 runtime preset ──
  applyRuntimePreset(config);

  // ── 输入契约检查（无节点时仅跳过路由部分） ──
  const proxies = config.proxies || [];
  const namedProxies = proxies.filter(p => typeof p?.name === "string" && p.name.length > 0);
  if (namedProxies.length === 0) {
    console.log("[override] ERROR: config.proxies 为空，无法生成策略组和分流规则");
    console.log("[override] 已应用 runtime preset，跳过 proxy-groups、rule-providers 和 rules 生成");
    return config;
  }

  // ── 动态策略组生成 ──
  const allProxyNames = namedProxies.map(p => p.name);
  const regionMap = classifyProxies(namedProxies);
  const regionGroups = buildRegionGroups(regionMap);
  const regionGroupNames = regionGroups.map(g => g.name);
  const controlGroups = buildControlGroups(allProxyNames);
  const proxySelect = buildProxySelect(regionGroupNames);
  const businessGroups = buildBusinessGroups(regionGroupNames, GROUP_DEFINITIONS);

  config["proxy-groups"] = [proxySelect, ...controlGroups, ...regionGroups, ...businessGroups];

  // ── 规则生成 ──
  const { providers, rules } = buildRuleProviders(GROUP_DEFINITIONS);
  config["rule-providers"] = providers;
  config.rules = rules;

  // ── 运行时校验 ──
  validate(config);

  return config;
}

// routing-only.js — 纯路由入口
function main(config) {
  // ── 输入契约检查（routing-only 不碰 DNS，原样返回） ──
  const proxies = config.proxies || [];
  const namedProxies = proxies.filter(p => typeof p?.name === "string" && p.name.length > 0);
  if (namedProxies.length === 0) {
    console.log("[override] ERROR: config.proxies 为空，无法生成策略组和分流规则");
    console.log("[override] routing-only 入口不碰 DNS 和运行时字段，原样返回");
    return config;  // 不改写任何字段
  }

  // ── 动态策略组生成（同 main.js） ──
  const allProxyNames = namedProxies.map(p => p.name);
  const regionMap = classifyProxies(namedProxies);
  const regionGroups = buildRegionGroups(regionMap);
  const regionGroupNames = regionGroups.map(g => g.name);
  const controlGroups = buildControlGroups(allProxyNames);
  const proxySelect = buildProxySelect(regionGroupNames);
  const businessGroups = buildBusinessGroups(regionGroupNames, GROUP_DEFINITIONS);

  config["proxy-groups"] = [proxySelect, ...controlGroups, ...regionGroups, ...businessGroups];

  // ── 规则生成 ──
  const { providers, rules } = buildRuleProviders(GROUP_DEFINITIONS);
  config["rule-providers"] = providers;
  config.rules = rules;

  // ── 运行时校验 ──
  validate(config);

  return config;
}
```

---

## 七、仓库目录结构

```
proxy-config-hub/
│
├── README.md                             # 仓库说明、快速上手、URL 引用指南
│
├── scripts/
│   ├── override/                         # 覆写脚本（Mihomo 为主）
│   │   ├── main.js                       # Full-profile 覆写入口
│   │   └── lib/                          # runtime preset / proxy-groups / rule-assembly / validate-output
│   │
│   ├── sub-store/                        # 功能脚本（Sub-Store 专用）
│   │   └── rename.js
│   │
│   └── config/
│       ├── mihomo-preset/                # 从 definitions/mihomo-preset/ 生成
│       ├── proxy-groups/                 # 从 definitions/proxy-groups/ 生成
│       └── rules/                        # 从 definitions/rules/ 生成
│
├── definitions/
│   ├── mihomo-preset/                    # Mihomo 顶层键预设 YAML（base/dns/sniffer/tun/profile/geodata）
│   ├── proxy-groups/                     # 策略组与链式代理构建数据 YAML（groupDefinitions/regions/placeholders/chains）
│   ├── rules/                            # 活跃规则装配 YAML（inlineRules/ruleProviders）
│   └── assets/
│       └── custom/                       # 自定义规则模板/资源（仅复制到 dist）
│
├── templates/
│   └── mihomo/
│       └── config-example.yaml           # 覆写后的预期产物示例
│
├── tools/
│   ├── lib/
│   │   ├── fs-helpers.js                 # 共享文件系统工具
│   │   ├── paths.js                      # 路径常量、命名空间配置、资产映射表
│   │   └── bundle-runtime.js             # Bundle 加载/执行/模板处理
│   ├── yaml-to-js.js                     # 将 definitions/ 编译为 scripts/config/
│   ├── generate-example-config.js        # 生成完整示例配置
│   ├── check-rule-overlap.js             # 规则重叠检测
│   └── verify-main.js                    # 打包/运行时校验（动态发现产物）
│
└── .github/
    └── workflows/
        └── build-dist.yml                # 构建 → 验证 → 推送 dist 分支
```

### 7.1 构建产物（dist 分支）

```
dist/
├── scripts/
│   ├── override/
│   │   └── main.js                       # 已内联配置与依赖的自包含脚本
│   └── sub-store/
│       └── rename.js
└── assets/
    └── custom/
        └── _template.yaml
```

### 7.2 用户引用 URL

```
# 覆写脚本 — Full-profile（Mihomo Party / Clash Verge / Sub-Store）
https://cdn.jsdelivr.net/gh/{OWNER}/proxy-config-hub@dist/scripts/override/main.js

# 功能脚本（Sub-Store 节点操作）
https://cdn.jsdelivr.net/gh/{OWNER}/proxy-config-hub@dist/scripts/sub-store/rename.js

# 自定义规则集
https://cdn.jsdelivr.net/gh/{OWNER}/proxy-config-hub@dist/assets/custom/<文件名>
```

---

## 八、CI/CD 流程

```
push to main
  └─→ .github/workflows/build-dist.yml
        ├─ validate:
        │   ├─ npm run build
        │   ├─ npm run verify
        │   └─ 生成 scripts/config/mihomo-preset/*.js、proxy-groups/*.js 与 rules/*.js
        ├─ bundle:
        │   ├─ esbuild 打包 scripts/override/main.js
        │   ├─ 复制 scripts/sub-store/*.js
        │   └─ 复制 definitions/assets/custom/* → dist/assets/custom/
        └─ deploy: 推送 dist 分支
```

**关于规则的运行时依赖**：rule-provider 中指向 MetaCubeX 的 URL 是运行时第三方依赖——mihomo 在运行时直接从该 URL 拉取规则。本仓库不对第三方 URL 的运行时可用性负责。如果需要完全收口交付面，未来可在 CI 中同步远程规则到本仓库 dist 分支，使所有 URL 都指向自己控制的 CDN。v1 不做此优化。

---

## 九、自定义规则集模板

```yaml
# Source: definitions/assets/custom/_template.yaml
# Published as: dist/assets/custom/_template.yaml
#   (referenced via raw.githubusercontent.com/<owner>/<repo>/dist/assets/custom/<filename>)
#
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

---

## 十、v1 保留的设计决策与理由

| 决策 | 理由 |
|------|------|
| 稳定 ID 层（GROUP_DEFINITIONS + target_group） | 避免策略组名漂移，支持重命名而不影响 sources.yaml |
| 业务组不直接挂节点 | 新增/删除节点只影响地区组和控制组，业务组零维护 |
| definitions/mihomo-preset + scripts/config/mihomo-preset | 运行时固定值声明化，编辑源数据而不是手改脚本常量 |
| 三入口分级（main / routing-only / dns-leak-fix） | main.js 是 full-profile 一键搞定；routing-only.js 只管分组和规则不碰运行时模板；dns-leak-fix.js 最轻量只补 DNS。用户按需选一个 URL |
| 声明顺序 = 规则顺序 | 所见即所得，不需要心算号段或 phase 映射 |
| mode: full/direct/reject 三值 | v1 最小模型，覆盖所有已知场景；不够用时升级为 allowed_targets |

---

## 十一、建议实施顺序

1. **声明式源数据 + 核心模块**：先落地 `definitions/mihomo-preset/*.yaml`、`definitions/proxy-groups/*.yaml`、`definitions/rules/*.yaml`、`runtime-preset.js`、`proxy-groups.js` 和规则装配器，这是所有入口的共享基础
2. **`rule-builder.js` + `validator.js`**：规则生成和校验逻辑，可独立单测
3. **`main.js` 覆写入口**：先保证 full-profile 主链路稳定，再视需要拆分轻量入口
4. **构建链**：`tools/yaml-to-js.js` + `build.js`，先编译声明式源数据，再打包发布脚本
5. **CI/CD**：`build-dist.yml` 负责构建、验证和发布 dist 分支
6. **功能脚本**（Sub-Store 节点操作）：当前为 `rename.js`，与覆写脚本独立维护
