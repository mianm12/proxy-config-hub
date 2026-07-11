# 历史 v1 行为基线输入

这里的输入只使用虚构端点和脱敏名称，用于锁定 v1 的可观察行为，不是可用订阅。

- `override/`：迁移前由 v1 bundle 的 `main(config)` 生成预期行为。
- `rename/`：迁移前由隔离 VM 中的旧 Sub-Store `operator` 生成预期行为。
- 当前 `npm run verify:golden` 只校验 v2 是否保持这些冻结行为，不提供自动更新命令。
- 行为变更必须显式修改对应测试和 golden，不得机械重录快照。

golden 保存完整结构化输出和宿主可见日志；迁移时的源文件摘要与组、provider、地区顺序保存在 `tests/golden/v1-inventory.json`。其中 v1 文件摘要只作为历史审计证据保留。
