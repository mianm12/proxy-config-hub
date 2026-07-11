import type { ChainIr } from "../../compiler/ir/project-ir.ts";
import type { Diagnostic } from "../../domain/diagnostics/diagnostic.ts";
import type { ProxyNode } from "../../domain/node/index.ts";
import type { MihomoProxyGroup, NamedProxy } from "./types.ts";
import { matchesSelector } from "./selectors.ts";

interface TopologyResult {
  readonly remaining: readonly NamedProxy[];
  readonly proxies: readonly ProxyNode[];
  readonly chainGroups: readonly MihomoProxyGroup[];
  readonly transitGroups: readonly MihomoProxyGroup[];
  readonly diagnostics: readonly Diagnostic[];
}

function resolveTopology(
  allProxies: readonly ProxyNode[],
  namedProxies: readonly NamedProxy[],
  chains: readonly ChainIr[],
): TopologyResult {
  let remaining = [...namedProxies];
  const proxyOutput = [...allProxies];
  const chainGroups: MihomoProxyGroup[] = [];
  const transitGroups: MihomoProxyGroup[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const chain of chains) {
    const landing = remaining.filter(({ name }) => matchesSelector(name, chain.landing.selector));
    const landingIndexes = new Set(landing.map(({ index }) => index));
    const remainingWithoutLanding = remaining.filter(({ index }) => !landingIndexes.has(index));
    const transit = remainingWithoutLanding.filter(({ name }) =>
      matchesSelector(name, chain.transit.selector),
    );

    if (landing.length === 0) {
      diagnostics.push({
        code: "OVERRIDE_CHAIN_NO_LANDING",
        severity: "warning",
        message: `chain ${chain.id} 未命中任何落地节点，链路不生效`,
      });
    }
    if (transit.length === 0) {
      diagnostics.push({
        code: "OVERRIDE_CHAIN_NO_TRANSIT",
        severity: "warning",
        message: `chain ${chain.id} 未命中任何中转节点，链路不生效`,
      });
    }
    if (landing.length === 0 || transit.length === 0) {
      continue;
    }

    remaining = remainingWithoutLanding;
    chainGroups.push({
      name: chain.landing.groupName,
      type: chain.landing.type,
      proxies: landing.map(({ name }) => name),
    });
    transitGroups.push({
      name: chain.transit.groupName,
      type: chain.transit.type,
      proxies: [
        ...transit.map(({ name }) => name),
        ...(chain.transit.includeDirect ? ["DIRECT"] : []),
      ],
    });

    for (const landingProxy of landing) {
      const current = proxyOutput[landingProxy.index];
      if (current?.["dialer-proxy"] !== undefined) {
        diagnostics.push({
          code: "OVERRIDE_DIALER_PRESERVED",
          severity: "warning",
          message: `节点 ${landingProxy.name} 已有 dialer-proxy，保留原值`,
          context: { name: landingProxy.name, value: current["dialer-proxy"] },
        });
        continue;
      }
      proxyOutput[landingProxy.index] = {
        ...current,
        "dialer-proxy": chain.transit.groupName,
      };
    }
  }

  return { remaining, proxies: proxyOutput, chainGroups, transitGroups, diagnostics };
}

export { resolveTopology };
export type { TopologyResult };
