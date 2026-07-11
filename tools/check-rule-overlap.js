import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

import { CONFIG_ROOT } from "../src/build/paths.ts";
import { compileProject } from "../src/compiler/compile-project.ts";

const AUDIT_CONCURRENCY = 8;
const AUDIT_TIMEOUT_MS = 30_000;

function loadRuleProviders() {
  return compileProject(CONFIG_ROOT).providers.flatMap((provider, index) => {
    const { config } = provider;
    return config.type === "http" && config.url !== undefined
      ? [
          {
            id: provider.id,
            index,
            url: config.url,
            behavior: config.behavior,
            format:
              config.format ??
              (config.url.endsWith(".mrs")
                ? "mrs"
                : config.url.endsWith(".txt")
                  ? "text"
                  : "yaml"),
            "target-group": provider.target,
          },
        ]
      : [];
  });
}

function resolveAuditSource(provider) {
  const parsed = new URL(provider.url);
  const isMetaRulesMrs =
    provider.format === "mrs" &&
    parsed.hostname === "raw.githubusercontent.com" &&
    parsed.pathname.startsWith("/MetaCubeX/meta-rules-dat/") &&
    parsed.pathname.endsWith(".mrs");

  return isMetaRulesMrs
    ? { url: `${provider.url.slice(0, -4)}.yaml`, format: "yaml", opaque: false }
    : { url: provider.url, format: provider.format, opaque: provider.format === "mrs" };
}

async function fetchRuleSet(provider) {
  const source = resolveAuditSource(provider);
  const response = await fetch(source.url, { signal: AbortSignal.timeout(AUDIT_TIMEOUT_MS) });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${provider.id}: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  if (!content.trim() || /^\s*</.test(content)) {
    throw new Error(`Invalid or empty rule content: ${provider.id}`);
  }
  const payload = parseRulePayload(provider.id, content, source);

  return {
    ...provider,
    sourceUrl: source.url,
    opaque: source.opaque,
    payload,
    entries: payload.map((value) => normalizeEntry(provider.behavior, value)),
  };
}

function parseRulePayload(providerId, content, source) {
  if (source.opaque) {
    return [];
  }
  if (source.format === "text") {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  }

  const document = yaml.load(content);
  if (!document || typeof document !== "object" || !Array.isArray(document.payload)) {
    throw new Error(`Rule payload must be an array: ${providerId}`);
  }
  return document.payload;
}

function normalizeEntry(behavior, value) {
  if (behavior === "domain") {
    return normalizeDomainEntry(value);
  }

  if (behavior === "ipcidr") {
    return normalizeCidrEntry(value);
  }

  if (behavior === "classical") {
    return normalizeClassicalEntry(value);
  }

  throw new Error(`Unsupported behavior: ${behavior}`);
}

function normalizeClassicalEntry(value) {
  const raw = String(value).trim();
  if (!raw) throw new Error("Empty classical entry");
  const [type, body] = raw.split(",", 2);
  const normalizedType = type?.trim().toUpperCase();
  const normalizedBody = body?.trim();

  if (normalizedType === "DOMAIN" && normalizedBody) {
    return normalizeDomainEntry(normalizedBody);
  }
  if (normalizedType === "DOMAIN-SUFFIX" && normalizedBody) {
    return normalizeDomainEntry(`+.${normalizedBody}`);
  }
  if ((normalizedType === "IP-CIDR" || normalizedType === "IP-CIDR6") && normalizedBody) {
    return normalizeCidrEntry(normalizedBody);
  }

  return {
    kind: "classical",
    value: raw.toLowerCase(),
    raw,
    key: `classical:${raw.toLowerCase()}`,
  };
}

function normalizeDomainEntry(value) {
  const raw = String(value).trim().toLowerCase();

  if (!raw) {
    throw new Error("Empty domain entry");
  }

  if (raw.startsWith("+.")) {
    return {
      kind: "suffix",
      value: raw.slice(2),
      raw,
      key: `suffix:${raw.slice(2)}`,
    };
  }

  return {
    kind: "domain",
    value: raw,
    raw,
    key: `domain:${raw}`,
  };
}

function normalizeCidrEntry(value) {
  const raw = String(value).trim().toLowerCase();

  if (!raw) {
    throw new Error("Empty CIDR entry");
  }

  const [address, prefixRaw] = raw.split("/");
  const version = net.isIP(address);

  if (!version) {
    throw new Error(`Invalid IP/CIDR entry: ${raw}`);
  }

  const bits = version === 4 ? 32 : 128;
  const prefix = prefixRaw === undefined ? bits : Number(prefixRaw);

  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) {
    throw new Error(`Invalid CIDR prefix: ${raw}`);
  }

  const ip = version === 4 ? parseIpv4(address) : parseIpv6(address);
  const shift = BigInt(bits - prefix);
  const network = shift === 0n ? ip : (ip >> shift) << shift;

  return {
    kind: "cidr",
    version,
    prefix,
    network,
    raw,
    key: `cidr:${version}:${network.toString(16)}/${prefix}`,
  };
}

