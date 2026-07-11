# proxy-config-hub v2 迁移计划

> 目标：在保持代表性输入语义等价的前提下并行建立 v2，达到验收门槛后一次切换；不长期维护 v1/v2 双轨。

## 1. 迁移原则

1. 先建立可重复基线，再改架构。
2. 重构与策略行为变更分离。
3. v1 在迁移期间始终可构建、可验证。
4. v2 不读取或依赖已提交的 `scripts/config/*.js`。
5. 每个阶段都提供独立验证，不用后续阶段掩盖前序问题。
6. 只有全部切换门槛通过后才删除 v1。
7. 删除、移动和批量迁移必须发生在范围明确的切换阶段，不与功能修复混在一起。

## 2. 语义等价边界

首次切换 v2 时保持：

- runtime preset 的当前应用语义。
- 策略组名称、类型、成员与输出顺序。
- provider ID、字段、URL、path 和声明顺序。
- `rules = inline/prepend + providers + MATCH` 的当前结果。
- 地区组对代表性节点 fixture 的归属。
- 一跳中转/落地分组与 `dialer-proxy` 注入。
- 既有 `dialer-proxy` 保留行为。
- 三个 override 宿主的 `main` 调用结果。
- 两个实际 rename 参数链接的输出。

不要求字节级 bundle 相同，也不要求内部对象 identity 相同；比较的是规范化后的输出结构与可观察行为。

以下行为在切换后单独提交：

- 无有效代理从“返回部分配置”改为 fatal error。
- 节点识别从 first-match regex 完全切换到优先级分类器时产生的少数归属修正。
- rename legacy 参数废弃或输出文案调整。
- 策略组、DNS、规则本身的业务优化。

## 3. 并行目录策略

迁移期间：

```text
definitions/              # v1 保留
scripts/override/         # v1 保留
scripts/config/           # v1 生成层保留
tools/verify-main.js      # v1 基线验证保留

config/                   # v2 新配置
src/                      # v2 TypeScript
tests/                    # v2 Vitest
```

v2 使用独立 npm scripts，例如 `build:v2`、`test:v2`、`compare:v1-v2`，直到最终切换。

最终切换后再将 v2 命令提升为 `build/test/check`，并删除 v1 路径。

## 4. 阶段 0：冻结基线

### 4.1 保存当前事实

- 记录当前 commit SHA。
- 执行并记录 `npm run verify` 通过。
- 生成当前完整示例配置。
- 保存当前 override bundle 行为 fixture，而不是复制 bundle 本身作为真相源。
- 提取 34 个策略组、93 个 providers、28 个地区及顺序清单。
- 保存两个实际 rename URL 参数的已解码配置。

### 4.2 建立脱敏 fixtures

至少包含：

| Fixture | 目的 |
|---|---|
| `basic-regions` | 常用地区中文、英文、code、旗帜 |
| `unknown-region` | OTHER 归属 |
| `invalid-names` | 空名、非字符串 name、空 proxies |
| `chain-effective` | 中转与落地均存在 |
| `chain-no-landing` | 链路退化 |
| `chain-no-transit` | 链路退化 |
| `existing-dialer` | 保留已有 `dialer-proxy` |
| `host-fields` | 未受管顶层字段透传 |
| `rename-pokemon` | 第一条真实参数配置 |
| `rename-self-hosted` | 第二条真实参数配置 |
| `ambiguous-region` | 冲突信号与诊断 |

所有 server、UUID、密钥、SNI 和订阅标识必须脱敏或完全虚构。

### 4.3 基线产物

```text
tests/fixtures/v1-input/
tests/golden/v1-output/
tests/golden/v1-rename/
```

## 5. 阶段 1：工具链骨架

### 5.1 依赖与配置

引入：

- TypeScript strict。
- `yaml`。
- Zod 4。
- Vitest。
- ESLint + typescript-eslint。
- Prettier。
- 继续使用 esbuild。

依赖和 lockfile 变更必须单独提交并说明用途。

### 5.2 初始命令

```json
{
  "scripts": {
    "format": "...",
    "format:check": "...",
    "lint": "...",
    "typecheck": "...",
    "test:v2": "...",
    "build:v2": "...",
    "compare:v1-v2": "..."
  }
}
```

