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
npm run verify              # 构建后运行 verify:main
npm run example:config      # 构建后生成 dist/example-full-config.yaml
npm run audit:rule-overlap  # 检查规则提供方之间的 domain/IP 重叠（会拉取远程）
```

仓库无测试框架；验证通过 `tools/verify-main.js`（bundle 健全性）完成。

## 架构

### 构建流水线

1. **`tools/yaml-to-js.js`** 将 `definitions/` 下的三个命名空间 YAML 编译为 `scripts/config/` 下的 JS 模块：
   - `definitions/mihomo-preset/*.yaml` → `scripts/config/mihomo-preset/*.js`（base、dns、sniffer、tun、profile、geodata）
   - `definitions/proxy-groups/*.yaml` → `scripts/config/proxy-groups/*.js`（groupDefinitions、regions、placeholders、chains）
   - `definitions/rules/*.yaml` → `scripts/config/rules/*.js`（inlineRules、ruleProviders）
2. **`build.js`** 通过 esbuild 将 `scripts/override/main.js` 打包为 `dist/scripts/override/main.js`（IIFE，暴露 `globalThis.main`），随后按 `tools/lib/paths.js:COPY_ASSETS` 将静态资源拷贝到 `dist/`。

### Override 脚本（`scripts/override/main.js`）

入口：`function main(config)`，接收一个已填充 `proxies` 的 Mihomo 配置对象，返回完整配置。流水线：

1. **`applyRuntimePreset(config)`** —— 合并所有 runtime YAML 预设（DNS、sniffer、tun、geodata、profile、base）。
2. **`buildProxyGroups(proxies, groupDefinitions)`** —— 依据 `groupDefinitions.yaml` 构建 proxy-groups，region 匹配与 placeholder 映射分别来自 `regions.yaml`、`placeholders.yaml`。
3. **`assembleRuleSet(groupDefinitions, ruleProviders, inlineRules)`** —— 先前置 inline rules，再将每个 rule provider 映射到目标策略组，最后追加兜底 `MATCH`。
4. **`validateOutput(config)`** —— 装配完成后校验输出。

共享模块位于 `scripts/override/lib/`。其中 `proxy-groups.js` 的 region 模式与 placeholder 映射从编译产物 `scripts/config/proxy-groups/regions.js`、`scripts/config/proxy-groups/placeholders.js` 加载，不硬编码。

### 数据模型

- **`definitions/`** 是所有声明式配置的唯一来源。**禁止手动编辑** `scripts/config/`，该目录为生成产物。
- `definitions/rules/` 是活跃规则装配入口（inlineRules + ruleProviders）。
- `definitions/proxy-groups/` 存放 proxy-group / chain 构建数据（groupDefinitions、regions、placeholders、chains）。
- `definitions/mihomo-preset/` 存放 Mihomo 顶层键预设（base、dns、sniffer、tun、profile、geodata）。
- `definitions/assets/custom/` 为模板/发布资产，原样拷贝到 `dist/assets/custom/`，**不**参与活跃规则装配。
- `definitions/proxy-groups/regions.yaml` 定义 region 匹配模式（id、name、icon、regex pattern、flags）；新增 region 只需追加条目，无需改 JS。
- `definitions/proxy-groups/placeholders.yaml` 定义保留组 ID、兜底组 ID 与 `@` 前缀 placeholder 映射；新增 placeholder 只需追加条目，无需改 JS。
- 构建流程拒绝 `definitions/` 下出现未知的顶层子目录。
- `tools/verify-main.js` 会动态扫描 `definitions/` 推导期望产物；新增 YAML 文件无需同步修改验证脚本。

### CI/CD

推送到 `main` → GitHub Actions 执行构建、验证、将 `dist/` 部署到 `dist` 分支、清理 jsDelivr CDN 缓存。

## 关键约定

- 全栈 ESM（`package.json` 中 `"type": "module"`），bundle 目标为 ES2020。
- Override 脚本使用了 ES2018 特性（负向后行断言），兼容 V8/Node，但**不**兼容 iOS 的 JavaScriptCore。
- Rule providers 引用远程 rule-set URL；group definitions 声明 proxy-group 结构。两者均由 YAML 声明、经编译生成 JS。
- Runtime 预设 YAML 文件与 Mihomo 顶层配置键一一对应（dns、sniffer、tun 等）。
- 所有路径常量集中在 `tools/lib/paths.js`，各 tool 脚本不得硬编码路径。
- 文件系统工具通过 `tools/lib/fs-helpers.js` 共享，不得在各脚本中重复实现 `pathExists` / `copyDirectory` 等。
- 设计文档位于 `docs/DESIGN.md`。