function parseIpv4(address) {
  const parts = address.split(".");

  if (parts.length !== 4) {
    throw new Error(`Invalid IPv4 address: ${address}`);
  }

  return parts.reduce((result, part) => {
    const value = Number(part);

    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error(`Invalid IPv4 address: ${address}`);
    }

    return (result << 8n) + BigInt(value);
  }, 0n);
}

function expandEmbeddedIpv4(address) {
  const lastColonIndex = address.lastIndexOf(":");

  if (lastColonIndex === -1) {
    throw new Error(`Invalid IPv6 address: ${address}`);
  }

  const head = address.slice(0, lastColonIndex);
  const ipv4Part = address.slice(lastColonIndex + 1);
  const ipv4 = parseIpv4(ipv4Part);
  const high = Number((ipv4 >> 16n) & 0xffffn).toString(16);
  const low = Number(ipv4 & 0xffffn).toString(16);

  return `${head}:${high}:${low}`;
}

/**
 * 将 IPv6 地址的 :: 缩写展开为完整的 8 段格式。
 * @param {string} address - IPv6 地址字符串。
 * @returns {string[]} 8 个十六进制段的数组。
 */
function expandIpv6Segments(address) {
  const segments = address.split("::");

  if (segments.length > 2) {
    throw new Error(`IPv6 地址格式无效（多个 ::）: ${address}`);
  }

  const left = segments[0] ? segments[0].split(":").filter(Boolean) : [];
  const right = segments[1] ? segments[1].split(":").filter(Boolean) : [];

  if (segments.length === 1 && left.length !== 8) {
    throw new Error(`IPv6 地址格式无效（段数不为 8）: ${address}`);
  }

  if (left.length + right.length > 8) {
    throw new Error(`IPv6 地址格式无效（总段数超过 8）: ${address}`);
  }

  const middle = Array(8 - left.length - right.length).fill("0");
  return [...left, ...middle, ...right];
}

/**
 * 将 8 个十六进制段转换为 128 位 BigInt。
 * @param {string[]} parts - 8 个十六进制段。
 * @param {string} address - 原始地址（用于错误信息）。
 * @returns {bigint} 128 位整数表示。
 */
function ipv6SegmentsToBigInt(parts, address) {
  if (parts.length !== 8) {
    throw new Error(`IPv6 地址格式无效（展开后段数不为 8）: ${address}`);
  }

  return parts.reduce((result, part) => {
    const value = Number.parseInt(part || "0", 16);

    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new Error(`IPv6 地址段值无效: ${address}`);
    }

    return (result << 16n) + BigInt(value);
  }, 0n);
}

/**
 * 解析 IPv6 地址为 128 位 BigInt，支持 :: 缩写和嵌入式 IPv4。
 * @param {string} address - IPv6 地址字符串。
 * @returns {bigint} 128 位整数表示。
 */
function parseIpv6(address) {
  let normalized = address;

  if (normalized.includes(".")) {
    normalized = expandEmbeddedIpv4(normalized);
  }

  const parts = expandIpv6Segments(normalized);
  return ipv6SegmentsToBigInt(parts, address);
}

function entryCovers(leftEntry, rightEntry) {
  if (leftEntry.kind === "domain") {
    return rightEntry.kind === "domain" && leftEntry.value === rightEntry.value;
  }

  if (leftEntry.kind === "suffix") {
    if (rightEntry.kind === "domain") {
      return rightEntry.value === leftEntry.value || rightEntry.value.endsWith(`.${leftEntry.value}`);
    }

    if (rightEntry.kind === "suffix") {
      return rightEntry.value === leftEntry.value || rightEntry.value.endsWith(`.${leftEntry.value}`);
    }

    return false;
  }

  if (leftEntry.kind === "cidr" && rightEntry.kind === "cidr") {
    return cidrCovers(leftEntry, rightEntry);
  }

  if (leftEntry.kind === "classical" && rightEntry.kind === "classical") {
    return leftEntry.value === rightEntry.value;
  }

  return false;
}

function cidrCovers(leftEntry, rightEntry) {
  if (leftEntry.version !== rightEntry.version || leftEntry.prefix > rightEntry.prefix) {
    return false;
  }

  const bits = leftEntry.version === 4 ? 32 : 128;
  const shift = BigInt(bits - leftEntry.prefix);
  return (rightEntry.network >> shift) === (leftEntry.network >> shift);
}

function findCoveredEntries(leftProvider, rightProvider) {
  const coveredEntries = [];

  for (const rightEntry of rightProvider.entries) {
    const matchedBy = leftProvider.entries.find((leftEntry) => entryCovers(leftEntry, rightEntry));

    if (matchedBy) {
      coveredEntries.push({
        entry: rightEntry.raw,
        matchedBy: matchedBy.raw,
      });
    }
  }

  return coveredEntries;
}

