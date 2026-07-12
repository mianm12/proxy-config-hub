# proxy-config-hub v2 架构设计

> 状态：当前架构已在 `main` 稳定运行；本文只描述现行设计与长期边界。

## 1. 产品定位

项目只服务维护者自己的 Mihomo 配置，是一个强约定的配置编译与静态发布仓库，不建设多租户平台、插件市场或任意脚本执行框架。

项目发布两个独立应用：

| Artifact      | 宿主                      | 入口契约                                     |
| ------------- | ------------------------- | -------------------------------------------- |
| `override.js` | Mihomo Party              | `main(config)`                               |
| `override.js` | Clash Verge Rev           | `main(config, profileName)`                  |
| `override.js` | Sub-Store Mihomo 配置覆写 | `main(config)`                               |
| `rename.js`   | Sub-Store 节点脚本操作    | `operator(proxies, targetPlatform, context)` |

三个 override 宿主共享同一份 bundle 和核心行为。`rename` 是独立应用，只通过窄的节点领域模型与 override 共享能力。

当前非目标：

- 任意深度多跳代理。
- 多套 Mihomo profile。
- 通用插件或自定义代码执行。
- 私有 provider 凭据注入。
- 远程规则内容镜像。
- QuickJS 实机执行作为正式门槛。

## 2. 技术选型

| 能力         | 选择              | 作用                                  |
| ------------ | ----------------- | ------------------------------------- |
| Runtime / CI | Node.js 24        | 本地工具、构建、测试和 GitHub Actions |
| 包管理与命令 | npm               | 唯一公开命令入口                      |
| 实现语言     | TypeScript strict | 编译器、领域、运行时、适配器和工具    |
| 人工配置     | YAML 1.2          | 保持配置可扫描、可排序、便于人工修改  |
| 结构校验     | Zod               | raw schema、外部输入和测试边界        |
| YAML 解析    | `yaml`            | AST、源位置、严格解析和输出           |
| 测试         | Vitest            | 单元、集成、当前输出和宿主契约        |
| Bundle       | esbuild           | 生成两个 ES2020 单文件 IIFE           |
| 代码质量     | ESLint + Prettier | 类型感知检查和统一格式                |

不使用 Makefile、workspaces、运行时 YAML 解析或通用 deep merge。复杂编排由 TypeScript CLI 完成。

## 3. 仓库边界

```text
config/               唯一人工业务配置源
src/compiler/         YAML loader、raw schema、语义校验、Project IR
src/domain/           与宿主和 IO 无关的纯领域逻辑
src/runtime/          override / rename 运行时装配
src/apps/             宿主入口与参数适配
src/build/            bundle、路径、尺寸与发布资产
src/tools/            本地、CI、Mihomo 与规则审计命令
public/rules/         原样发布的自定义规则资产
templates/            脱敏示例输入
tests/fixtures/       脱敏行为输入
tests/expected/       经过审阅的当前输出契约
```

依赖方向固定为：

```text
config → compiler → Project IR → runtime → apps → bundle
                       ↑            ↑
                    domain ─────────┘
```

约束：

- `domain` 不依赖 compiler、apps、tools 或 Node API。
- `runtime` 只以类型方式消费 Project IR，不依赖 apps、tools 或 Node API。
- override 与 rename app 不互相导入。
- 文件系统、网络、进程和宿主全局变量只存在于边界层。
- 架构依赖方向由自动测试保护。

## 4. 配置编译

`config/manifest.yaml` 是唯一装配入口，显式列出 runtime、nodes、routing modules、group layout、rule pipeline 和 rename profiles。编译器不通过目录扫描隐式发现业务模块。

编译分为四层：

1. YAML loader 解析 YAML 1.2，拒绝重复键、危险 tag 和非法编码，并保留行列位置。
2. Zod raw schema 校验单文件结构；项目 DSL 默认 strict。
3. semantic compiler 校验跨文件引用、稳定 ID、顺序、链路拓扑、provider 和安全边界。
4. 输出规范化、只读的 Project IR，供两个运行时和构建器消费。

只有显式 `mihomo` 区允许透传项目未建模的 Mihomo 原生字段。项目字段与原生字段不能用隐式合并互相覆盖。

### 4.1 Runtime 配置

runtime item 使用明确的应用模式：

- `overlay`：浅层覆盖目标对象。
- `replace`：整体替换目标字段。
- `if-absent`：仅在宿主没有该字段时设置。

`proxies`、`proxy-groups`、`rule-providers` 和 `rules` 由运行时装配器独占，runtime 配置不得声明。

### 4.2 路由配置

业务模块纵向包含相关策略组和 rule blocks，全局只显式维护两个维度：

- `group-layout`：客户端策略组展示顺序。
- `rule-pipeline`：Mihomo first-match-wins 规则顺序。

provider source 模板只负责 URL、path、format、interval 等获取字段，不控制目标策略组或全局顺序。标准来源允许简写，完整自定义 provider 始终可用。

### 4.3 Rename profiles

重命名行为由 `config/rename/profiles.yaml` 管理，按 `defaults → profile → $arguments` 覆盖。`profile` 可省略并回落到显式默认项；URL 只开放格式字段、分隔符、方括号、订阅 fallback、扩展特征和序号模式等受控参数，未知参数仍然拒绝。

## 5. 共享节点领域

node-domain 统一完成：

