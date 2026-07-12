import type { RenameProfileIr } from "../ir/project-ir.ts";
import type { RawProject } from "../load-raw-project.ts";

interface RenameCompilationResult {
  readonly defaultProfile: string;
  readonly profiles: readonly RenameProfileIr[];
}

function compileRename(project: RawProject): RenameCompilationResult {
  const { defaults, profiles, "default-profile": defaultProfile } = project.renameProfiles.data;
  return {
    defaultProfile,
    profiles: Object.entries(profiles).map(([id, profile]) => ({
      id,
      fields: profile.fields ?? defaults.fields,
      separator: profile.separator ?? defaults.separator,
      brackets: profile.brackets ?? defaults.brackets,
      subscriptionFallback:
        profile["subscription-fallback"] === undefined
          ? defaults["subscription-fallback"]
          : profile["subscription-fallback"],
      extraTraits: profile["extra-traits"] ?? defaults["extra-traits"],
      sequence: profile.sequence ?? defaults.sequence,
    })),
  };
}

export { compileRename };
export type { RenameCompilationResult };