避免用 shell 连接大量命令；建立 `src/tools/check.ts` 或等价 Node 编排入口。

### 5.3 验收

- TypeScript 空骨架可 typecheck。
- Vitest 能运行。
- v1 `npm run verify` 仍通过。
- 不产生提交外生成文件。

## 6. 阶段 2：配置编译器

### 6.1 YAML loader

实现：

- 单文档 YAML 1.2。
- duplicate key 检测。
- 禁止 alias/merge/custom tags。
- `LineCounter` 和节点 path 到 source location 的映射。
- manifest 受限路径解析。

### 6.2 Zod schemas

按文件类型拆分 raw schemas：

- manifest。
- runtime plan。
- node catalog/regions/chains。
- group templates。
- provider sources。
- routing module。
- rename profiles。

Zod schema 是 raw config 类型的单一事实源；规范化 IR 使用独立显式 TypeScript 类型。

### 6.3 semantic validator

按诊断代码拆分，不使用一个巨型 `validateAll`：

```text
CFG_DUPLICATE_ID
CFG_UNKNOWN_REFERENCE
CFG_LAYOUT_MISSING_GROUP
CFG_PIPELINE_DUPLICATE_BLOCK
CFG_FALLBACK_POSITION
CFG_PROVIDER_PATH_COLLISION
CFG_TOPOLOGY_CYCLE
CFG_SECRET_LIKE_URL
```

每条错误必须能定位到最接近的 YAML 声明。

### 6.4 验收

- 全部 v2 YAML 可编译为 Project IR。
- 常见错误有 fixture 和精确诊断测试。
- 编译过程不联网。
- 相同输入重复编译产生等价 IR。

## 7. 阶段 3：共享 node-domain 与 rename

### 7.1 迁移国家/地区数据

- 从旧 rename 四套平行数组与 override regions 提取统一 catalog。
- 用稳定 region ID 建立规范名称、code、emoji、alias、city。
- 不直接复制明显错误、重复或依赖数组下标的旧数据；每项需由测试覆盖。
- 在复用旧 rename 代码或数据前确认其来源与许可证；无法确认时只按已验证行为重新实现，不复制未知许可代码。

### 7.2 节点解析器

实现纯函数：

- 地区识别。
- 倍率提取。
- 标签提取与规范大小写。
- 冲突诊断。
- OTHER fallback。

### 7.3 rename profiles

- 建立 `pokemon` 与 `self_hosted`。
- 兼容当前 legacy 参数。
- `profile` 成为主接口。
- 迁移期标签匹配可大小写不敏感，但输出保留输入拼写，确保现有节点名等价。
- `noCache` 保持为 Sub-Store URL 行为，不进入领域配置。

### 7.4 rename adapter

暴露：

```js
async function operator(proxies, targetPlatform, context) {}
```

读取 `$arguments`，但不让 `$arguments` 进入 node-domain。

### 7.5 验收

- 两个命名 profile 与当前实际参数输出结构等价。
- 旧参数仍可执行。
- rename bundle 在 Sub-Store operator harness 中通过。
- override 尚未依赖 rename 输出格式。

## 8. 阶段 4：Override 领域流水线

建议将运行时拆成明确阶段：

```text
validateHostInput
→ parseNodes
→ resolveTopology
→ buildGeneratedGroups
→ buildConfiguredGroups
→ assembleProviders
→ assembleRules
→ applyRuntimePlan
→ validateDynamicOutput
→ return result + diagnostics
```

### 8.1 不变量归属

每个不变量只在一个最早可判断的位置表达：

- YAML 引用：compiler semantic validator。
- 节点名称与地区：node-domain。
- 链路互斥/防环：topology domain。
- group members：routing assembler。
- provider target：rule assembler。
- Mihomo 原生配置合法性：官方二进制。

最终 output validator 只检查动态装配结果，不重复实现全部构建期 schema。

### 8.2 输入所有权

- 创建新顶层对象。
- 未受管键浅透传。
- proxies 只在确需注入链路字段时克隆节点对象。
- runtime plan 明确覆盖目标。
- 不使用 JSON stringify/parse 作为通用 clone。

### 8.3 验收

