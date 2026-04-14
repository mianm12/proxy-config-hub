# AGENTS.md

本文件为 Codex / 通用 Agent 工具在本仓库内的项目级指令。与 `CLAUDE.md` 内容等价，供不同 Agent 运行时读取。

## 项目概览

Mihomo（Clash.Meta）override 脚本与声明式 YAML 规则配置中枢。主要产物是一个单文件 IIFE bundle `dist/scripts/override/main.js`：接收裸的代理订阅，输出包含 DNS、策略组、路由规则的完整 Mihomo 配置。另外也发布一个 Sub-Store 重命名脚本。

语言约定：本仓库的 commit message、注释、文档、控制台输出统一使用**简体中文**，请遵循该约定。

## 常用命令

```bash
npm ci                      # 安装依赖（要求 Node.js >= 24）
npm run rules:build         # 编译 definitions/ YAML → scripts/config/ JS 模块
npm run build               # rules:build + esbuild 打包 + 复制静态资源到 dist/
npm run verify              # 构建后运行 verify:main + verify:migration
npm run example:config      # 构建后生成 dist/example-full-config.yaml
npm run audit:rule-overlap  # 检查规则提供方之间的 domain/IP 重叠（会拉取远程）
```

仓库无测试框架；验证通过 `tools/verify-main.js`（bundle 健全性）与 `tools/verify-yaml-migration.js`（迁移兼容性）完成。

## 架构

### 构建流水线

1. **`tools/yaml-to-js.js`** 将 `definitions/` 下的两个命名空间 YAML 编译为 `scripts/config/` 下的 JS 模块：
   - `definitions/rules/registry/*.yaml` → `scripts/config/rules/*.js`（rule providers、group definitions、inline rules）
   - `definitions/runtime/*.yaml` → `scripts/config/runtime/*.js`（DNS、sniffer、tun、geodata、profile、base）
2. **`build.js`** 通过 esbuild 将 `scripts/override/main.js` 打包为 `dist/scripts/override/main.js`（IIFE，暴露 `globalThis.main`），随后把 `definitions/rules/custom/` 与 `scripts/sub-store/` 拷贝到 `dist/`。

### Override 脚本（`scripts/override/main.js`）

入口：`function main(config)`，接收一个已填充 `proxies` 的 Mihomo 配置对象，返回完整配置。流水线：

1. **`applyRuntimePreset(config)`** —— 合并所有 runtime YAML 预设（DNS、sniffer、tun、geodata、profile、base）。
2. **`buildProxyGroups(proxies, groupDefinitions)`** —— 依据 `groupDefinitions.yaml` 构建 proxy-groups。
3. **`assembleRuleSet(groupDefinitions, ruleProviders, inlineRules)`** —— 先前置 inline rules，再将每个 rule provider 映射到目标策略组，最后追加兜底 `MATCH`。
4. **`validateOutput(config)`** —— 装配完成后校验输出。

共享模块位于 `scripts/override/lib/`。

### 数据模型

- **`definitions/`** 是所有声明式配置的唯一来源。**禁止手动编辑** `scripts/config/`，该目录为生成产物。
- `definitions/rules/registry/` 是活跃规则装配入口，含 group definitions、inline rules、rule providers。
- `definitions/rules/custom/` 为模板/发布资产子目录，原样拷贝到 dist，**不**参与活跃规则装配。
- 构建流程拒绝 `definitions/` 与遗留的 `rules/` 目录并存。

### CI/CD

推送到 `main` → GitHub Actions 执行构建、验证、将 `dist/` 部署到 `dist` 分支、清理 jsDelivr CDN 缓存。

## 关键约定

- 全栈 ESM（`package.json` 中 `"type": "module"`），bundle 目标为 ES2020。
- Override 脚本使用了 ES2018 特性（负向后行断言），兼容 V8/Node，但**不**兼容 iOS 的 JavaScriptCore。
- Rule providers 引用远程 rule-set URL；group definitions 声明 proxy-group 结构。两者均由 YAML 声明、经编译生成 JS。
- Runtime 预设 YAML 文件与 Mihomo 顶层配置键一一对应（dns、sniffer、tun 等）。
