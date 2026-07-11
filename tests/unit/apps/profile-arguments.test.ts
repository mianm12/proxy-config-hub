import { describe, expect, it } from "vitest";

import type { RenameProfileIr } from "../../../src/compiler/ir/project-ir.ts";
import { resolveRenameProfile } from "../../../src/apps/rename/profile-arguments.ts";
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
  it("按 profile id 解析命名配置", () => {
    expect(resolveRenameProfile({ profile: "pokemon" }, [PROFILE])).toBe(PROFILE);
    expect(resolveRenameProfile({ profile: "pokemon", noCache: true }, [PROFILE])).toBe(PROFILE);
  });

  it("接受 URI 编码的 profile id", () => {
    const encoded = { ...PROFILE, id: "宝可梦" };
    expect(resolveRenameProfile({ profile: "%E5%AE%9D%E5%8F%AF%E6%A2%A6" }, [encoded])).toBe(
      encoded,
    );
  });

  it("拒绝缺失、未知或携带旧参数的 profile", () => {
    expectArgumentError(() => resolveRenameProfile({}, [PROFILE]));
    expectArgumentError(() => resolveRenameProfile({ profile: "missing" }, [PROFILE]));
    expectArgumentError(() => resolveRenameProfile({ clear: true }, [PROFILE]));
    expectArgumentError(() =>
      resolveRenameProfile({ profile: "pokemon", blkey: "IPLC" }, [PROFILE]),
    );
  });
});
