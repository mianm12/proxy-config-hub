# proxy-config-hub v2 配置设计

> 本文描述 v2 已实现的人类配置格式和装配语义；真实装配入口为 `config/manifest.yaml`。

## 1. 配置原则

1. YAML 是唯一人工配置格式。
2. `config/manifest.yaml` 是唯一装配入口。
3. 业务配置按领域纵向组织，组与其规则放在一起。
4. 展示顺序与匹配顺序分别显式声明。
5. 常见重复由有限模板消除，不使用通用继承或隐式 deep merge。
6. 项目 DSL 严格校验，原生 Mihomo 前向兼容字段放入显式 `mihomo` 区。
7. 所有引用使用稳定 ID，不引用中文显示名。
8. 声明顺序只有在 schema 明确说明时才具备业务语义。
9. 配置不得包含 secret、token、密码或私有 URL 凭据。
10. 构建错误必须包含文件、行、列和字段路径。

## 2. 目录结构

```text
config/
├── manifest.yaml
├── runtime/
│   ├── base.yaml
│   ├── dns.yaml
│   ├── sniffer.yaml
│   └── tun.yaml
├── nodes/
│   ├── catalog.yaml
│   ├── routing-regions.yaml
│   └── chains.yaml
├── routing/
│   ├── group-templates.yaml
│   ├── provider-sources.yaml
│   └── modules/
│       ├── system.yaml
│       ├── core.yaml
│       ├── ai.yaml
│       ├── education.yaml
│       ├── social.yaml
│       ├── media.yaml
│       ├── gaming.yaml
│       ├── developer.yaml
│       ├── cloud.yaml
│       ├── commerce.yaml
│       └── regional.yaml
└── rename/
    └── profiles.yaml

public/
└── rules/
    └── _template.yaml
```

模块名称以实际内容为准，目标是约 10–12 个领域模块；不要求严格采用示例中的十个文件名。

## 3. ID 与文件命名

- 领域 ID：延续当前 `snake_case`，例如 `ai_service`、`proxy_select`。
- provider ID：允许上游常见的 kebab 名，例如 `category-ai-chat-!cn`，但必须全局唯一。
- module/block/source/template ID：使用 `snake_case`。
- YAML 文件：使用 `kebab-case.yaml`。
- 显示名：允许中文、emoji 和空格。
- ID 一旦进入规则引用或用户选中状态，应视为稳定契约；显示名可以单独迁移。

## 4. 根 manifest

示意：

