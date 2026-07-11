import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadRawProject } from "../../../src/compiler/load-raw-project.ts";

describe("v2 config 结构", () => {
  it("只通过 manifest 加载全部声明文件", () => {
    const project = loadRawProject(path.resolve(process.cwd(), "config"));
    const groups = project.modules.flatMap((module) => module.data.groups);
    const providerReferences = project.modules.flatMap((module) =>
      module.data["rule-blocks"].flatMap((block) => block.providers ?? []),
    );

    expect(project.manifest.data["schema-version"]).toBe(2);
    expect(project.runtime).toHaveLength(4);
    expect(project.modules).toHaveLength(11);
    expect(groups).toHaveLength(34);
    expect(providerReferences).toHaveLength(93);
    expect(project.routingRegions.data.regions).toHaveLength(28);
    expect(project.nodeCatalog.data.regions).toHaveLength(27);
    expect(project.renameProfiles.data.profiles).toHaveProperty("pokemon");
    expect(project.renameProfiles.data.profiles).toHaveProperty("self_hosted");
  });
});
