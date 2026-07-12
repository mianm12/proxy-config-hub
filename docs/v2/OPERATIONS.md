# proxy-config-hub v2 运维说明

本文覆盖当前版本的本地、Ubuntu Docker、CI、Pages 与 Release 操作。

## 1. 本地完整验证

环境要求：Node.js >= 24、npm，以及 macOS 或 Linux 的 x64/arm64 环境。

```bash
npm ci
npm run tools:setup
npm run check
```

`check` 依次执行格式、lint、类型、YAML schema/语义编译、双 bundle、全部测试和真实 Mihomo 配置检查。

`npm run tools:setup` 使用固定优先级：

1. `MIHOMO_BIN` 显式路径；路径无效时直接失败。
2. `PATH` 中可执行的 `mihomo`。
3. `.cache/tools/mihomo/<version>/<platform>/mihomo`。

第三层使用 `tooling/mihomo.lock.json` 锁定的 [MetaCubeX/mihomo 官方 Release](https://github.com/MetaCubeX/mihomo/releases) 资产。下载 URL 固定为：

```text
https://github.com/MetaCubeX/mihomo/releases/download/<version>/<asset>
```

归档必须通过锁定 SHA-256 才会解压；最终二进制通过临时文件原子写入缓存。`verify:mihomo` 使用项目内 `.cache/validation/mihomo` 作为数据目录，不写用户的 `~/.config/mihomo`。

## 2. Ubuntu Docker

仓库本身是配置编译与静态发布项目，不需要常驻应用进程。在 Ubuntu 服务器可用一次性 Node 容器执行与本地相同的命令：

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -w /workspace \
  node:24-bookworm \
  bash -lc 'npm ci && npm run tools:setup && npm run check'
```

如需复用下载缓存，可额外挂载宿主目录到 `/workspace/.cache`。容器架构为 linux-x64 或 linux-arm64 时，会选择对应的锁定官方资产。

## 3. 构建与发布 dry-run

发布构建要求当前 `example-full-config.yaml` 已通过真实 Mihomo 校验；`npm run check` 会原子写入与示例摘要、实际 Mihomo 版本和锁文件版本绑定的本地验证回执。配置、锁文件或示例变化后直接发布会失败，必须重新执行完整门槛。

```bash
npm run build:publication
npm run verify:publication
```

Pages workflow 使用等价别名 `npm run build:site`，两者调用同一 Node 构建器。

输出位于 `dist/v2/`：

```text
override.js
rename.js
example-full-config.yaml
manifest.json
checksums.txt
rules/
rules.tar.gz
```

`manifest.json` 记录项目版本、schema 版本、commit、构建时间、验证所用 Mihomo 版本，以及 Pages 可访问文件的 SHA-256。`checksums.txt` 精确覆盖 Release 上传的 override、rename、脱敏示例、manifest 和规则资产包；Release 资产不得覆盖已发布版本。

设置 `PUBLIC_BASE_URL=https://www.quietus.icu/proxy-config-hub` 时，构建器会结合 manifest 的 `deployment.channel: v2` 为每个 artifact 生成绝对 URL。该地址来自用户站点自定义域名对项目站点的继承；以后改用独立子域名只需更换该环境变量并重新构建，不修改业务配置。

## 4. GitHub Actions

- `ci.yaml`：所有 push/PR 执行 `tools:setup + check`；push 还生成 Pages artifact，只有 `main` 部署稳定 Pages。
- `pages.yaml`：reusable Pages 构建，运行完整检查并通过官方 `upload-pages-artifact` 上传 `dist/`。
- `release.yaml`：只有推送 `v2.*.*` tag 才执行完整校验并创建 GitHub Release。
- `rule-audit.yaml`：每周及手动执行远程 provider 可用性和重叠审计，不阻塞普通发布。

tag 必须精确等于 `v<package.json version>`。当前首个版本为 `v2.0.0`；创建并推送 tag 代表人工发布授权。

首个不可变版本已发布并验证：[v2.0.0](https://github.com/mianm12/proxy-config-hub/releases/tag/v2.0.0)。Release 下载后的 checksum、manifest commit 和 override/rename 契约均已复核。

Pages 部署使用 `github-pages` environment、`pages: write` 与 OIDC `id-token: write`，并按 `pages-production` concurrency group 串行执行。非 `main` push 只生成可审阅 artifact，不创建 deployment。

稳定 URL：

```text
https://www.quietus.icu/proxy-config-hub/v2/override.js
https://www.quietus.icu/proxy-config-hub/v2/rename.js
https://www.quietus.icu/proxy-config-hub/v2/manifest.json
```

这些 URL 已通过 HTTPS、CORS、MIME、manifest checksum 与远程 bundle 契约验证。Sub-Store 与 Mihomo Party 已实机加载成功；Clash Verge Rev 尚未安装，用户明确接受其 `main(config, profileName)` 契约测试替代本次实机加载。

## 5. 宿主契约

- Mihomo Party：`main(config)`。
- Clash Verge Rev：`main(config, profileName)`；首期保留但不消费 `profileName`。
- Sub-Store Mihomo 配置覆写：`main(config)`，同时提供宿主契约测试覆盖的 CommonJS bridge。
- Sub-Store 节点脚本：`operator(proxies, targetPlatform, context)`，配置来自默认 profile、可选 `$arguments.profile` 和受控直接参数。

三种 override 宿主必须引用同一份 `override.js`，rename 单独引用 `rename.js`。首期不把 QuickJS 真实执行加入正式门槛。

### 5.1 Sub-Store 操作位置

Mihomo 配置覆写和节点重命名是两条不同调用链：

- Mihomo 配置的“脚本操作”加载 `override.js`，入口是 `main(config)`。
- 节点列表的“脚本操作”加载 `rename.js#noCache` 或 `rename.js#profile=<id>&noCache`，入口是 `operator(proxies, targetPlatform, context)`。

节点重命名不要选择 Sub-Store 内置“重命名操作”。v2 rename 的默认结果形如 `[订阅名] 🇭🇰 HK [hysteria2] 家宽 直连 01`；若仍看到原始节点名或内置重命名格式，应检查操作类型和脚本日志。

当前链接：

```text
https://www.quietus.icu/proxy-config-hub/v2/rename.js#noCache
https://www.quietus.icu/proxy-config-hub/v2/rename.js#profile=airport&noCache
https://www.quietus.icu/proxy-config-hub/v2/rename.js#profile=airport&subscriptionFallback=MyAirport&noCache
https://www.quietus.icu/proxy-config-hub/v2/rename.js#profile=self_hosted&noCache
```

`airport` 是通用机场 profile：优先使用节点的 Sub-Store 订阅名，不绑定固定机场。若当前处理链没有提供有效订阅元数据，可传入 URI 编码后的 `subscriptionFallback=<名称>`。

## 6. 当前发布状态

`main` 是 Pages 稳定发布源，`v2.*.*` tag 是不可变 Release 授权。

宿主验收已经完成：Sub-Store 与 Mihomo Party 实机成功，Clash Verge Rev 由用户接受契约测试作为替代验收。

自定义域名仍可后续决定；业务配置不依赖域名。
