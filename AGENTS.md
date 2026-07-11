# AGENTS.md

本文件为 Codex / 通用 Agent 工具在本仓库内的项目级指令。与 `CLAUDE.md` 内容等价。

## 项目概览

个人使用的 Mihomo 配置编译与发布仓库。`config/**/*.yaml` 是唯一人工业务配置源，严格 TypeScript 负责编译、语义校验和运行时装配。

主要产物：

- `dist/v2/override.js`：Mihomo Party、Clash Verge Rev、Sub-Store Mihomo 配置覆写共享。
- `dist/v2/rename.js`：Sub-Store 节点脚本操作。

commit message、注释、文档与控制台输出统一使用简体中文。

## 常用命令

```bash
npm ci
npm run tools:setup         # 解析或下载锁定的官方 Mihomo
npm run check               # 本地与 CI 的完整门槛
npm run build               # 生成双 bundle
npm run test                # Vitest 全量测试
npm run config:check        # YAML schema 与语义校验
npm run verify:mihomo       # 官方 Mihomo 配置校验
npm run audit:rules         # 联网 provider 审计
npm run build:publication   # Pages/Release 资产
npm run verify:publication  # manifest/checksum 校验
```

修改代码或配置后至少运行 `npm run check`。发布构建前必须先有与当前示例、锁文件和 Mihomo 版本匹配的验证回执。

## 架构边界

- `config/`：唯一手写配置源；`manifest.yaml` 显式列出所有模块。
- `src/compiler/`：YAML loader、Zod raw schema、语义验证与 Project IR。
- `src/domain/`：纯领域逻辑；不得导入 compiler、apps、tools 或 Node API。
- `src/runtime/`：只通过 type import 消费 Project IR；不得依赖 apps、tools 或 Node API。
- `src/apps/`：override/rename 宿主适配器；两个应用不得互相依赖。
- `src/build/`、`src/tools/`：bundle、官方工具解析、发布与 CI 编排。
- `public/rules/`：发布时原样复制的自定义规则资产。
- `tests/fixtures/` 与 `tests/expected/`：脱敏行为输入和经过审阅的当前输出契约。

构建产物位于 `dist/v2/`，禁止手改，也不得提交到 Git。

## 核心数据流

```text
config manifest
→ YAML 1.2 loader / raw schema
→ semantic validators
→ Project IR
→ override 或 rename runtime
→ host adapter
→ esbuild 单文件 IIFE
```

Override 运行时阶段：宿主输入校验、节点解析、链路拓扑、动态/配置策略组、providers/rules、runtime plan、输出校验。

Rename 使用命名 profile；Sub-Store 的 `$arguments` 只在 adapter 解析，不进入 node-domain。

## 关键约定

- 全栈 ESM，TypeScript strict，bundle 目标 ES2020。
- 人写配置保持 YAML；不把配置迁移为 TypeScript 常量。
- 标准 provider 简写和完整自定义 provider 并存。
- runtime 只支持显式 `overlay/replace/if-absent`，不实现通用 deep merge。
- 一跳中转模型为 `客户端 → 中转 → 落地 → 目标`；IR 保留未来多跳拓扑边界。
- 显式管理 Mihomo 字段，其他宿主字段默认透传。
- QuickJS 实机执行暂不属于正式门槛。
- 原始代理订阅只在内存处理，不写日志、快照或发布资产；fixtures 必须脱敏。
- Mihomo 解析优先级固定为 `MIHOMO_BIN` → `PATH` → 锁定 checksum 的项目缓存。
- 联网规则审计独立运行，不进入普通 `check`。

## CI/CD

- push/PR：统一执行 `npm run tools:setup && npm run check`。
- `main`：检查成功后通过 GitHub Pages artifact 部署 `/v2/`。
- `v2.*.*` tag：完整检查后创建不可变 GitHub Release。
- weekly/manual：远程 provider 可用性与重叠审计。

不使用 `dist`、`gh-pages` 或 `v2` 分支发布本项目产物。

## 权威文档

- `docs/v2/ARCHITECTURE.md`
- `docs/v2/CONFIGURATION.md`
- `docs/v2/OPERATIONS.md`
- `docs/DESIGN.md`