```yaml
schema-version: 2

runtime:
  - source: runtime/base.yaml
    target: root
    apply: overlay
  - source: runtime/dns.yaml
    target: dns
    apply: replace
  - source: runtime/sniffer.yaml
    target: sniffer
    apply: replace
  - source: runtime/tun.yaml
    target: tun
    apply: if-absent
  - value: false
    target: allow-lan
    apply: if-absent

nodes:
  catalog: nodes/catalog.yaml
  routing-regions: nodes/routing-regions.yaml
  chains: nodes/chains.yaml

routing:
  group-templates: routing/group-templates.yaml
  provider-sources: routing/provider-sources.yaml
  modules:
    - routing/modules/system.yaml
    - routing/modules/core.yaml
    - routing/modules/ai.yaml
    - routing/modules/education.yaml
    - routing/modules/social.yaml
    - routing/modules/media.yaml
    - routing/modules/gaming.yaml
    - routing/modules/developer.yaml
    - routing/modules/cloud.yaml
    - routing/modules/commerce.yaml
    - routing/modules/regional.yaml

  group-layout:
    - group: proxy_select
    - group: manual_select
    - group: auto_select
    - generated: chain_groups
    - generated: transit_groups
    - group: ad_block
    - group: private
    - group: cn_service
    - group: non_cn
    - group: ai_service
    - group: youtube
    - group: google
    - group: microsoft
    - group: apple
    - group: telegram
    - group: code_hosting
    - group: twitter
    - group: meta_social
    - group: discord
    - group: social_other
    - group: netflix
    - group: disney_plus
    - group: western_streaming
    - group: asia_streaming
    - group: steam
    - group: game_pc
    - group: game_console
    - group: cloud_service
    - group: developer_tools
    - group: storage_service
    - group: payment
    - group: encryption
    - group: education
    - group: news
    - group: shopping
    - generated: region_groups
    - group: fallback

  rule-pipeline:
    - { module: core, block: ads }
    - { module: core, block: private }
    - { module: ai, block: services }
    - { module: media, block: youtube }
    - { module: education, block: services }
    - { module: social, block: telegram }
    - { module: social, block: twitter }
    - { module: social, block: meta }
    - { module: social, block: discord }
    - { module: social, block: other }
    - { module: media, block: netflix }
    - { module: media, block: disney }
    - { module: media, block: western }
    - { module: media, block: asia }
    - module: gaming
    - { module: media, block: news }
    - { module: cloud, block: google }
    - { module: cloud, block: apple }
    - module: developer
    - { module: commerce, block: payments }
    - { module: commerce, block: encryption }
    - { module: cloud, block: cloud_services }
    - { module: cloud, block: microsoft }
    - { module: commerce, block: shopping }
    - module: regional
    - fallback: fallback

rename:
  profiles: rename/profiles.yaml

deployment:
  channel: v2
  public-base-url: null # 可由 CI PUBLIC_BASE_URL 注入
```

### 4.1 manifest 校验

- `schema-version` 必须是编译器支持的精确版本。
- 所有 source 路径必须位于 `config/` 内，不允许 `..` 越界。
- modules 必须显式列出；禁止目录自动扫描后静默加入模块。
- runtime item 必须在 `source` 与 `value` 中二选一；`value` 用于 `allow-lan` 这类单值默认项。
- 每个已启用策略组必须在 `group-layout` 中精确出现一次，除非声明为 hidden。
- 每个 rule block 必须在 `rule-pipeline` 中精确出现一次。
- `fallback` 只能出现一次并位于流水线末尾。
- 生成段 `chain_groups`、`transit_groups`、`region_groups` 最多各出现一次。
- module 展开顺序等于模块内部声明顺序；编译器不得隐式重排。

### 4.2 精细 pipeline 引用

只有模块的全部 rule blocks 在最终顺序中连续时，才使用 `{ module: cloud }` 展开。当前规则存在跨模块交错，因此 manifest 对关键阶段直接引用 block：

```yaml
rule-pipeline:
  - module: cloud
    block: specific_services
  - module: commerce
    block: payments
  - module: cloud
    block: broad_vendors
```

编译器仍要求每个 block 精确出现一次，避免重复或遗漏。

## 5. Runtime 配置

`runtime/*.yaml` 尽量保持 Mihomo 原生形状，便于直接对照官方文档。

### 5.1 apply 语义

| apply | 语义 |
|---|---|
| `overlay` | 将 source 根键浅覆盖到目标；不递归 deep merge |
| `replace` | 用 source 完整替换 target |
| `if-absent` | 只有 target 为 `undefined` 时写入 |

首期等价映射：

- base/profile/geodata 顶层键合并进 `runtime/base.yaml`，使用 root overlay。
- DNS 使用 replace。
- sniffer 使用 replace。
- TUN 使用 if-absent。
- `allow-lan: false` 作为 manifest 单值 item，目标为 `allow-lan`，使用 `if-absent`；不得用 truthy/falsy 判断替代 undefined 判断。
- `proxies`、`proxy-groups`、`rule-providers`、`rules` 由运行时装配器独占，runtime source 和 target 均不得声明这些键。

### 5.2 不支持通用 deep merge

复杂 deep merge 很难判断数组是覆盖、追加还是去重。若某段需要部分保留，应拆成明确模块或为该字段设计专用语义，而不是引入全局 merge 魔法。

