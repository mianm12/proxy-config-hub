import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_ROOT = path.join(REPO_ROOT, "config");
const DIST_V2_ROOT = path.join(REPO_ROOT, "dist", "v2");
const RENAME_ENTRY = path.join(REPO_ROOT, "src", "apps", "rename", "entry.ts");
const RENAME_BUNDLE = path.join(DIST_V2_ROOT, "rename.js");

export { CONFIG_ROOT, DIST_V2_ROOT, RENAME_BUNDLE, RENAME_ENTRY, REPO_ROOT };
