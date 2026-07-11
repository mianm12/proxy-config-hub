# proxy-config-hub

Mihomo 覆写脚本与声明式 YAML 规则配置的统一仓库。

> `rewrite/v2` 正在并行实现 v2。当前远程 URL 与 `main` 发布流程仍指向 v1；v2 已具备本地构建、测试、Mihomo 校验和发布 dry-run，但尚未切换公开通道。

## v2 并行实现

v2 以 `config/**/*.yaml` 作为人工配置源，TypeScript 负责编译、语义校验与运行时装配。它生成两份互相独立、共享窄 node-domain 的单文件产物：

- `dist/v2/override.js`：Mihomo Party、Clash Verge Rev、Sub-Store Mihomo 配置覆写共用。
- `dist/v2/rename.js`：Sub-Store 节点重命名 operator。

本地完整门槛：

```bash
npm ci
npm run tools:setup
npm run check:v2
```

`tools:setup` 按 `MIHOMO_BIN`、`PATH`、项目缓存的顺序解析 Mihomo；缓存缺失时下载 `tooling/mihomo.lock.json` 锁定的官方资产并校验 SHA-256。Ubuntu Docker、CI 与本地使用同一套 npm 命令，详见 [v2 运维说明](docs/v2/OPERATIONS.md)。

## 远程使用

构建产物自动发布到 `dist` 分支，可通过以下方式引用。

### Mihomo 覆写脚本

GitHub Raw（推荐，更新即时生效）：

```
https://raw.githubusercontent.com/mianm12/proxy-config-hub/dist/scripts/override/main.js
```

jsdelivr CDN（有缓存，CI 自动 purge，但可能有数秒传播延迟）：

```
https://cdn.jsdelivr.net/gh/mianm12/proxy-config-hub@dist/scripts/override/main.js
```

在 Sub-Store 中作为脚本操作使用，填入上述任一链接即可。

### Sub-Store 节点重命名脚本

```
https://raw.githubusercontent.com/mianm12/proxy-config-hub/dist/scripts/sub-store/rename.js
```

在 Sub-Store 的脚本操作中添加，支持 `#` 传参，具体用法见脚本头部注释。

### 自定义规则资源

```
https://raw.githubusercontent.com/mianm12/proxy-config-hub/dist/assets/custom/<文件名>
```

## 本地开发

环境要求：Node.js >= 24，包管理器 npm。

```bash
npm ci          # 安装依赖
npm run build   # 编译 YAML + 打包
npm run verify  # 运行验证
```

### npm scripts

| 命令 | 说明 |
|------|------|
| `npm run rules:build` | 将 `definitions/` 下的声明式 YAML 编译为 `scripts/config/` 下的 JS 模块 |
| `npm run build` | 执行 `rules:build`，用 esbuild 打包覆写入口，复制自定义规则和 Sub-Store 脚本到 `dist/` |
| `npm run example:config` | 构建后生成完整示例配置到 `dist/example-full-config.yaml`；支持 `-- <路径>` 或 `-- -` 输出到 stdout |
| `npm run verify` | 运行打包验证 |
| `npm run audit:rule-overlap` | 检测规则集之间的域名/IP 重叠与遮蔽关系（需联网拉取规则文件） |
| `npm run build:v2` | 编译 v2 配置并生成双应用 bundle |
| `npm run test:v2` | 运行 v2 单元、集成、golden 与宿主契约测试 |
| `npm run compare:v1-v2` | 比较 v1/v2 代表性结构化输出 |
| `npm run tools:setup` | 按固定优先级准备锁定的 Mihomo 工具 |
| `npm run check:v2` | 执行 v2 全部门槛并再次验证 v1 |
| `npm run build:publication` | 生成 v2 Pages/Release dry-run 资产 |
| `npm run build:site` | 使用同一发布构建器生成 Pages artifact 内容 |
| `npm run verify:publication` | 校验 manifest、版本与全部发布 checksum |

## CI/CD

推送到 `main` 分支时，GitHub Actions 自动：

1. 安装依赖并构建
2. 运行验证
3. 将 `dist/` 发布到 `dist` 分支
4. 清除 jsdelivr CDN 缓存

以上仍是 v1 稳定通道。v2 另有独立 CI、Pages artifact dry-run、tag Release 和 weekly rule audit 工作流；Pages dry-run 不执行部署。

## 仓库结构

```text
definitions/
  mihomo-preset/   直接合并到 Mihomo 顶层键的预设 YAML（base/dns/sniffer/tun/profile/geodata）
  proxy-groups/    策略组与链式代理构建数据 YAML（groupDefinitions/regions/placeholders/chains）
  rules/           分流规则装配 YAML（inlineRules/ruleProviders）
  assets/          仅复制到 dist 的资产，不参与脚本装配
    custom/        自定义规则模板

scripts/
  config/
    mihomo-preset/  从 definitions/mihomo-preset/ 生成的 JS 模块
    proxy-groups/   从 definitions/proxy-groups/ 生成的 JS 模块
    rules/          从 definitions/rules/ 生成的 JS 模块
  override/
    main.js     Mihomo 覆写单入口
    lib/        运行时预设、代理分组、规则装配、输出验证等辅助模块
  sub-store/
    rename.js   Sub-Store 节点重命名脚本

dist/               构建产物（发布到 dist 分支）
  scripts/
    override/
      main.js       自包含的 IIFE bundle，暴露 globalThis.main
    sub-store/
      rename.js     原样复制的 Sub-Store 脚本
  assets/
    custom/         复制的自定义规则资源

tools/
  yaml-to-js.js             YAML 源文件编译器
  check-rule-overlap.js     规则重叠审计工具
  generate-example-config.js  示例配置生成器
  verify-main.js            打包/运行时验证

templates/
  mihomo/       脱敏示例输出和参考固定值
```

## 源数据模型

- `definitions/` 是唯一的声明式 YAML 源目录；`scripts/config/` 是生成产物，不应手动编辑
- `definitions/mihomo-preset/` 中每个 YAML 对应一个 Mihomo 顶层键（或顶层键集合）的预设
- `definitions/proxy-groups/` 决定最终 `proxy-groups:` 数组与（对 chains 而言）`proxies:` 中 landing 节点的 `dialer-proxy` 字段
- `definitions/rules/` 决定最终 `rules:` 与 `rule-providers:`
- `definitions/assets/` 仅按 `tools/lib/paths.js:COPY_ASSETS` 原样复制到 `dist/assets/`，不参与脚本装配

## 相关文档

- 当前 v1 设计文档与历史上下文：[DESIGN.md](docs/DESIGN.md)
- v2 重构设计：[架构](docs/v2/ARCHITECTURE.md) / [配置模型](docs/v2/CONFIGURATION.md) / [迁移计划](docs/v2/MIGRATION.md) / [运维说明](docs/v2/OPERATIONS.md)
- 脱敏 Mihomo 示例配置：[templates/mihomo/config-example.yaml](templates/mihomo/config-example.yaml)