- 全部基线 fixtures 生成 v2 输出。
- 新旧规范化结果对比通过。
- warning/error 使用稳定诊断代码。
- 核心测试不依赖 console 或 VM。

## 9. 阶段 5：宿主适配与 bundle

### 9.1 override

生成单一 `override.js`：

- `main(config, profileName?)`。
- Mihomo Party harness。
- Clash Verge Rev 参数契约 harness。
- Sub-Store Mihomo 配置覆写 harness。
- 迁移期保留 global/CommonJS 双导出。

首期不加入正式 QuickJS 执行测试，但 bundle 目标保持 ES2020。

### 9.2 rename

生成单一 `rename.js`：

- `operator(proxies, targetPlatform, context)`。
- `$arguments.profile`。
- legacy 参数兼容。
- Sub-Store harness。

### 9.3 bundle 检查

- 两个 artifact 均为单文件。
- 不包含 Node 内置模块引用。
- 不包含 YAML parser、Zod、Vitest 或编译器代码。
- 不包含源文件绝对路径或 secret。
- 入口函数在对应 harness 可发现。
- bundle size 只设回归告警，不把任意 KB 数作为架构目标。

## 10. 阶段 6：Mihomo 工具与统一 check

### 10.1 工具解析器

按固定优先级：

1. `MIHOMO_BIN`。
2. `PATH`。
3. `.cache/tools/mihomo/<version>/<platform>/mihomo`。

第三层下载：

- 版本在仓库配置中锁定。
- 平台映射显式支持 macOS/Linux 与 CI 架构。
- 下载官方 release。
- 校验官方 checksum。
- 原子写入缓存，失败不留下伪完整文件。

### 10.2 示例配置

使用脱敏代理 fixture 执行 v2 override，序列化完整 YAML，再运行：

```bash
mihomo -t -f <generated-config>
```

不得用自制 validator 替代这一步。

### 10.3 统一命令

切换前目标：

```text
npm run tools:setup
npm run check:v2
```

切换后提升为：

```text
npm run tools:setup
npm run check
```

GitHub Actions 只调用相同命令，不复制内部步骤。

## 11. 阶段 7：CI 与发布

### 11.1 CI

PR/push：

```text
npm ci
npm run tools:setup
npm run check
```

可缓存：

- npm cache。
- 锁定版本 Mihomo 工具缓存。

不得缓存构建输出作为正确性来源。

### 11.2 Pages

main 检查成功后：

```text
npm run build:site
→ upload-pages-artifact(dist/)
→ deploy-pages
```

Pages 发布 source 选择 GitHub Actions。`v2` 是 artifact 内目录，不是 Git 分支。

自定义域名暂不锁定；使用 `PUBLIC_BASE_URL` 或部署配置生成绝对链接。以后切换域名只需重新构建发布。

### 11.3 Release

`v2.*.*` tag workflow：

- 完整 check。
- 校验 tag 与项目版本一致。
- 构建不可变 assets。
- 生成 SHA-256 文件。
- 创建 GitHub Release 并上传 assets。

创建 tag 是人工发布授权；Release 后续步骤自动化。

### 11.4 远程规则审计

`npm run audit:rules`：

- 手动执行。
- weekly workflow。
- 检查 URL 可用性、格式、跨组完整遮蔽和部分重叠。
- audit workflow 自身失败，但不阻塞普通 Pages 发布。

## 12. 切换门槛

只有以下条件全部满足才允许移除 v1：

- [ ] v1 当前 verify 仍通过。
- [ ] v2 所有 YAML schema/semantic 校验通过。
- [ ] 代表性 override fixtures 新旧结构化输出等价。
- [ ] 链路有效与退化 fixtures 通过。
- [ ] runtime apply 语义 fixtures 通过。
- [ ] 两个 rename profile 与当前参数结果等价。
- [ ] Mihomo Party contract harness 通过。
- [ ] Clash Verge Rev 参数 contract harness 通过。
- [ ] Sub-Store Mihomo config override harness 通过。
- [ ] Sub-Store rename operator harness 通过。
- [ ] `mihomo -t -f` 通过。
- [ ] 本地 `npm run check` 通过。
- [ ] GitHub Actions 同一命令通过。
- [ ] Pages staging URL 能被三个实际宿主加载。
- [ ] Release dry-run 资产与 manifest/checksum 正确。
- [ ] 文档中的配置示例与真实 schema 一致。

