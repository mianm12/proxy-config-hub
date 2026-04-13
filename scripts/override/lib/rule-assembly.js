function assembleRuleSet(groupDefinitions, ruleProviders) {
  const providers = {};
  const rules = [];

  for (const [providerId, providerDefinition] of Object.entries(ruleProviders)) {
    const targetGroupId = providerDefinition["target-group"];
    const targetGroup = groupDefinitions[targetGroupId];

    if (!targetGroup) {
      throw new Error(`Unknown target-group for ${providerId}: ${targetGroupId}`);
    }

    const provider = {};
    for (const [key, value] of Object.entries(providerDefinition)) {
      if (key === "target-group" || key === "no-resolve") {
        continue;
      }

      provider[key] = value;
    }

    providers[providerId] = provider;
    rules.push(
      providerDefinition["no-resolve"]
        ? `RULE-SET,${providerId},${targetGroup.name},no-resolve`
        : `RULE-SET,${providerId},${targetGroup.name}`,
    );
  }

  if (!groupDefinitions.fallback?.name) {
    throw new Error("Missing fallback group definition");
  }

  rules.push(`MATCH,${groupDefinitions.fallback.name}`);
  return { providers, rules };
}

export { assembleRuleSet };
