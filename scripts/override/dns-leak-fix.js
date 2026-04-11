"use strict";

// @bundle-inline ../_lib/dns-preset.js

function main(config) {
  const workingConfig = config && typeof config === "object" ? config : {};
  applyDnsConfig(workingConfig);
  return workingConfig;
}

if (typeof module !== "undefined") {
  module.exports = { main };
}
