import path from "node:path";

import { loadRawProject } from "../compiler/load-raw-project.ts";

const project = loadRawProject(path.resolve(process.cwd(), "config"));
const groupCount = project.modules.reduce((count, module) => count + module.data.groups.length, 0);
const ruleBlockCount = project.modules.reduce(
  (count, module) => count + module.data["rule-blocks"].length,
  0,
);

console.log(
  `v2 raw config 结构校验通过：${String(project.modules.length)} 个模块，` +
    `${String(groupCount)} 个策略组，${String(ruleBlockCount)} 个规则块`,
);