## 6. 节点目录

### 6.1 catalog.yaml

catalog 是 rename 与 override 的共享地区/别名真相源。

当前首期 catalog 只重建仓库 v1 override 已使用的 27 个地区及两个真实 rename fixture 所需行为。旧 rename 脚本中来源与许可证无法确认的四套平行国家数组没有复制；以后扩展地区时应从可确认许可的标准来源逐项加入并补测试。

```yaml
regions:
  - id: HK
    name: 香港
    emoji: "🇭🇰"
    codes: [HK]
    names:
      zh: [香港]
      en: [Hong Kong, HongKong]
    aliases: [港, Hongkong]
    cities: []

  - id: US
    name: 美国
    emoji: "🇺🇸"
    codes: [US, USA]
    names:
      zh: [美国]
      en: [United States]
    aliases: [美]
    cities: [Los Angeles, San Jose, Seattle, New York]
```

识别优先级由代码固定，catalog 只声明事实，不通过数组位置控制优先级。

约束：

- region ID 全局唯一。
- emoji、code 和规范名称冲突为构建错误。
- alias/city 冲突允许存在，但必须能由固定优先级解决，并产生可审阅诊断。
- 英文短 code 默认使用字母边界匹配，不再要求配置作者手写负向后行断言。
- `OTHER` 是编译器内置 fallback ID，不能被普通条目重定义。

### 6.2 routing-regions.yaml

catalog 可以识别大量地区；routing 只为实际需要的地区生成策略组。

```yaml
regions:
  - id: HK
    group-name: "🇭🇰 香港"
    type: select
  - id: TW
    group-name: "🇹🇼 台湾"
    type: select
  - id: JP
    group-name: "🇯🇵 日本"
    type: select
  - id: OTHER
    group-name: "🏳️ 其他"
    type: select
```

声明顺序等于地区组展示顺序，但不影响地区识别结果。

### 6.3 chains.yaml

首期一跳链路示意：

```yaml
chains:
  - id: default_chain
    transit:
      id: transit
      group-name: "🔀 中转"
      type: select
      selector:
        any-name:
          - Transit
          - 中转
          - 自建
      include-direct: false

    landing:
      id: landing
      group-name: "🚪 落地"
      type: select
      selector:
        any-name:
          - Relay
          - 落地
        all-names:
          - 直连
          - 家宽
```

selector 优先使用结构化关键词组合。确实无法表达时允许显式 regex：

```yaml
selector:
  regex: "..."
  flags: i
```

两者不得同时存在。

运行时行为：

1. 先识别 landing 节点并从普通池移除。
2. 在剩余节点中选择 transit 成员。
3. 两边都非空时生成组，并给 landing 节点注入 `dialer-proxy = transit group name`。
4. 任一端为空时输出 warning，并让链路整体不生效。
5. 节点已有 `dialer-proxy` 时保留原值并 warning。

第 4 项是切换后的目标语义。并行迁移期为了通过 v1/v2 golden，对“landing 已命中但 transit 为空”的情况暂时保留 v1 行为：landing 仍从普通池移除，但不注入 `dialer-proxy`。该兼容差异必须在切换后以独立行为提交修正，不能混入首次等价切换。

内部 IR 使用 edge 表达 `landing -> transit`；未来两跳通过新增中转 edge 扩展。

## 7. 策略组模板

`group-templates.yaml` 示例：

```yaml
templates:
  proxy_service:
    type: select
    members:
      - group: proxy_select
      - group: manual_select
      - group: auto_select
      - builtin: DIRECT
      - generated: chain_groups
      - generated: region_groups

  direct_first:
    type: select
    members:
      - builtin: DIRECT
      - group: proxy_select
      - group: manual_select
      - group: auto_select
      - generated: chain_groups
      - generated: region_groups

  reject_first:
    type: select
    members:
      - builtin: REJECT
      - builtin: DIRECT

  auto_test:
    type: url-test
    members:
      - pool: all_nodes
    mihomo:
      url: https://www.gstatic.com/generate_204
      interval: 300
      lazy: false
```

