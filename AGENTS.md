# AGENTS.md

本文件是 Codex、Claude Code 和通用编码 Agent 的仓库级唯一指令源。`CLAUDE.md` 通过官方 `@AGENTS.md` 语法导入本文件；规则变更只修改这里。

## 项目与语言

本仓库是个人使用的 Mihomo 配置编译与静态发布项目。`config/**/*.yaml` 是唯一人工业务配置源，严格 TypeScript 负责配置编译、语义校验、运行时装配、构建和发布工具。

主要产物：

- `dist/v2/override.js`：供 Mihomo Party、Clash Verge Rev 和 Sub-Store Mihomo 配置覆写共享。
- `dist/v2/rename.js`：供 Sub-Store 节点列表“脚本操作”使用。

commit message、代码注释、文档和控制台输出统一使用简体中文。

## 工具链与命令

- Node.js >= 24；类型定义以最低支持的 Node 24 API 为准。
- npm 是唯一命令入口；不引入 Makefile、其他包管理器或另一套构建产物。
- 全栈 ESM，TypeScript strict 且 `noEmit`；浏览器 bundle 目标为 ES2020。

```bash
npm ci                      # 按 lockfile 安装依赖
npm run format              # 格式化整个仓库（遵循 .prettierignore）
npm run format:check        # 检查整个仓库格式
npm run lint                # ESLint 全仓库检查
npm run typecheck           # TypeScript 严格类型检查
npm run test                # Vitest 全量测试
npm run config:check        # YAML schema、引用与语义校验
npm run build               # 生成两个单文件 bundle
npm run tools:setup         # 解析或下载锁定的官方 Mihomo
npm run verify:mihomo       # 用官方 Mihomo 验证脱敏完整配置
npm run check               # 本地与 CI 的完整确定性门槛
npm run audit:rules         # 联网 provider 可用性与重叠审计
npm run build:publication   # 构建 Pages/Release 资产
npm run verify:publication  # 校验 manifest、版本与 checksum
```

修改源码、业务配置、工具链、依赖或 workflow 后必须运行 `npm run check`。仅修改 Markdown 时至少运行 `npm run format:check`。依赖变更必须使用 npm，并同步提交 `package-lock.json`。

## 架构边界

- `config/`：唯一手写业务配置；`manifest.yaml` 显式装配全部模块，不做目录隐式发现。
- `src/compiler/`：YAML loader、Zod raw schema、跨文件语义校验与 Project IR。
- `src/domain/`：纯领域逻辑；不得依赖 compiler、apps、tools 或 Node API。
- `src/runtime/`：只通过 type import 消费 Project IR；不得依赖 apps、tools 或 Node API。
- `src/apps/`：override/rename 宿主适配器；两个应用不得互相依赖。
- `src/build/`、`src/tools/`：bundle、官方工具解析、发布资产和 CI 编排。
- `templates/`：生成发布验证配置所需的语法合法、完全脱敏输入。
- `public/rules/`：发布时原样复制的自定义规则资产。
- `tooling/`：Mihomo 版本/checksum 锁和 bundle 大小基线。
- `tests/fixtures/`：虚构端点和脱敏行为输入。
- `tests/expected/`：人工审阅的当前完整输出契约，不参与 Prettier 格式化。
- `.github/workflows/`：CI、Pages、Release 和定时规则审计。

`dist/`、`.cache/` 和 `node_modules/` 均为生成或本地状态，禁止提交；不得手改 `dist/v2/`。

## 核心数据流

```text
config/manifest.yaml
→ YAML 1.2 loader / raw schema
→ semantic validators
→ normalized Project IR
→ override 或 rename runtime
→ host adapter
→ esbuild 单文件 IIFE
```

构建期负责静态结构、引用、顺序、拓扑、路径和敏感字段校验；运行时只处理宿主输入、节点 metadata、动态组装和输出不变量。

## 正式运行时契约

- 人工配置保持 YAML，不迁移为 TypeScript 常量。
- 标准 provider 简写与完整自定义 provider 并存；source 模板不控制目标组或全局顺序。
- runtime 只支持显式 `overlay/replace/if-absent`，不实现通用 deep merge。
- 未受管理的宿主顶层字段默认透传，运行时不得修改调用方输入对象。
- 无任何有效命名代理时，override 抛出结构化 fatal error，不返回部分配置。
- 一跳链路为 `客户端 → 中转 → 落地 → 目标`；IR 只保留未来增加 hop 的边界。
- landing 或 transit 任一端为空时链路不生效，节点保留在普通池并产生 warning。
- 节点已有 `dialer-proxy` 时保留原值并产生 warning。
- Rename 使用 `defaults → profile → $arguments` 三层配置；`profile` 可省略并回落到显式默认项，直接参数只允许受控的格式、订阅 fallback、扩展特征和序号覆盖。
- 三种宿主共享同一份 override bundle；CommonJS bridge 属于当前 Sub-Store 契约，未经宿主证据不得删除。
- QuickJS 实机执行暂不属于正式门槛。

## 测试与预期输出

- 单元测试保护纯函数和单一不变量；集成测试保护配置到 IR/输出；contracts 分别保护四种宿主入口。
- 错误和退化场景优先断言明确不变量，不新增不必要的大型完整快照。
- 不得机械重录 `tests/expected/` 来让测试通过。行为变化必须先明确预期，再同步修改对应 fixture、语义断言和 expected，并人工审阅差异。
- `templates/mihomo/config-input.yaml` 必须保持 Mihomo 语法真实合法；不能使用无法通过官方校验的伪造密钥或协议字段。
- fixtures、expected、日志和发布资产不得包含真实订阅、服务器、UUID、密钥或其他凭据。

## 安全与外部状态

- 原始代理订阅只在内存处理，不写日志、快照、缓存或发布资产。
- 不硬编码 token、密码、私钥、证书或私有 provider 凭据。
- Mihomo 解析顺序固定为 `MIHOMO_BIN` → `PATH` → 按 checksum 锁定的项目缓存。
- 联网规则审计独立运行，不进入普通 `check`，不得用静默 fallback 掩盖上游错误。
- 除非当前用户请求已明确授权，否则创建/推送 tag、创建 Release、删除远端分支、修改公开 URL、变更 Pages/Release workflow、更新 Mihomo lock/checksum 或大规模重录 expected 前必须再次确认。

## CI/CD

- push/PR：运行 `npm run tools:setup && npm run check`。
- `main`：检查成功后通过 GitHub Pages artifact 部署 `/v2/`。
- `v2.*.*` tag：完整检查后创建不可变 GitHub Release。
- weekly/manual：执行远程 provider 可用性和重叠审计。

不使用 `dist`、`gh-pages` 或 `v2` 分支发布本项目产物。发布构建前必须存在与当前示例、Mihomo lock 和实际 Mihomo 版本匹配的验证回执。

## 权威文档

- `docs/DESIGN.md`：设计入口与核心不变量。
- `docs/v2/ARCHITECTURE.md`：架构、技术选型和运行边界。
- `docs/v2/CONFIGURATION.md`：YAML 模块、组装与扩展方式。
- `docs/v2/OPERATIONS.md`：本地、Docker、CI、Pages 和 Release 操作。

指令文件只保留高频、可执行的不变量；字段细节和业务清单以权威文档与当前 schema/config 为准。
