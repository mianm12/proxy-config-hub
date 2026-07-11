declare module "virtual:project-ir" {
  const nodeCatalog: readonly import("../compiler/ir/project-ir.ts").RegionIr[];
  const renameProfiles: readonly import("../compiler/ir/project-ir.ts").RenameProfileIr[];

  export { nodeCatalog, renameProfiles };
}