### 7.1 成员引用类型

```yaml
- group: proxy_select          # 稳定策略组 ID
- pool: all_nodes              # 动态节点池
- generated: region_groups     # 动态生成组集合
- generated: chain_groups
- builtin: DIRECT              # Mihomo 内置目标
- node: "某个固定节点名"       # 少数必要场景
```

每个对象必须只包含一种引用类型。禁止未识别的 `@xxx` 字符串。

### 7.2 模板覆盖

普通模块：

```yaml
groups:
  - id: ai_service
    name: "🤖 AI 服务"
    template: proxy_service
```

特殊组完整覆盖：

```yaml
groups:
  - id: ad_block
    name: "🛑 广告拦截"
    type: select
    members:
      - builtin: REJECT
      - builtin: DIRECT
```

规则：

- `template` 与顶层 `type/members` 不得同时使用，避免隐式 merge。
- 模板实例可以使用 `mihomo` 覆盖原生选项，但不能覆盖模板的项目领域字段。
- 若模板已经不适合，应完整声明特殊组，而不是增加复杂 patch 语法。

## 8. Provider source

### 8.1 标准来源模板

`provider-sources.yaml` 示例：

```yaml
sources:
  metacubex_geosite:
    id-template: "{name}"
    url-template: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/{name}.mrs"
    path-template: "./ruleset/{id}.mrs"
    provider:
      type: http
      behavior: domain
      format: mrs
      interval: 86400

  metacubex_geoip:
    id-template: "{name}-ip"
    url-template: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/{name}.mrs"
    path-template: "./ruleset/{id}.mrs"
    provider:
      type: http
      behavior: ipcidr
      format: mrs
      interval: 86400
```

模板变量只允许白名单，例如 `{name}`、`{id}`；禁止执行任意表达式。

source 不包含 target group 或 rule order。

非 MetaCubeX 标准来源可在 source 定义的 `mihomo` 区统一声明 `size-limit`、公开 header 等原生扩展；这些字段同样不能覆盖 `type/url/path` 等领域字段，也不能包含凭据。

### 8.2 标准简写

```yaml
providers:
  - source: metacubex_geosite
    name: openai
  - source: metacubex_geosite
    name: anthropic
  - source: metacubex_geosite
    name: category-ai-chat-!cn
  - source: metacubex_geoip
    name: telegram
    no-resolve: true
```

可用 `id` 显式覆盖生成 ID，但仍需通过唯一性校验。

### 8.3 自定义 provider

```yaml
providers:
  - id: company_public
    provider:
      type: http
      behavior: classical
      format: yaml
      url: https://example.com/public/company.yaml
      path: ./ruleset/company-public.yaml
      interval: 3600
```

自定义 provider 是正式能力，不是仅供调试的 fallback。

完整自定义声明还支持 `file` 与 `inline`。`file` 必须显式声明 `path`；`inline` 在 `mihomo.payload` 中声明非空规则。根据 Mihomo 原生约束，`mrs` 只允许 `domain` 或 `ipcidr` behavior。

`provider` 对常见 Mihomo 字段做类型校验；尚未建模的新字段放入显式透传区：

```yaml
  - id: future_provider
    provider:
      type: http
      behavior: domain
      url: https://example.com/future.mrs
      path: ./ruleset/future.mrs
      format: mrs
    mihomo:
      future-option: true
```

最终仍由 `mihomo -t` 验证原生字段。

## 9. 业务路由模块

### 9.1 单组模块示例

`routing/modules/ai.yaml`：

```yaml
id: ai

groups:
  - id: ai_service
    name: "🤖 AI 服务"
    template: proxy_service

rule-blocks:
  - id: services
    target: ai_service
    providers:
      - source: metacubex_geosite
        name: openai
      - source: metacubex_geosite
        name: anthropic
      - source: metacubex_geosite
        name: category-ai-chat-!cn
```

