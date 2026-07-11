# v1 行为基线输入

这里的输入只使用虚构端点和脱敏名称，用于锁定 v1 的可观察行为，不是可用订阅。

- `override/`：由当前 v1 bundle 的 `main(config)` 执行。
- `rename/`：由隔离 VM 中的旧 Sub-Store `operator` 执行。
- `npm run baseline:v1:check` 只校验，不修改 golden。
- `npm run baseline:v1:update` 仅在明确审阅 v1 行为变化后使用。

golden 保存完整结构化输出和宿主可见日志；源文件摘要与组、provider、地区顺序保存在
`tests/golden/v1-inventory.json`。
