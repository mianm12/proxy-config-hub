# proxy-config-hub

Mihomo 覆写脚本与声明式 YAML 规则配置的统一仓库。

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
https://raw.githubusercontent.com/mianm12/proxy-config-hub/dist/rules/custom/<文件名>
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
| `npm run verify` | 运行打包验证和 YAML 迁移验证 |
| `npm run audit:rule-overlap` | 检测规则集之间的域名/IP 重叠与遮蔽关系（需联网拉取规则文件） |

## CI/CD

推送到 `main` 分支时，GitHub Actions 自动：

1. 安装依赖并构建
2. 运行验证
3. 将 `dist/` 发布到 `dist` 分支
4. 清除 jsdelivr CDN 缓存

## 仓库结构

```text
definitions/
  rules/
    registry/   声明式规则注册表 YAML（编译为 JS）
    custom/     自定义规则模板/资源（复制到 dist，不参与活跃规则装配）
  runtime/      运行时预设 YAML（编译为 JS）

scripts/
  config/
    rules/      从 definitions/rules/registry/ 生成的 JS 模块
    runtime/    从 definitions/runtime/ 生成的 JS 模块
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
  rules/
    custom/         复制的自定义规则资源

tools/
  yaml-to-js.js             YAML 源文件编译器
  check-rule-overlap.js     规则重叠审计工具
  generate-example-config.js  示例配置生成器
  verify-main.js            打包/运行时验证
  verify-yaml-migration.js  YAML 迁移兼容性验证

templates/
  mihomo/       脱敏示例输出和参考固定值
```

## 源数据模型

- `definitions/` 是唯一的声明式 YAML 源目录
- `scripts/config/` 是生成产物，不应手动编辑
- `definitions/rules/custom/` 是模板/发布资产子目录，不属于活跃规则注册表
- 构建工具会拒绝 `rules/` 与 `definitions/` 并存的混合源树

## 相关文档

- 设计文档与历史上下文：[DESIGN.md](DESIGN.md)
- 脱敏 Mihomo 示例配置：[templates/mihomo/config-example.yaml](templates/mihomo/config-example.yaml)
