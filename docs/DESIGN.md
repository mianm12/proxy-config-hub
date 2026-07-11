# proxy-config-hub 设计入口

当前实现为 v2。历史 v1 的 YAML → 生成 JS → bundle 双重真相源已经删除；迁移过程与等价证据保留在 `docs/v2/MIGRATION.md` 和历史 golden fixtures 中。

## 架构结论

- 项目只服务个人 Mihomo 配置，是强约定的配置编译器，不是通用订阅平台。
- 人工配置使用 YAML；编译器、领域模型、适配器、校验器和工具使用严格 TypeScript。
- `override` 与 `rename` 是两个独立应用，只共享窄的 node-domain。
- Mihomo Party、Clash Verge Rev 与 Sub-Store 共用一份 override bundle。
- Sub-Store rename 单独发布 operator bundle。
- Pages `/v2/` 是持续更新通道；GitHub Release 是不可变回滚通道。

## 数据流

```text
config/manifest.yaml
  → YAML loader + raw schema
  → semantic validators
  → normalized Project IR
  → runtime domain pipeline
  → host adapter
  → esbuild IIFE
  → dist/v2/
```

构建期负责所有静态引用、顺序、拓扑、路径和安全边界；运行时只处理宿主输入、节点分类、动态组装与输出不变量。官方 Mihomo 二进制是最终配置语法验证器。

## 配置与源码

- `config/`：唯一人工业务配置源。
- `src/compiler/`：配置编译器与 Project IR。
- `src/domain/`：共享纯领域模型。
- `src/runtime/`：override/rename 运行时。
- `src/apps/`：宿主契约适配器。
- `src/build/`、`src/tools/`：构建、验证、发布和远程审计。
- `public/rules/`：原样发布的自定义规则资产。
- `tests/`：单元、集成、历史 golden、宿主契约和工具链测试。

## 不变量

- `config/manifest.yaml` 显式装配所有模块，不进行目录隐式发现。
- raw schema strict；只有显式 `mihomo` 区允许原生字段透传。
- 策略组布局、规则 pipeline 和 provider source 分离。
- 标准 provider 简写不能替代完整自定义 provider。
- runtime apply 使用显式模式，不实现通用 deep merge。
- 节点地区、标签、倍率与订阅元数据由共享 node-domain 处理。
- 一跳中转不会形成环，已有 `dialer-proxy` 不被覆盖。
- 未受管理的宿主顶层字段默认透传。
- bundle 不包含 Node API、YAML/Zod 编译器、源绝对路径或 secret。
- `dist/` 与工具缓存不进入 Git。

## 权威文档

- [架构与技术选型](v2/ARCHITECTURE.md)
- [YAML 配置模型](v2/CONFIGURATION.md)
- [迁移、验收与回滚](v2/MIGRATION.md)
- [本地、Docker、CI、Pages 与 Release 运维](v2/OPERATIONS.md)
