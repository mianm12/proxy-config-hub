# proxy-config-hub

个人使用的 Mihomo（Clash.Meta）配置编译与发布仓库。人工配置使用 YAML，严格 TypeScript 负责编译、语义校验、运行时装配与发布。

项目生成两个独立的单文件产物：

- `dist/v2/override.js`：供 Mihomo Party、Clash Verge Rev 和 Sub-Store Mihomo 配置覆写共用。
- `dist/v2/rename.js`：供 Sub-Store 节点列表脚本操作使用。

## 远程使用

稳定 Pages 地址：

```text
https://www.quietus.icu/proxy-config-hub/v2/override.js
https://www.quietus.icu/proxy-config-hub/v2/rename.js
https://www.quietus.icu/proxy-config-hub/v2/manifest.json
```

Sub-Store 节点重命名必须选择“脚本操作”，不要选择内置“重命名操作”：

```text
https://www.quietus.icu/proxy-config-hub/v2/rename.js#noCache
https://www.quietus.icu/proxy-config-hub/v2/rename.js#profile=airport#noCache
https://www.quietus.icu/proxy-config-hub/v2/rename.js#profile=airport#subscriptionFallback=MyAirport#noCache
https://www.quietus.icu/proxy-config-hub/v2/rename.js#profile=self_hosted#noCache
```

默认格式为 `[订阅名] 🇭🇰 HK [协议] 特征 倍率 01`。`airport` profile 会自动使用 Sub-Store 节点上的订阅名，可供不同机场共用；缺少订阅元数据时通过 `subscriptionFallback` 手动补名。其他受控参数可覆盖字段、分隔符、方括号、扩展特征和序号模式，具体见 `docs/v2/CONFIGURATION.md`。

Pages 是持续更新通道；[GitHub Release v2.0.0](https://github.com/mianm12/proxy-config-hub/releases/tag/v2.0.0) 是按版本固定、可用于回滚的不可变通道。公开 manifest 包含当前 commit、Mihomo 版本、artifact URL 与 SHA-256。

## 本地验证

要求 Node.js >= 24 与 npm：

```bash
npm ci
npm run tools:setup
npm run check
```

`tools:setup` 按以下优先级解析 Mihomo：

1. `MIHOMO_BIN` 显式路径。
2. `PATH` 中已有的 `mihomo`。
3. 项目缓存中由 `tooling/mihomo.lock.json` 锁定版本和 checksum 的官方二进制。

Ubuntu Docker 可直接运行：

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -w /workspace \
  node:24-bookworm \
  bash -lc 'npm ci && npm run tools:setup && npm run check'
```

## 常用命令

| 命令                         | 作用                                  |
| ---------------------------- | ------------------------------------- |
| `npm run config:check`       | 编译并校验全部 YAML、引用与顺序约束   |
| `npm run build`              | 生成 override 与 rename bundle        |
| `npm run test`               | 运行单元、集成、golden 与宿主契约测试 |
| `npm run verify:mihomo`      | 用锁定的官方 Mihomo 校验完整脱敏配置  |
| `npm run check`              | 本地与 CI 共用的完整确定性门槛        |
| `npm run audit:rules`        | 联网检查 provider 可用性、重叠与遮蔽  |
| `npm run build:publication`  | 构建 Pages/Release 发布资产           |
| `npm run verify:publication` | 校验 manifest、版本和全部 checksum    |

## 架构

```text
config/**/*.yaml
  → YAML loader + Zod raw schema
  → semantic validators
  → Project IR
  → override / rename runtime
  → esbuild 单文件 IIFE
  → dist/v2/
```

- `config/`：唯一人工业务配置源，由 `config/manifest.yaml` 显式装配。
- `src/compiler/`：YAML 加载、raw schema、语义校验与规范化 Project IR。
- `src/domain/`：不依赖宿主、文件系统或 Node API 的共享领域逻辑。
- `src/runtime/`：override 与 rename 的纯运行时装配。
- `src/apps/`：宿主入口适配器。
- `src/tools/`、`src/build/`：本地/CI 工具和 bundle/发布构建。
- `public/rules/`：原样发布的自定义规则资产。
- `tests/`：脱敏 fixtures、审阅后的 expected 输出、领域测试和四种宿主契约。

配置模块、人类可读语法、链路模型和 provider 扩展方式见 [配置设计](docs/v2/CONFIGURATION.md)。

## CI/CD

- 普通 push/PR：运行 `npm run tools:setup` 与 `npm run check`。
- `main` 成功：构建 GitHub Pages artifact 并部署 `/v2/` 稳定通道。
- `v2.*.*` tag：完整验证后创建 GitHub Release 并上传不可变资产。
- 每周/手动：运行远程 provider 审计，不阻塞普通发布。

`dist/` 和工具缓存不会提交到 Git；Pages 使用 Actions artifact，不使用 `dist` 或 `gh-pages` 发布分支。

## 文档

- [架构设计](docs/v2/ARCHITECTURE.md)
- [配置设计](docs/v2/CONFIGURATION.md)
- [运维说明](docs/v2/OPERATIONS.md)
- [设计入口](docs/DESIGN.md)
