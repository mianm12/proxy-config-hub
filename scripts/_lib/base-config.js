"use strict";

const BASE_CONFIG = {
  "mixed-port": 7897,
  "mode": "rule",
  "log-level": "info",
  "unified-delay": true,
  "tcp-concurrent": true,
  "find-process-mode": "strict",
  "profile": {
    "store-selected": true,
    "store-fake-ip": false
  },
  "sniffer": {
    "enable": true,
    "parse-pure-ip": true,
    "sniff": {
      "HTTP": {
        "ports": [80, "8080-8880"],
        "override-destination": true
      },
      "QUIC": {
        "ports": [443, 8443]
      },
      "TLS": {
        "ports": [443, 8443]
      }
    }
  },
  "geodata-mode": true,
  "geo-auto-update": true,
  "geodata-loader": "standard",
  "geo-update-interval": 24,
  "geox-url": {
    "geoip": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat",
    "geosite": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
    "mmdb": "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb",
    "asn": "https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb"
  }
};

const DEFAULT_TUN_CONFIG = {
  "enable": false,
  "stack": "system",
  "auto-route": true,
  "auto-detect-interface": true
};

function cloneBaseConfigValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyBaseConfig(config) {
  for (const [key, value] of Object.entries(BASE_CONFIG)) {
    config[key] = cloneBaseConfigValue(value);
  }

  return config;
}

function ensureBaseRuntime(config) {
  if (config["allow-lan"] === undefined) {
    config["allow-lan"] = true;
  }

  if (!config.tun) {
    config.tun = cloneBaseConfigValue(DEFAULT_TUN_CONFIG);
  }

  return config;
}

if (typeof module !== "undefined") {
  module.exports = {
    BASE_CONFIG,
    DEFAULT_TUN_CONFIG,
    applyBaseConfig,
    ensureBaseRuntime
  };
}
