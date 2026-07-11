import { describe, expect, it } from "vitest";

import type { RenameProfileIr } from "../../../src/compiler/ir/project-ir.ts";
import { resolveRenameProfile } from "../../../src/apps/rename/legacy-arguments.ts";
import { ConfigCompilationError } from "../../../src/domain/diagnostics/diagnostic.ts";

const PROFILE: RenameProfileIr = {
  id: "pokemon",
  prefix: "宝可梦",
  prefixPosition: "first",
  separator: "-",
  addFlag: true,
  preserveMultiplier: true,
  collapseSingle: true,
  preserveTags: ["IPLC"],
};

function expectArgumentError(operation: () => unknown): void {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigCompilationError);
    expect((error as ConfigCompilationError).diagnostics[0]?.code).toBe("RENAME_ARGUMENT_INVALID");
    return;
  }
  throw new Error("期望 rename 参数解析失败");
}

describe("rename arguments", () => {
  it("把当前 legacy 参数解析为显式 profile", () => {
    expect(
      resolveRenameProfile(
        {
          bl: "true",
          blkey: "IPLC+REALITY",
          fgf: "%2D",
          flag: true,
          name: "%E8%87%AA%E5%BB%BA",
          nf: true,
          one: true,
        },
        [PROFILE],
      ),
    ).toEqual({
      id: "legacy",
      prefix: "自建",
      prefixPosition: "first",
      separator: "-",
      addFlag: true,
      preserveMultiplier: true,
      collapseSingle: true,
      preserveTags: ["IPLC", "REALITY"],
    });
  });

  it("profile 只允许覆盖分隔符与 collapse-single", () => {
    expect(resolveRenameProfile({ profile: "pokemon", fgf: "%20", one: false }, [PROFILE])).toEqual(
      {
        ...PROFILE,
        separator: " ",
        collapseSingle: false,
      },
    );
    expectArgumentError(() =>
      resolveRenameProfile({ profile: "pokemon", name: "冲突前缀" }, [PROFILE]),
    );
  });

  it("拒绝未知 profile、未知参数和非法布尔值", () => {
    expectArgumentError(() => resolveRenameProfile({ profile: "missing" }, [PROFILE]));
    expectArgumentError(() => resolveRenameProfile({ clear: true }, [PROFILE]));
    expectArgumentError(() => resolveRenameProfile({ flag: "maybe" }, [PROFILE]));
  });
});