function summarizeOverlap(providers) {
  const fullShadowPairs = [];
  const partialOverlapPairs = [];
  const opaqueProviders = providers.filter(({ opaque }) => opaque).map(({ id }) => id);

  for (let rightIndex = 0; rightIndex < providers.length; rightIndex += 1) {
    const rightProvider = providers[rightIndex];

    for (let leftIndex = 0; leftIndex < rightIndex; leftIndex += 1) {
      const leftProvider = providers[leftIndex];

      if (leftProvider.behavior !== rightProvider.behavior) {
        continue;
      }

      const coveredEntries = findCoveredEntries(leftProvider, rightProvider);

      if (!coveredEntries.length) {
        continue;
      }

      const overlap = {
        left: leftProvider.id,
        leftGroup: leftProvider["target-group"],
        right: rightProvider.id,
        rightGroup: rightProvider["target-group"],
        behavior: rightProvider.behavior,
        coveredCount: coveredEntries.length,
        totalCount: rightProvider.entries.length,
        coveredEntries: coveredEntries.slice(0, 10),
      };

      if (coveredEntries.length === rightProvider.entries.length) {
        fullShadowPairs.push(overlap);
      } else {
        partialOverlapPairs.push(overlap);
      }
    }
  }

  fullShadowPairs.sort(compareOverlap);
  partialOverlapPairs.sort(compareOverlap);

  return { fullShadowPairs, partialOverlapPairs, opaqueProviders };
}

function compareOverlap(left, right) {
  const leftSeverity = Number(left.leftGroup !== left.rightGroup);
  const rightSeverity = Number(right.leftGroup !== right.rightGroup);

  if (leftSeverity !== rightSeverity) {
    return rightSeverity - leftSeverity;
  }

  if (left.coveredCount !== right.coveredCount) {
    return right.coveredCount - left.coveredCount;
  }

  return left.right.localeCompare(right.right);
}

function formatOverlapLine(overlap) {
  const relation = overlap.leftGroup === overlap.rightGroup ? "same-group" : "cross-group";
  return [
    `${overlap.left}(${overlap.leftGroup}) -> ${overlap.right}(${overlap.rightGroup})`,
    `[${relation}]`,
    `${overlap.coveredCount}/${overlap.totalCount}`,
  ].join(" ");
}

function printReport(report, options = {}) {
  const { summaryOnly = false } = options;
  const crossGroupFullShadowPairs = report.fullShadowPairs.filter((overlap) => overlap.leftGroup !== overlap.rightGroup);

  if (summaryOnly) {
    console.log("# Cross-Group Full Shadow Pairs");
    if (!crossGroupFullShadowPairs.length) {
      console.log("(none)");
    } else {
      for (const overlap of crossGroupFullShadowPairs) {
        console.log(formatOverlapLine(overlap));
      }
    }

    console.log("");
    console.log(`# Same-Group Full Shadow Pairs: ${report.fullShadowPairs.length - crossGroupFullShadowPairs.length}`);
    console.log(`# Partial Overlap Pairs: ${report.partialOverlapPairs.length}`);
    console.log(`# Opaque MRS Providers (URL only): ${report.opaqueProviders.length}`);
    if (report.opaqueProviders.length) console.log(report.opaqueProviders.join(", "));
    return;
  }

  console.log("# Full Shadow Pairs");
  if (!report.fullShadowPairs.length) {
    console.log("(none)");
  } else {
    for (const overlap of report.fullShadowPairs) {
      console.log(formatOverlapLine(overlap));
      for (const sample of overlap.coveredEntries) {
        console.log(`  - ${sample.entry} <= ${sample.matchedBy}`);
      }
    }
  }

  console.log("");
  console.log("# Partial Overlap Pairs");
  if (!report.partialOverlapPairs.length) {
    console.log("(none)");
  } else {
    for (const overlap of report.partialOverlapPairs) {
      console.log(formatOverlapLine(overlap));
      for (const sample of overlap.coveredEntries) {
        console.log(`  - ${sample.entry} <= ${sample.matchedBy}`);
      }
    }
  }

  console.log("");
  console.log("# Opaque MRS Providers (URL availability only)");
  console.log(report.opaqueProviders.length ? report.opaqueProviders.join("\n") : "(none)");
}

async function main(options = {}) {
  const { summaryOnly = false } = options;
  const providers = loadRuleProviders();
  const fetchedProviders = new Array(providers.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(AUDIT_CONCURRENCY, providers.length) }, async () => {
    while (nextIndex < providers.length) {
      const index = nextIndex;
      nextIndex += 1;
      fetchedProviders[index] = await fetchRuleSet(providers[index]);
    }
  });
  await Promise.all(workers);
  const report = summarizeOverlap(fetchedProviders);
  printReport(report, { summaryOnly });
  return report;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const summaryOnly = process.argv.includes("--summary");
  main({ summaryOnly }).catch((error) => {
    console.error("规则重叠检查失败:", error.message || error);
    process.exit(1);
  });
}

export { main, normalizeEntry, parseRulePayload, resolveAuditSource };