### 9.2 多组领域模块示例

`routing/modules/social.yaml`：

```yaml
id: social

groups:
  - id: telegram
    name: "📲 电报消息"
    template: proxy_service
  - id: twitter
    name: "🐦 推特/X"
    template: proxy_service
  - id: meta_social
    name: "📘 Meta 系"
    template: proxy_service
  - id: discord
    name: "🎙️ Discord"
    template: proxy_service
  - id: social_other
    name: "💬 其他社交"
    template: proxy_service

rule-blocks:
  - id: telegram
    target: telegram
    providers:
      - { source: metacubex_geosite, name: telegram }
      - { source: metacubex_geoip, name: telegram, no-resolve: true }

  - id: twitter
    target: twitter
    providers:
      - { source: metacubex_geosite, name: twitter }
      - { source: metacubex_geoip, name: twitter, no-resolve: true }

  - id: meta
    target: meta_social
    providers:
      - { source: metacubex_geosite, name: facebook }
      - { source: metacubex_geosite, name: instagram }
      - { source: metacubex_geosite, name: whatsapp }
      - { source: metacubex_geoip, name: facebook, no-resolve: true }

  # 其余 block 省略
```

### 9.3 内联规则

内联规则属于 rule block，不再集中到一个全局 `inlineRules.yaml`：

```yaml
rule-blocks:
  - id: steam
    target: steam
    rules:
      - type: RULE-SET
        provider: steam-cn
        target: DIRECT
      - type: RULE-SET
        provider: steam
```

对于暂未结构化建模的 Mihomo 规则，允许显式 raw：

```yaml
    rules:
      - raw: "AND,((PROCESS-NAME,ssh),(NETWORK,tcp)),🔑 SSH"
```

raw 规则仍解析并校验目标引用；无法可靠解析时要求显式声明 `target` 供交叉校验。

### 9.4 顺序约束

已知覆盖关系应写成可验证约束，而不是只留注释：

```yaml
constraints:
  - before: azure
    after: microsoft
    reason: microsoft provider 完全覆盖 azure
  - before: aws
    after: amazon
    reason: amazon provider 完全覆盖 aws
```

编译器验证最终 pipeline 满足约束。联网 audit 负责重新发现上游内容变化，不负责在普通构建中拉取远程内容。

## 10. Rename profiles

`rename/profiles.yaml` 将当前长 URL 参数迁移为可审阅配置。

```yaml
profiles:
  pokemon:
    prefix: 宝可梦
    prefix-position: first
    separator: "-"
    add-flag: true
    preserve-multiplier: true
    collapse-single: true
    preserve-tags:
      - 直连
      - IPLC
      - IEPL
      - 专线
      - Vless
      - Anytls
      - 家宽
      - 原生
      - V6
      - 游戏
      - 测试
      - AWS

  self_hosted:
    prefix: 自建
    prefix-position: first
    separator: "-"
    add-flag: true
    preserve-multiplier: false
    collapse-single: true
    preserve-tags:
      - 直连
      - IPLC
      - IEPL
      - 专线
      - 中转
      - XHTTP
      - cdn
      - REALITY
      - tls
      - down
      - 家宽
      - 原生
      - V6
      - 游戏
      - 测试
      - AWS
      - BWH
      - DMIT
      - vircs
      - MEGABOX
      - proWee
      - ebCorona
```

标签匹配默认大小写不敏感，因此 `REALITY/reality/Reality` 无需重复。迁移期默认保留输入中实际匹配到的拼写，以维持现有输出；以后可以为单个标签显式声明规范输出拼写。

