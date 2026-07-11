import fs from "node:fs";
import path from "node:path";

const v2OverridePath = path.resolve(process.cwd(), "dist", "v2", "override.js");

if (!fs.existsSync(v2OverridePath)) {
  throw new Error(
    "尚未生成 dist/v2/override.js；v1/v2 等价比较将在 Override 流水线与 bundle 完成后启用",
  );
}

throw new Error("v1/v2 等价比较器尚未实现，禁止把当前命令视为通过");
