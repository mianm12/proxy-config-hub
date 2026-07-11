import { describe, expect, it } from "vitest";

import {
  chainsSchema,
  groupTemplatesSchema,
  providerSourcesSchema,
  renameProfilesSchema,
  routingModuleSchema,
} from "../../../src/compiler/schema/raw/index.js";

describe("v2 raw schemas", () => {
  it("接受有限策略组模板与结构化成员引用", () => {
    const result = groupTemplatesSchema.safeParse({
      templates: {
        proxy_service: {
          type: "select",
          members: [
            { group: "proxy_select" },
            { generated: "region_groups" },
            { builtin: "DIRECT" },
          ],
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("拒绝 selector 同时声明关键词和 regex", () => {
    const result = chainsSchema.safeParse({
      chains: [
        {
          id: "default_chain",
          transit: {
            id: "transit",
            "group-name": "中转",
            type: "select",
            selector: { "any-name": ["Transit"], regex: "Transit" },
            "include-direct": false,
          },
          landing: {
            id: "landing",
            "group-name": "落地",
            type: "select",
            selector: { "any-name": ["Relay"] },
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("同时支持标准来源简写和完整自定义 provider", () => {
    const sources = providerSourcesSchema.safeParse({
      sources: {
        metacubex_geosite: {
          "id-template": "{name}",
          "url-template": "https://example.com/{name}.mrs",
          "path-template": "./ruleset/{id}.mrs",
          provider: { type: "http", behavior: "domain", format: "mrs", interval: 86400 },
        },
      },
    });
    const module = routingModuleSchema.safeParse({
      id: "ai",
      groups: [{ id: "ai_service", name: "AI", template: "proxy_service" }],
      "rule-blocks": [
        {
          id: "services",
          target: "ai_service",
          providers: [
            { source: "metacubex_geosite", name: "openai" },
            {
              id: "company_public",
              provider: {
                type: "http",
                behavior: "classical",
                format: "yaml",
                url: "https://example.com/company.yaml",
                path: "./ruleset/company.yaml",
                interval: 3600,
              },
            },
          ],
        },
      ],
    });

    expect(sources.success).toBe(true);
    expect(module.success).toBe(true);
  });

  it("拒绝策略组模板实例混入完整声明字段", () => {
    const result = routingModuleSchema.safeParse({
      id: "ai",
      groups: [
        {
          id: "ai_service",
          name: "AI",
          template: "proxy_service",
          type: "select",
          members: [{ builtin: "DIRECT" }],
        },
      ],
      "rule-blocks": [],
    });

    expect(result.success).toBe(false);
  });

  it("接受命名 rename profile 且拒绝未知 legacy 字段", () => {
    const validProfile = {
      profiles: {
        pokemon: {
          prefix: "宝可梦",
          "prefix-position": "first",
          separator: "-",
          "add-flag": true,
          "preserve-multiplier": true,
          "collapse-single": true,
          "preserve-tags": ["IPLC"],
        },
      },
    };

    expect(renameProfilesSchema.safeParse(validProfile).success).toBe(true);
    expect(
      renameProfilesSchema.safeParse({
        profiles: { pokemon: { ...validProfile.profiles.pokemon, blkey: "IPLC" } },
      }).success,
    ).toBe(false);
  });
});
