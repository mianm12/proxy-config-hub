import baseConfig from "../../config/runtime/base.js";
import dnsConfig from "../../config/runtime/dns.js";
import geodataConfig from "../../config/runtime/geodata.js";
import profileConfig from "../../config/runtime/profile.js";
import snifferConfig from "../../config/runtime/sniffer.js";
import tunConfig from "../../config/runtime/tun.js";
import { cloneData } from "./utils.js";

/**
 * 将运行时配置分段的所有键值对深拷贝后写入目标配置对象。
 * @param {Record<string, unknown>} config - 目标配置对象。
 * @param {Record<string, unknown>} section - 运行时配置分段。
 * @returns {void}
 */
function applyRuntimeSection(config, section) {
  for (const [key, value] of Object.entries(section)) {
    config[key] = cloneData(value);
  }
}

/**
 * 将所有运行时预设应用到配置对象。
 *
 * base/profile/geodata: 无条件覆盖（这些是基础配置，必须与预设保持一致）。
 * sniffer/dns: 无条件覆盖（嗅探和 DNS 配置需要预设保证正确性，用户不应部分覆盖）。
 * allow-lan: 仅在未设置时默认启用（允许用户显式禁用局域网访问）。
 * tun: 仅在未设置时应用预设（TUN 配置涉及系统网络栈，已有配置应被保留以避免冲突）。
 *
 * @param {Record<string, unknown>} config - 目标配置对象。
 * @returns {Record<string, unknown>} 应用预设后的配置对象。
 */
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

export { applyRuntimePreset };
