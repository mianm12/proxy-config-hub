function validateOutput(config, groupDefinitions) {
  const proxyGroups = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] : [];
  const rules = Array.isArray(config.rules) ? config.rules : [];
  const fallbackName = groupDefinitions.fallback?.name;

  if (!proxyGroups.length) {
    throw new Error("Missing proxy-groups");
  }

  if (!rules.length) {
    throw new Error("Missing rules");
  }

  const proxyGroupNames = new Set(proxyGroups.map((group) => group.name));

  for (const definition of Object.values(groupDefinitions)) {
    if (!proxyGroupNames.has(definition.name)) {
      throw new Error(`Missing configured proxy group: ${definition.name}`);
    }
  }

  for (const group of proxyGroups) {
    if (!Array.isArray(group.proxies) || group.proxies.length === 0) {
      throw new Error(`Proxy group is empty: ${group.name}`);
    }

    for (const target of group.proxies) {
      if (typeof target === "string" && target.startsWith("@")) {
        throw new Error(`Unexpanded placeholder target in ${group.name}: ${target}`);
      }
    }
  }

  let matchRuleFound = false;

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    if (typeof rule !== "string") {
      throw new Error(`Invalid rule type at index ${index}`);
    }

    if (rule.startsWith("RULE-SET,")) {
      const parts = rule.split(",");
      const targetGroupName = parts[2];

      if (!proxyGroupNames.has(targetGroupName)) {
        throw new Error(`RULE-SET references missing proxy group: ${targetGroupName}`);
      }

      continue;
    }

    if (rule.startsWith("MATCH,")) {
      if (index !== rules.length - 1) {
        throw new Error("MATCH rule must be the last rule");
      }

      if (rule !== `MATCH,${fallbackName}`) {
        throw new Error(`MATCH rule must target fallback group: ${fallbackName}`);
      }

      matchRuleFound = true;
    }
  }

  if (!matchRuleFound) {
    throw new Error("Missing fallback MATCH rule");
  }
}

export { validateOutput };
