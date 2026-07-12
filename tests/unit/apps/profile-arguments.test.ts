import { describe, expect, it } from "vitest";

import type { RenameProfileIr } from "../../../src/compiler/ir/project-ir.ts";
import { resolveRenameProfile } from "../../../src/apps/rename/profile-arguments.ts";
import { ConfigCompilationError } from "../../../src/domain/diagnostics/diagnostic.ts";

const PROFILE: RenameProfileIr = {
  id: "standard",
  fields: ["subscription", "flag", "iso", "protocol", "traits", "multiplier", "sequence"],
  separator: " ",
  brackets: ["subscription", "protocol"],
  subscriptionFallback: null,
  extraTraits: [],
  sequence: "always",
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
  it("无参数时使用默认 profile，并忽略 noCache", () => {
    expect(resolveRenameProfile({}, [PROFILE], "standard")).toEqual(PROFILE);
    expect(resolveRenameProfile({ noCache: true }, [PROFILE], "standard")).toEqual(PROFILE);
  });

  it("显式参数逐项覆盖 profile，并对列表执行整体替换", () => {
    expect(
      resolveRenameProfile(
        {
          fields: "subscription%2Ciso%2Cprotocol%2Csequence",
          separator: "%2D",
          brackets: "protocol",
          subscriptionFallback: "%E8%8A%82%E7%82%B9",
          extraTraits: "DMIT%2CproWee",
          sequence: "duplicates",
        },
        [PROFILE],
        "standard",
      ),
    ).toEqual({
      ...PROFILE,
      fields: ["subscription", "iso", "protocol", "sequence"],
      separator: "-",
      brackets: ["protocol"],
      subscriptionFallback: "节点",
      extraTraits: ["DMIT", "proWee"],
      sequence: "duplicates",
    });
  });

  it("接受 URI 编码的 profile id", () => {
    const encoded = { ...PROFILE, id: "标准" };
    expect(resolveRenameProfile({ profile: "%E6%A0%87%E5%87%86" }, [encoded], "standard")).toEqual(
      encoded,
    );
  });

  it("允许直接参数清空括号、订阅 fallback 和扩展词", () => {
    expect(
      resolveRenameProfile(
        { brackets: "", subscriptionFallback: "", extraTraits: "" },
        [{ ...PROFILE, subscriptionFallback: "节点", extraTraits: ["DMIT"] }],
        "standard",
      ),
    ).toEqual({ ...PROFILE, brackets: [], subscriptionFallback: null, extraTraits: [] });
  });

  it("duplicates 模式要求稳定非空字段", () => {
    expectArgumentError(() =>
      resolveRenameProfile(
        { fields: "sequence", brackets: "", sequence: "duplicates" },
        [PROFILE],
        "standard",
      ),
    );
    expect(
      resolveRenameProfile(
        { fields: "protocol,sequence", brackets: "", sequence: "duplicates" },
        [PROFILE],
        "standard",
      ),
    ).toEqual({
      ...PROFILE,
      fields: ["protocol", "sequence"],
      brackets: [],
      sequence: "duplicates",
    });
    expect(
      resolveRenameProfile(
        {
          fields: "subscription,sequence",
          brackets: "subscription",
          subscriptionFallback: "机场",
          sequence: "duplicates",
        },
        [PROFILE],
        "standard",
      ),
    ).toEqual({
      ...PROFILE,
      fields: ["subscription", "sequence"],
      brackets: ["subscription"],
      subscriptionFallback: "机场",
      sequence: "duplicates",
    });
  });

  it("拒绝未知参数、未知 profile 和非法字段组合", () => {
    expectArgumentError(() => resolveRenameProfile({ profile: "missing" }, [PROFILE], "standard"));
    expectArgumentError(() => resolveRenameProfile({ clear: "true" }, [PROFILE], "standard"));
    expectArgumentError(() =>
      resolveRenameProfile({ fields: "subscription,protocol" }, [PROFILE], "standard"),
    );
    expectArgumentError(() =>
      resolveRenameProfile(
        { fields: "iso,sequence", brackets: "subscription" },
        [PROFILE],
        "standard",
      ),
    );
    expectArgumentError(() =>
      resolveRenameProfile({ extraTraits: "DMIT,dmit" }, [PROFILE], "standard"),
    );
    expectArgumentError(() => resolveRenameProfile({ separator: "%" }, [PROFILE], "standard"));
    expectArgumentError(() => resolveRenameProfile({ separator: "%0A" }, [PROFILE], "standard"));
    expectArgumentError(() => resolveRenameProfile({ separator: "%C2%85" }, [PROFILE], "standard"));
    expectArgumentError(() =>
      resolveRenameProfile({ subscriptionFallback: "%20" }, [PROFILE], "standard"),
    );
    expectArgumentError(() =>
      resolveRenameProfile({ extraTraits: "DMIT%0Afoo" }, [PROFILE], "standard"),
    );
    expectArgumentError(() =>
      resolveRenameProfile({ extraTraits: "DMIT%C2%9Bfoo" }, [PROFILE], "standard"),
    );
  });
});