## 13. 最终切换

建议切换提交只做以下范围：

1. 将 v2 scripts 提升为默认 `build/test/check`。
2. 将 Pages/Release workflow 指向 v2 dist。
3. 删除 v1：
   - `definitions/mihomo-preset/`
   - `definitions/proxy-groups/`
   - `definitions/rules/`
   - `scripts/config/`
   - `scripts/override/`
   - 旧 `tools/yaml-to-js.js`
   - 旧 `tools/verify-main.js`
   - 被新工具替代的旧 helpers
4. 将 `definitions/assets/custom/` 内容迁入 `public/rules/` 后删除旧路径。
5. 更新 README、AGENTS.md、设计文档和命令说明。
6. 生成第一个 v2 Release tag。

删除前再次确认 Git 状态，禁止覆盖迁移期间用户的其他改动。

## 14. 切换后的行为改进

架构切换完成后，以独立提交进行：

1. 无有效代理改为 fatal error。
2. 启用新的节点冲突诊断并审阅 OTHER 归属。
3. 将 Sub-Store 使用链接切换为命名 rename profile。
4. 根据实际使用情况缩小 legacy rename 参数面。
5. 删除确认无用的 CommonJS override 桥。
6. 评估加入正式 QuickJS 执行测试。
7. 根据需要设计两跳中转 YAML。

不得把这些行为变化塞入首次 v2 等价切换提交。

## 15. 回滚策略

### 15.1 切换前

v1 一直保留，可继续使用原发布流程；v2 失败只影响新路径。

### 15.2 切换后

- Pages `/v2/` 出现问题：重新构建并部署上一个已知良好 tag。
- 客户端紧急回滚：将 URL 改为明确的 GitHub Release asset。
- 代码回滚：revert 切换提交；不使用破坏性 `git reset --hard`。
- provider 上游变化：使用最近 Release 固定 bundle，并单独处理远程规则源。

### 15.3 Release 原则

已发布 tag/Release 视为不可变。修复必须发布新 patch 版本，不替换旧 asset。

## 16. 主要风险与控制

| 风险 | 控制 |
|---|---|
| YAML DSL 过度复杂 | 有限模板、显式引用、禁止通用继承 |
| v1/v2 长期双轨 | 设置明确切换门槛，达标后一次删除 |
| golden 固化错误 | 关键不变量使用显式测试，快照需人工审阅 |
| 节点识别变化 | 真实脱敏 fixture、冲突诊断、行为变化后置 |
| Sub-Store 契约变化 | 分开测试 config override 与 node operator |
| QuickJS 差异 | 保守 bundle 目标，后续增加真实执行测试 |
| Mihomo 配置 schema 漂移 | 固定版本官方二进制验证，升级单独提交 |
| 远程规则上游变化 | 定时 audit，不让网络波动污染普通构建 |
| 自定义域名变更 | base URL 部署注入，业务配置不硬编码 |
| 生成物污染仓库 | `dist/`、`.cache/` 忽略，Pages 使用 artifact |

## 17. 建议实施提交序列

每个提交保持可验证：

1. `docs: 添加 v2 架构与迁移设计`
2. `build: 引入 TypeScript 与测试工具链`
3. `feat: 建立 v2 YAML loader 与结构 schema`
4. `feat: 建立 v2 语义校验与 Project IR`
5. `feat: 统一节点地区与标签解析模型`
6. `feat: 重写 Sub-Store rename 并加入命名 profile`
7. `feat: 实现 v2 路由与策略组装配核心`
8. `feat: 实现一跳链路拓扑与动态组生成`
9. `build: 生成双应用 bundle 与宿主契约测试`
10. `test: 加入 v1/v2 golden 对比与 Mihomo 验证`
11. `ci: 使用统一 check 并部署 Pages artifact`
12. `refactor: 切换 v2 并移除 v1 构建链`
13. `release: 发布 v2.0.0`

实际实施中若某个提交过大，应按领域继续拆分，但不得把不相关重构混入同一提交。