重命名前会跳过订阅服务混入节点列表的强元数据项，例如“剩余流量”“已用/总流量”“套餐/订阅到期”和“下次流量重置”。判定只使用这些强组合信号；普通 `GB` 地区代码、含“测试”的节点名或单独出现的英文 `Traffic` 不会被过滤。被跳过的项产生 `RENAME_SUBSCRIPTION_METADATA_SKIPPED` warning，便于在宿主日志中追踪。

新主接口：

```text
rename.js#profile=pokemon
rename.js#profile=self_hosted
```

`#noCache` 是 Sub-Store 资源缓存控制，不进入 rename profile。

在 Sub-Store 中，`rename.js` 必须作为节点列表的“脚本操作”远程链接加载，不能放入内置“重命名操作”；后者有独立的命名规则，不会调用本 bundle 的 `operator`。例如：

```text
https://www.quietus.icu/proxy-config-hub/v2/rename.js#profile=pokemon#noCache
https://www.quietus.icu/proxy-config-hub/v2/rename.js#profile=self_hosted#noCache
```

迁移期兼容当前 `bl`、`blkey`、`fgf`、`flag`、`name`、`nf`、`one` 等参数。解析优先级：

1. 存在 `profile` 时加载命名 profile。
2. 旧参数若同时存在，则只允许明确的兼容覆盖项；其他冲突报错。
3. 没有 profile 时进入 legacy 参数兼容路径。

旧参数兼容层在 v2 内保留，但不继续扩展新参数。

## 11. 严格 DSL 与 Mihomo 透传

所有项目对象默认 strict：

```yaml
group:
  templete: proxy_service # 拼写错误，构建失败
```

只有显式 `mihomo` 对象允许未建模的原生字段：

```yaml
group:
  id: special
  template: proxy_service
  mihomo:
    future-option: true
```

透传规则：

- 不能覆盖 `name`、`type`、`proxies` 等由领域编译器拥有的关键字段。
- 不能包含 `target-group` 等项目私有字段。
- 最终输出必须通过 Mihomo 官方配置测试。
- 常用的新字段稳定后应提升为正式 schema，不长期滥用透传区。

## 12. YAML 语法限制

为了让配置可读、可定位、可迁移：

- 只接受 YAML 1.2 单文档。
- 禁止自定义 tags。
- 禁止跨文件 include。
- 禁止 YAML merge key 和 alias/anchor 继承；复用通过项目模板表达。
- duplicate keys 直接报错。
- 文件编码必须是 UTF-8。
- 不依赖解析器隐式日期类型；日期如有需要必须写成字符串。

## 13. 编译阶段

```text
1. Discover（仅按 manifest）
2. Parse YAML + source locations
3. Zod structural validation
4. Resolve files and stable IDs
5. Expand group/provider templates
6. Build normalized IR
7. Semantic validation
8. Emit runtime data and publication assets
```

语义校验至少覆盖：

- 全局 ID/名称唯一性。
- module、group、provider、source、template 引用存在。
- group layout 和 rule pipeline 精确覆盖。
- fallback 唯一且最后。
- provider 输出 path/ID 唯一。
- rule target 合法。
- 内置目标使用允许列表。
- selector/regex 合法。
- topology 无环、landing/transit 互斥。
- runtime target/apply 组合合法。
- `mihomo` 透传不能覆盖领域拥有字段。
- 公共 URL 不含凭据。
- 所有 YAML（包括 `mihomo` 透传区）拒绝非空 `secret`、`token`、`password`、`Authorization`、私钥等敏感字段。

## 14. 输出确定性

相同源码、依赖锁文件、环境变量和 git commit 必须产生结构相同的 bundle 数据与配置输出。

- 不读取当前时间参与 bundle 逻辑；构建时间只写 manifest 元数据。
- 不在构建时拉取远程 provider 内容。
- 不按文件系统枚举顺序决定模块或规则顺序。
- 不在序列化时自动排序有业务顺序的对象/数组。
- golden 比较忽略 manifest 中明确标记为非确定性的构建时间字段。