- 地区、国旗、地区代码、城市和别名识别。
- 标签提取与大小写不敏感匹配。
- 倍率识别。
- 订阅流量元数据过滤。
- 未知和冲突信号的结构化诊断。

override 地区识别使用确定的信号优先级，并将无法识别的节点归入 `OTHER`。rename 在 Sub-Store adapter 边界优先注入 `ProxyUtils.getISO`，再回落到共享 catalog；最终无法识别时保留节点并输出 `🏳️ ZZ`。override 直接使用共享 metadata 分类，不要求节点先经过 rename。

## 6. Override 运行时

```text
宿主 config
→ 校验并提取有效命名节点
→ 应用 runtime plan
→ 解析一跳链路拓扑
→ 构建地区与策略组
→ 展开 providers 与 rules
→ 验证动态输出不变量
→ 返回新的完整配置
```

关键契约：

- 无任何有效代理时抛出结构化 fatal error，不返回部分配置。
- 未受管理的宿主顶层字段默认透传。
- 链路只支持 `客户端 → 中转 → 落地 → 目标`。
- landing 与 transit 都有成员时才生成链路组并注入 `dialer-proxy`。
- 任一端为空时链路不生效，节点保持在普通池，并输出 warning。
- 节点已有 `dialer-proxy` 时保留原值并输出 warning。
- 运行时不得修改调用方传入的对象。

IR 使用 edge 表达 `landing -> transit`，为未来增加中间 hop 保留拓扑边界，但当前配置 DSL 不暴露两跳语法。

## 7. Rename 运行时

```text
Sub-Store proxies + $arguments
→ adapter 解析默认配置、命名 profile 与直接参数覆盖
→ 注入 ProxyUtils 地区解析器
→ rename runtime 提取订阅、地区、协议、规范特征和倍率
→ 可组合字段渲染并生成稳定序号
→ 返回新代理数组与结构化诊断
```

rename bundle 不包含 override 配置、规则 providers 或 Mihomo runtime preset。两个应用仅共享节点领域代码和类型。

## 8. 错误与安全边界

构建期错误包括：

- YAML/schema 错误。
- 未知字段或引用。
- 重复 ID、名称和布局项。
- provider、pipeline 和拓扑不闭合。
- 路径越界、绝对路径和敏感字段。

运行期 warning 包括未知地区、链路 selector 无匹配、已有 `dialer-proxy` 和被跳过的订阅元数据。无法生成合法配置的情况必须抛错，不能使用静默 fallback 掩盖。

原始订阅只在内存中处理，不写入日志、fixture、快照或发布资产。所有仓库测试端点使用文档保留地址并保持脱敏。

## 9. Bundle 与宿主适配

构建器在构建期编译 Project IR，并通过 esbuild virtual module 注入只读运行数据。因此发布 bundle 不包含 YAML、Zod、Node API、配置绝对路径或编译器。

两个 bundle 均以 ES2020 IIFE 输出：

- override 暴露 `globalThis.main`，并提供由 Sub-Store 契约测试覆盖的 CommonJS bridge。
- rename 暴露 `globalThis.operator`。

Clash Verge Rev 的可选 `profileName` 当前只属于宿主上下文，不进入领域流水线。

## 10. 测试策略

测试层次：

1. 单元测试：纯函数与单一不变量。
2. schema 测试：非法 YAML、字段和 source location。
3. 编译集成测试：配置模块到 Project IR。
4. 当前输出测试：代表性输入与 `tests/expected/` 的审阅结果比较。
5. 宿主契约测试：Mihomo Party、Clash Verge Rev、Sub-Store override 和 rename 分别加载 bundle。
6. 官方 Mihomo 验证：脱敏完整配置运行 `mihomo -t -f`。
7. 联网规则审计：独立手动或定时运行，不进入普通 `check`。

错误和退化场景优先断言明确不变量，不保存不必要的大型完整快照。行为修改必须同步更新测试和预期结果，并人工审阅差异。

## 11. 工具与发布

Mihomo 解析顺序固定为：

1. `MIHOMO_BIN` 显式路径。
2. `PATH` 中的 `mihomo`。
3. 项目缓存中按锁定版本和 SHA-256 下载的官方二进制。

本地和 CI 共享 `npm run check`。Pages artifact 是 `/v2/` 持续更新通道，`v2.*.*` GitHub Release 是不可变回滚通道。发布前必须存在与当前示例、锁文件和 Mihomo 版本匹配的验证回执。

## 12. 已确认决策

1. 个人专用、强约定配置编译器。
2. YAML 作为人工界面，严格 TypeScript 作为实现语言。
3. 单 npm package，不引入 workspaces 或 Makefile。
4. override 与 rename 独立，共享窄 node-domain。
5. manifest 显式装配全部配置模块。
6. group layout 与 rule pipeline 分离。
7. 标准 provider 简写与完整自定义 provider 并存。
8. runtime 使用显式应用模式，不实现通用 deep merge。
9. 首期只支持一跳中转，IR 不封死未来 hop。
10. 三宿主共享一份 override bundle。
11. 本地与 GitHub Actions 使用相同检查入口。
12. Pages 作为稳定通道，Release 作为不可变通道。

## 13. 延后决策

- QuickJS 实机执行测试。
- 两跳中转 YAML 语法。
- 是否删除 CommonJS override bridge。
- 是否为定时规则审计自动创建通知或 Issue。
- 是否为 Pages 配置独立子域名。
