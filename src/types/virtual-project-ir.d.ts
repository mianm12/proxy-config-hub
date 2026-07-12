declare module "virtual:project-ir" {
  const nodeCatalog: readonly import("../domain/node/index.ts").RegionDefinition[];
  const renameDefaultProfile: string;
  const renameProfiles: readonly import("../compiler/ir/project-ir.ts").RenameProfileIr[];
  const overrideProject: import("../runtime/override/index.ts").OverrideProject;

  export { nodeCatalog, overrideProject, renameDefaultProfile, renameProfiles };
}
