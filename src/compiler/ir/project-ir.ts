interface RuntimeSectionIr {
  readonly target: string;
  readonly apply: "overlay" | "replace" | "if-absent";
  readonly value: unknown;
}

interface RegionIr {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly codes: readonly string[];
  readonly names: {
    readonly zh: readonly string[];
    readonly en: readonly string[];
  };
  readonly aliases: readonly string[];
  readonly cities: readonly string[];
}

interface RoutingRegionIr {
  readonly id: string;
  readonly groupName: string;
  readonly type: string;
}

type NodeSelectorIr =
  | {
      readonly kind: "keywords";
      readonly anyName: readonly string[];
      readonly allNames: readonly string[];
    }
  | { readonly kind: "regex"; readonly pattern: string; readonly flags: string };

interface ChainEndpointIr {
  readonly id: string;
  readonly groupName: string;
  readonly type: string;
  readonly selector: NodeSelectorIr;
}

interface ChainIr {
  readonly id: string;
  readonly transit: ChainEndpointIr & { readonly includeDirect: boolean };
  readonly landing: ChainEndpointIr;
}

type GroupMemberIr =
  | { readonly kind: "group"; readonly id: string }
  | { readonly kind: "pool"; readonly id: "all_nodes" }
  | {
      readonly kind: "generated";
      readonly id: "chain_groups" | "transit_groups" | "region_groups";
    }
  | { readonly kind: "builtin"; readonly id: string }
  | { readonly kind: "node"; readonly name: string };

interface GroupIr {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly members: readonly GroupMemberIr[];
  readonly hidden: boolean;
  readonly mihomo: Readonly<Record<string, unknown>>;
}

type GroupLayoutItemIr =
  | { readonly kind: "group"; readonly id: string }
  | {
      readonly kind: "generated";
      readonly id: "chain_groups" | "transit_groups" | "region_groups";
    };

interface ProviderConfigIr {
  readonly type: "http" | "file" | "inline";
  readonly behavior: "domain" | "ipcidr" | "classical";
  readonly format?: "yaml" | "text" | "mrs";
  readonly url?: string;
  readonly path?: string;
  readonly interval?: number;
  readonly mihomo: Readonly<Record<string, unknown>>;
}

interface ProviderIr {
  readonly id: string;
  readonly target: string;
  readonly noResolve: boolean;
  readonly config: ProviderConfigIr;
}

type RuleIr =
  | {
      readonly kind: "provider";
      readonly provider: string;
      readonly target: string;
      readonly noResolve: boolean;
    }
  | { readonly kind: "raw"; readonly value: string; readonly target?: string };

interface RenameProfileIr {
  readonly id: string;
  readonly prefix: string;
  readonly prefixPosition: "first" | "last";
  readonly separator: string;
  readonly addFlag: boolean;
  readonly preserveMultiplier: boolean;
  readonly collapseSingle: boolean;
  readonly preserveTags: readonly string[];
}

interface ProjectIr {
  readonly schemaVersion: 2;
  readonly runtimePlan: readonly RuntimeSectionIr[];
  readonly nodeCatalog: readonly RegionIr[];
  readonly routingRegions: readonly RoutingRegionIr[];
  readonly chains: readonly ChainIr[];
  readonly groups: readonly GroupIr[];
  readonly groupLayout: readonly GroupLayoutItemIr[];
  readonly providers: readonly ProviderIr[];
  readonly rules: readonly RuleIr[];
  readonly fallbackGroup: string;
  readonly renameProfiles: readonly RenameProfileIr[];
  readonly deployment: {
    readonly channel: string;
    readonly publicBaseUrl: string | null;
  };
}

export type {
  ChainEndpointIr,
  ChainIr,
  GroupIr,
  GroupLayoutItemIr,
  GroupMemberIr,
  NodeSelectorIr,
  ProjectIr,
  ProviderConfigIr,
  ProviderIr,
  RegionIr,
  RenameProfileIr,
  RoutingRegionIr,
  RuleIr,
  RuntimeSectionIr,
};
