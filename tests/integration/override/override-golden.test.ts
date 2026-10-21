import fs from "node:fs";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { compileProject } from "../../../src/compiler/compile-project.ts";
import { compileOverride } from "../../../src/runtime/override/index.ts";

const configSchema = z.looseObject({ proxies: z.array(z.unknown()) });
const fixtureSchema = z.object({
  cases: z.array(
    z.object({
      name: z.string(),
      config: configSchema.optional(),
      template: z.boolean().optional(),
    }),
  ),
});
const goldenSchema = z.object({
  fixture: z.string(),
  cases: z.array(
    z.object({
      name: z.string(),
      config: z.looseObject({}),
      logs: z.array(z.unknown()),
    }),
  ),
});

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function loadTemplateConfig(): z.infer<typeof configSchema> {
  const template = configSchema.parse(
    parse(
      fs.readFileSync(
        path.resolve(process.cwd(), "tests/fixtures/override/full-example-input.yaml"),
        "utf8",
      ),
    ),
  );
  return { proxies: template.proxies };
}

describe("override 行为回归", () => {
  const project = compileProject(path.resolve(process.cwd(), "config"));
  const fixtureRoot = path.resolve(process.cwd(), "tests/fixtures/override");
  const expectedRoot = path.resolve(process.cwd(), "tests/expected/override");
  const expectedNames = fs
    .readdirSync(expectedRoot)
    .filter((name) => name.endsWith(".json"))
    .sort();

  it("补全部分客户端配置并保留显式关闭与端口，缺省启用 Fake-IP 持久化", () => {
    const input = {
      ...loadTemplateConfig(),
      "mixed-port": 22227,
      tun: { enable: false, stack: "gvisor" },
      profile: { "store-selected": false },
    };
    const snapshot = structuredClone(input);
    const result = compileOverride(input, project).config;
    expect(result["mixed-port"]).toBe(22227);
    expect(result["tun"]).toMatchObject({
      enable: false,
      stack: "gvisor",
      "inet6-address": ["fdfe:dcba:9876::1/126"],
      "auto-route": true,
      "dns-hijack": ["any:53", "tcp://any:53"],
    });
    expect(result["profile"]).toEqual({ "store-selected": false, "store-fake-ip": true });
    expect(
      compileOverride({ ...input, profile: { "store-fake-ip": false } }, project).config["profile"],
    ).toEqual({ "store-selected": true, "store-fake-ip": false });
    expect(input).toEqual(snapshot);
  });

  it("TUN 接管 IPv6，DNS 保持关闭 AAAA 并使用加密引导，保留域名分流", () => {
    const result = compileOverride(loadTemplateConfig(), project).config;
    const direct = ["https://dns.alidns.com/dns-query#DIRECT", "https://doh.pub/dns-query#DIRECT"];
    const policy = z
      .object({ "nameserver-policy": z.record(z.string(), z.array(z.string())) })
      .parse(result["dns"])["nameserver-policy"];
    expect(result["dns"]).toMatchObject({
      ipv6: false,
      "enhanced-mode": "fake-ip",
      "default-nameserver": [
        "https://223.5.5.5/dns-query#DIRECT",
        "https://1.12.12.12/dns-query#DIRECT",
      ],
      nameserver: [
        "https://cloudflare-dns.com/dns-query#🚀 代理选择",
        "https://dns.google/dns-query#🚀 代理选择",
      ],
      "proxy-server-nameserver": direct,
      "direct-nameserver": direct,
      "direct-nameserver-follow-policy": true,
    });
    expect(result["dns"]).toHaveProperty(
      "fake-ip-filter",
      expect.arrayContaining(["rule-set:router-management", "rule-set:private"]),
    );
    expect(policy).toMatchObject({
      "asusrouter.com": ["192.168.50.1#DIRECT"],
      "www.asusrouter.com": ["192.168.50.1#DIRECT"],
      "router.asus.com": ["192.168.50.1#DIRECT"],
      "rule-set:cn,geolocation-cn": direct,
    });
    expect(result["ipv6"]).toBe(true);
    expect(result["tun"]).toMatchObject({
      "inet6-address": ["fdfe:dcba:9876::1/126"],
      "auto-route": true,
      "strict-route": true,
      "dns-hijack": ["any:53", "tcp://any:53"],
    });
    expect(result["dns"]).not.toHaveProperty("fallback");

    const routers = z
      .object({
        "router-management": z.object({
          type: z.literal("inline"),
          behavior: z.literal("domain"),
          format: z.literal("yaml"),
          payload: z.array(z.string()),
        }),
      })
      .parse(result["rule-providers"])["router-management"];
    // 两份生成结果必须覆盖相同域名；完整地址契约由 golden 保护。
    expect(
      Object.keys(policy)
        .filter((key) => key !== "rule-set:cn,geolocation-cn")
        .sort(),
    ).toEqual([...routers.payload].sort());
    expect(routers.payload).toEqual(
      expect.arrayContaining([
        "asusrouter.com",
        "www.asusrouter.com",
        "router.asus.com",
        "miwifi.com",
        "tplogin.cn",
        "+.zte.home",
      ]),
    );
    for (const unrelated of ["+.ts.net", "+.local", "+.lan"]) {
      expect(routers.payload).not.toContain(unrelated);
    }
    const rules = z.array(z.string()).parse(result["rules"]);
    expect(rules.indexOf("RULE-SET,router-management,🏠 私有网络")).toBeGreaterThanOrEqual(0);
    expect(rules.indexOf("RULE-SET,router-management,🏠 私有网络")).toBeLessThan(
      rules.indexOf("RULE-SET,private,🏠 私有网络"),
    );
  });

  for (const fixtureFile of expectedNames) {
    const fixtureId = path.basename(fixtureFile, ".json");
    const fixture = fixtureSchema.parse(readJson(path.join(fixtureRoot, fixtureFile)));
    const golden = goldenSchema.parse(readJson(path.join(expectedRoot, fixtureFile)));

    it(`${fixtureId} 生成审阅后的预期配置`, () => {
      expect(golden.fixture).toBe(fixtureId);
      expect(fixture.cases).toHaveLength(golden.cases.length);

      fixture.cases.forEach((fixtureCase, index) => {
        const goldenCase = golden.cases[index];
        const input = fixtureCase.template === true ? loadTemplateConfig() : fixtureCase.config;
        expect(input, `${fixtureCase.name} 缺少输入配置`).toBeDefined();
        expect(goldenCase?.name).toBe(fixtureCase.name);

        const inputSnapshot = structuredClone(input);
        const result = compileOverride(input, project);

        expect(input).toEqual(inputSnapshot);
        expect(result.config["ipv6"]).toBe(true);
        expect(result.config["dns"]).toHaveProperty("ipv6", false);
        expect(result.config["geox-url"]).toEqual({
          geoip: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat",
          geosite: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
          mmdb: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb",
          asn: "https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb",
        });
        const providers = z
          .record(
            z.string(),
            z.union([
              z.looseObject({ type: z.literal("http"), url: z.string() }),
              z.looseObject({ type: z.literal("inline"), payload: z.array(z.string()) }),
            ]),
          )
          .parse(result.config["rule-providers"]);
        expect(Object.keys(providers)).toHaveLength(94);
        const remoteProviders = Object.values(providers).filter(
          (provider) => provider.type === "http",
        );
        expect(remoteProviders).toHaveLength(93);
        for (const provider of remoteProviders) {
          expect(new URL(provider.url).origin).toBe("https://cdn.jsdelivr.net");
        }
        expect(result.config).toEqual(goldenCase?.config);
      });
    });
  }
});
