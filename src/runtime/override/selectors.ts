import type { NodeSelectorIr } from "../../compiler/ir/project-ir.ts";

function matchesSelector(name: string, selector: NodeSelectorIr): boolean {
  if (selector.kind === "regex") return new RegExp(selector.pattern, selector.flags).test(name);

  const lowerName = name.toLocaleLowerCase("en-US");
  const anyMatch =
    selector.anyName.length > 0 &&
    selector.anyName.some((keyword) => lowerName.includes(keyword.toLocaleLowerCase("en-US")));
  const allMatch =
    selector.allNames.length > 0 &&
    selector.allNames.every((keyword) => lowerName.includes(keyword.toLocaleLowerCase("en-US")));
  return anyMatch || allMatch;
}

export { matchesSelector };
