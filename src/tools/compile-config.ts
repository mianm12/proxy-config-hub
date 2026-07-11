import path from "node:path";

import { compileProject } from "../compiler/compile-project.ts";

const project = compileProject(path.resolve(process.cwd(), "config"));

console.log(
  `v2 Project IR 编译通过：${String(project.groups.length)} 个策略组，` +
    `${String(project.providers.length)} 个 providers，${String(project.routingRegions.length)} 个路由地区`,
);
