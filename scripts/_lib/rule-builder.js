"use strict";

const FORMAT_TO_EXT = {
  yaml: "yaml",
  text: "list",
  mrs: "mrs"
};

function buildRuleProviders(groupDefinitions, sourcesData) {
  if (!Array.isArray(sourcesData)) {
    throw new Error("SOURCES_DATA must be an array");
  }

  const providers = {};
  const rules = [];
  const seenIds = new Set();

  for (const source of sourcesData) {
    if (seenIds.has(source.id)) {
      throw new Error(`Duplicate source id: ${source.id}`);
    }

    seenIds.add(source.id);

    const definition = groupDefinitions[source.target_group];
    if (!definition) {
      throw new Error(`Unknown target_group: ${source.target_group} (source: ${source.id})`);
    }

    const ext = FORMAT_TO_EXT[source.format];
    if (!ext) {
      throw new Error(`Unsupported source format: ${source.format} (source: ${source.id})`);
    }

    providers[source.id] = {
      type: "http",
      behavior: source.behavior,
      format: source.format,
      url: source.url,
      path: `./ruleset/${source.id}.${ext}`,
      interval: 86400
    };

    rules.push(
      source.no_resolve
        ? `RULE-SET,${source.id},${definition.name},no-resolve`
        : `RULE-SET,${source.id},${definition.name}`
    );
  }

  rules.push(`MATCH,${groupDefinitions.fallback.name}`);

  return { providers, rules };
}

if (typeof module !== "undefined") {
  module.exports = {
    FORMAT_TO_EXT,
    buildRuleProviders
  };
}
