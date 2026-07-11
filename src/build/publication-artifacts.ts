const CORE_PUBLICATION_ARTIFACTS = [
  "override.js",
  "rename.js",
  "example-full-config.yaml",
  "rules.tar.gz",
] as const;

const RELEASE_CHECKSUM_FILES = [...CORE_PUBLICATION_ARTIFACTS, "manifest.json"] as const;

export { CORE_PUBLICATION_ARTIFACTS, RELEASE_CHECKSUM_FILES };
