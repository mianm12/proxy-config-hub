import { describe, expect, it } from "vitest";

import {
  chainsSchema,
  groupTemplatesSchema,
  providerSourcesSchema,
  renameProfilesSchema,
  routingModuleSchema,
} from "../../../src/compiler/schema/raw/index.ts";

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
          mihomo: { "size-limit": 1048576 },
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

  it("标准来源固定为 HTTP，自定义 provider 支持 inline payload", () => {
    expect(
      providerSourcesSchema.safeParse({
        sources: {
          invalid_file_source: {
            "id-template": "{name}",
            "url-template": "https://example.com/{name}.yaml",
            "path-template": "./ruleset/{id}.yaml",
            provider: { type: "file", behavior: "domain" },
          },
        },
      }).success,
    ).toBe(false);

    expect(
      routingModuleSchema.safeParse({
        id: "custom",
        groups: [],
        "rule-blocks": [
          {
            id: "inline",
            target: "DIRECT",
            providers: [
              {
                id: "personal_inline",
                provider: { type: "inline", behavior: "domain" },
                mihomo: { payload: ["+.example.com"] },
              },
            ],
          },
        ],
      }).success,
    ).toBe(true);
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

  it("接受 defaults + profile 覆盖并拒绝非法 rename 配置", () => {
    const validProfile = {
      "default-profile": "standard",
      defaults: {
        fields: ["subscription", "flag", "iso", "protocol", "traits", "sequence"],
        separator: " ",
        brackets: ["subscription", "protocol"],
        "subscription-fallback": null,
        "extra-traits": [],
        sequence: "always",
      },
      profiles: {
        standard: {},
        airport: { "subscription-fallback": "示例机场", "extra-traits": ["IPLC"] },
      },
    };

    expect(renameProfilesSchema.safeParse(validProfile).success).toBe(true);
    expect(
      renameProfilesSchema.safeParse({
        ...validProfile,
        profiles: { standard: {}, airport: { unsupported: true } },
      }).success,
    ).toBe(false);
    expect(
      renameProfilesSchema.safeParse({
        ...validProfile,
        "default-profile": "missing",
      }).success,
    ).toBe(false);
    expect(
      renameProfilesSchema.safeParse({
        ...validProfile,
        defaults: { ...validProfile.defaults, fields: ["subscription"] },
      }).success,
    ).toBe(false);
    expect(
      renameProfilesSchema.safeParse({
        ...validProfile,
        defaults: { ...validProfile.defaults, separator: "\n" },
      }).success,
    ).toBe(false);
    expect(
      renameProfilesSchema.safeParse({
        ...validProfile,
        profiles: { standard: { "subscription-fallback": " " } },
      }).success,
    ).toBe(false);
    expect(
      renameProfilesSchema.safeParse({
        ...validProfile,
        profiles: { standard: { "extra-traits": [" "] } },
      }).success,
    ).toBe(false);
    expect(
      renameProfilesSchema.safeParse({
        ...validProfile,
        defaults: {
          ...validProfile.defaults,
          fields: ["sequence"],
          brackets: [],
          sequence: "duplicates",
        },
      }).success,
    ).toBe(false);
  });
});
