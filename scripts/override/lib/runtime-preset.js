import baseConfig from "../../config/runtime/base.js";
import dnsConfig from "../../config/runtime/dns.js";
import geodataConfig from "../../config/runtime/geodata.js";
import profileConfig from "../../config/runtime/profile.js";
import snifferConfig from "../../config/runtime/sniffer.js";
import tunConfig from "../../config/runtime/tun.js";

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyRuntimeSection(config, section) {
  for (const [key, value] of Object.entries(section)) {
    config[key] = cloneData(value);
  }
}

function applyRuntimePreset(config) {
  applyRuntimeSection(config, baseConfig);
  applyRuntimeSection(config, profileConfig);
  applyRuntimeSection(config, geodataConfig);
  config.sniffer = cloneData(snifferConfig);
  config.dns = cloneData(dnsConfig);

  if (config["allow-lan"] === undefined) {
    config["allow-lan"] = true;
  }

  if (!config.tun) {
    config.tun = cloneData(tunConfig);
  }

  return config;
}

export { applyRuntimePreset, cloneData };
