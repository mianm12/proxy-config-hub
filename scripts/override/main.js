import { log } from "../utils/logger.js";

import ruleProvidersConfig from "../config/rules/ruleProviders.js";
import groupDefinitionsConfig from "../config/rules/groupDefinitions.js";

const { ruleProviders } = ruleProvidersConfig;
const { groupDefinitions } = groupDefinitionsConfig;

log('Loaded rule providers:', Object.keys(ruleProviders));
log('Loaded group definitions:', Object.keys(groupDefinitions));
